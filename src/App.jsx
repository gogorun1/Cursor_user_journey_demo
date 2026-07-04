import { Routes, Route, Navigate, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useState } from 'react';

const PRODUCTS = [
  { id: 'p1', name: 'Wireless Headphones', price: 129 },
  { id: 'p2', name: 'Mechanical Keyboard', price: 89 },
  { id: 'p3', name: 'USB-C Hub', price: 45 },
];

// Payment simulation: ?fail=1 in the URL makes the payment fail.
// The 1.2s delay is intentional — PR-A removes the visible feedback
// during this window, which is the core regression of the demo.
const PAYMENT_DELAY_MS = 1200;

function Products({ cart, addToCart }) {
  return (
    <main data-testid="page-products">
      <h1>Products</h1>
      <ul className="product-list">
        {PRODUCTS.map((p) => (
          <li key={p.id} className="card">
            <span>{p.name}</span>
            <span>${p.price}</span>
            <button data-testid={`add-to-cart-${p.id}`} onClick={() => addToCart(p)}>
              Add to cart
            </button>
          </li>
        ))}
      </ul>
      <Link data-testid="go-to-cart" to="/cart" className="button">
        Cart ({cart.length})
      </Link>
    </main>
  );
}

function Cart({ cart }) {
  const navigate = useNavigate();
  return (
    <main data-testid="page-cart">
      <h1>Your cart</h1>
      <ul>
        {cart.map((item, i) => (
          <li key={i} className="card" data-testid="cart-item">
            {item.name} — ${item.price}
          </li>
        ))}
      </ul>
      <button
        data-testid="checkout-button"
        disabled={cart.length === 0}
        onClick={() => navigate('/checkout/shipping')}
      >
        Checkout
      </button>
    </main>
  );
}

function Shipping() {
  const navigate = useNavigate();
  return (
    <main data-testid="page-shipping">
      <h1>Shipping</h1>
      <input data-testid="shipping-address" placeholder="Street address" defaultValue="1 Demo Street" />
      <button data-testid="continue-button" onClick={() => navigate('/checkout/payment')}>
        Continue
      </button>
    </main>
  );
}

function Payment() {
  const navigate = useNavigate();
  return (
    <main data-testid="page-payment">
      <h1>Payment</h1>
      <input data-testid="card-number" placeholder="Card number" defaultValue="4242 4242 4242 4242" />
      <button data-testid="continue-button" onClick={() => navigate('/checkout/review')}>
        Continue
      </button>
    </main>
  );
}

function Review() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const shouldFail = searchParams.get('fail') === '1';
  const [processing, setProcessing] = useState(false);
  const [failed, setFailed] = useState(false);

  const placeOrder = () => {
    setProcessing(true);
    setFailed(false);
    setTimeout(() => {
      if (shouldFail) {
        setProcessing(false);
        setFailed(true);
      } else {
        navigate('/order/success');
      }
    }, PAYMENT_DELAY_MS);
  };

  return (
    <main data-testid="page-review">
      <h1>Review your order</h1>
      <button data-testid="place-order-button" disabled={processing} onClick={placeOrder}>
        Place order
      </button>
      {processing && (
        <div data-testid="payment-loading" className="spinner-row">
          <span className="spinner" />
          Processing payment...
        </div>
      )}
      {failed && (
        <div data-testid="payment-error-modal" className="modal">
          <p>Payment failed. Please try again.</p>
          <button data-testid="retry-payment-button" onClick={placeOrder}>
            Retry payment
          </button>
        </div>
      )}
    </main>
  );
}

function OrderSuccess() {
  return (
    <main data-testid="page-order-success">
      <h1>Order confirmed</h1>
      <p data-testid="order-success-message">Thank you! Your order is on its way.</p>
    </main>
  );
}

function OrderError() {
  return (
    <main data-testid="page-order-error">
      <h1>Something went wrong.</h1>
    </main>
  );
}

export default function App() {
  const [cart, setCart] = useState([PRODUCTS[0]]);
  const addToCart = (p) => setCart((c) => [...c, p]);

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/products" replace />} />
      <Route path="/products" element={<Products cart={cart} addToCart={addToCart} />} />
      <Route path="/cart" element={<Cart cart={cart} />} />
      <Route path="/checkout/shipping" element={<Shipping />} />
      <Route path="/checkout/payment" element={<Payment />} />
      <Route path="/checkout/review" element={<Review />} />
      <Route path="/order/success" element={<OrderSuccess />} />
      <Route path="/order/error" element={<OrderError />} />
    </Routes>
  );
}
