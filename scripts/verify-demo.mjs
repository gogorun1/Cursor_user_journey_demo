import { execFileSync } from 'node:child_process';
import { spawn } from 'node:child_process';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';

const HOST = '127.0.0.1';
const PORT = Number(process.env.PORT || '4311');
const BASE_URL = `http://${HOST}:${PORT}`;

const currentBranch = (() => {
  if (process.env.DEMO_SHOP_VARIANT) {
    return process.env.DEMO_SHOP_VARIANT;
  }

  try {
    return execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim() || 'main';
  } catch {
    return 'main';
  }
})();

const variants = {
  main: verifyMain,
  'pr-a': verifyPrA,
  'pr-b': verifyPrB,
  'pr-c': verifyPrC,
};

if (!variants[currentBranch]) {
  throw new Error(
    `Unsupported demo-shop variant "${currentBranch}". Set DEMO_SHOP_VARIANT to main, pr-a, pr-b, or pr-c.`,
  );
}

const server = spawn(
  process.platform === 'win32' ? 'npm.cmd' : 'npm',
  ['run', 'dev', '--', '--host', HOST, '--port', String(PORT), '--strictPort'],
  {
    env: { ...process.env, PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);

let serverLog = '';
server.stdout.on('data', (chunk) => {
  serverLog += chunk.toString();
});
server.stderr.on('data', (chunk) => {
  serverLog += chunk.toString();
});

try {
  await waitForServer();
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ baseURL: BASE_URL });
    await variants[currentBranch](page);
  } finally {
    await browser.close();
  }

  console.log(`demo-shop ${currentBranch} verification passed`);
} finally {
  server.kill('SIGTERM');
}

async function waitForServer() {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`Vite dev server exited early.\n${serverLog}`);
    }

    try {
      const response = await fetch(BASE_URL);
      if (response.ok) {
        return;
      }
    } catch {
      // Keep polling until Vite is ready.
    }

    await delay(150);
  }

  throw new Error(`Timed out waiting for Vite dev server at ${BASE_URL}.\n${serverLog}`);
}

async function verifyMain(page) {
  await verifyMultiStepHappyPath(page, { continueLabel: 'Continue' });
  await verifyRetryableFailure(page, '/checkout/review?fail=1', 'place-order-button');
}

async function verifyPrA(page) {
  await goToCart(page);

  await page.getByTestId('checkout-button').click();
  await waitForPath(page, '/checkout');
  await expectVisible(page.getByTestId('page-checkout'), 'unified checkout page should be visible');
  await expectVisible(page.getByTestId('shipping-address'), 'shipping address input should stay available');
  await expectVisible(page.getByTestId('card-number'), 'card number input should stay available');

  const payNowButton = page.getByTestId('pay-now-button');
  await payNowButton.click();
  assert(!(await payNowButton.isDisabled()), 'PR-A pay button must remain enabled during the 1.2s wait');
  await expectNotVisible(page.getByTestId('payment-loading'), 800, 'PR-A must not render payment-loading');
  await expectVisible(page.getByTestId('page-order-success'), 'PR-A should still finish on success');
  await expectVisible(page.getByTestId('order-success-message'), 'success message should be visible');

  await verifyRetryableFailure(page, '/checkout?fail=1', 'pay-now-button');
}

async function verifyPrB(page) {
  await verifyMultiStepHappyPath(page, { continueLabel: 'Next step' });
  await verifyRetryableFailure(page, '/checkout/review?fail=1', 'place-order-button');
}

async function verifyPrC(page) {
  await verifyMultiStepHappyPath(page, { continueLabel: 'Continue' });

  await page.goto('/checkout/review?fail=1');
  await expectVisible(page.getByTestId('page-review'), 'review page should load for failure flow');
  await page.getByTestId('place-order-button').click();
  await waitForPath(page, '/order/error');
  await expectVisible(page.getByTestId('page-order-error'), 'PR-C should route failures to the error page');
  await expectText(page.locator('h1'), 'Something went wrong.', 'PR-C error copy should be vague');
  await expectNotVisible(page.getByTestId('payment-error-modal'), 100, 'PR-C should not show the retry modal');
  await expectNotVisible(page.getByTestId('retry-payment-button'), 100, 'PR-C should not offer retry');
}

async function verifyMultiStepHappyPath(page, { continueLabel }) {
  await goToCart(page);

  await page.getByTestId('checkout-button').click();
  await waitForPath(page, '/checkout/shipping');
  await expectVisible(page.getByTestId('page-shipping'), 'shipping page should be visible');
  await expectVisible(page.getByTestId('shipping-address'), 'shipping address should be visible');
  await expectText(page.getByTestId('continue-button'), continueLabel, 'shipping continue label should match');

  await page.getByTestId('continue-button').click();
  await waitForPath(page, '/checkout/payment');
  await expectVisible(page.getByTestId('page-payment'), 'payment page should be visible');
  await expectVisible(page.getByTestId('card-number'), 'card number should be visible');
  await expectText(page.getByTestId('continue-button'), continueLabel, 'payment continue label should match');

  await page.getByTestId('continue-button').click();
  await waitForPath(page, '/checkout/review');
  await expectVisible(page.getByTestId('page-review'), 'review page should be visible');

  const placeOrderButton = page.getByTestId('place-order-button');
  await placeOrderButton.click();
  assert(await placeOrderButton.isDisabled(), 'place order button should be disabled during processing');
  await expectVisible(page.getByTestId('payment-loading'), 'payment loading indicator should be visible');
  await expectVisible(page.getByTestId('page-order-success'), 'success page should be visible after processing');
  await expectVisible(page.getByTestId('order-success-message'), 'success message should be visible');
}

async function verifyRetryableFailure(page, path, paymentButtonTestId) {
  await page.goto(path);
  await page.getByTestId(paymentButtonTestId).click();
  await expectVisible(page.getByTestId('payment-error-modal'), 'failure modal should be visible');
  await expectVisible(page.getByTestId('retry-payment-button'), 'retry button should be visible');
  await expectText(
    page.getByTestId('payment-error-modal').locator('p'),
    'Payment failed. Please try again.',
    'failure copy should be actionable',
  );
}

async function goToCart(page) {
  await page.goto('/products');
  await expectVisible(page.getByTestId('page-products'), 'products page should be visible');
  await page.getByTestId('go-to-cart').click();
  await waitForPath(page, '/cart');
  await expectVisible(page.getByTestId('cart-item').first(), 'default cart item should be present');
}

async function expectVisible(locator, message) {
  try {
    await locator.waitFor({ state: 'visible', timeout: 2_000 });
  } catch (error) {
    throw new Error(`${message}\n${error.message}`);
  }
}

async function expectNotVisible(locator, timeout, message) {
  try {
    await locator.waitFor({ state: 'visible', timeout });
  } catch (error) {
    if (error.name === 'TimeoutError') {
      return;
    }

    throw error;
  }

  throw new Error(message);
}

async function expectText(locator, expected, message) {
  const text = (await locator.textContent({ timeout: 2_000 }))?.trim();
  assert(text === expected, `${message}: expected "${expected}", got "${text}"`);
}

async function waitForPath(page, path) {
  await page.waitForURL((url) => url.pathname === path, { timeout: 2_000 });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
