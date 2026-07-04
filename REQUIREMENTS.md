# demo-shop 需求文档（FE-1 / Demo 语料）

Repo: `git@github.com:gogorun1/Cursor_user_journey_demo.git`
角色：Experience Diff 的预埋 demo 语料。**分支即语料**：`main` 是 before 基线，`pr-a` / `pr-b` / `pr-c` 是三个预埋 PR 的 after 版本。

## 0. 全局约束（不可违反）

1. **React + Vite + react-router-dom 声明式路由**。不引入其他框架、状态库、UI 库。
2. **所有可交互元素和页面根元素必须有稳定 `data-testid`**。pipeline（BE-1）靠它采 evidence，解说引擎（BE-2）靠它归因。**已有的 testid 一律不许改名**。
3. 页面不求复杂、不求真实电商，求**体验变化明显、可被 Playwright 观察**。
4. 端口从 `PORT` 环境变量读（默认 3001）。pipeline 会同时在 3001（before）/ 3002（after）各起一个实例。
5. 支付失败分支统一用 URL 参数触发：**`?fail=1`**。
6. 支付处理延迟统一为 **1.2 秒**（`PAYMENT_DELAY_MS = 1200`），这是 PR-A regression 可见性的关键，不许调短。

## 1. 路由（main 基线，已实现）

```
/products            商品列表
/cart                购物车
/checkout/shipping   结账第 1 步
/checkout/payment    结账第 2 步
/checkout/review     结账确认 + Place order
/order/success       成功页
/order/error         通用错误页（main 上存在但不会到达；pr-c 使用）
```

## 2. data-testid 合约

| testid | 元素 | 存在于 |
| --- | --- | --- |
| `page-products` / `page-cart` / `page-shipping` / `page-payment` / `page-review` / `page-order-success` / `page-order-error` | 各页面根 `<main>` | 对应页面 |
| `page-checkout` | 统一结账页根元素 | **仅 pr-a 新增** |
| `add-to-cart-<id>` | 加购按钮 | /products |
| `go-to-cart` | 进购物车链接 | /products |
| `cart-item` | 购物车行 | /cart |
| `checkout-button` | 去结账 | /cart |
| `shipping-address` | 地址输入 | shipping |
| `continue-button` | 步骤间继续按钮 | shipping、payment |
| `card-number` | 卡号输入 | payment |
| `place-order-button` | 下单按钮 | review（main/pr-b/pr-c） |
| `pay-now-button` | 支付按钮 | **仅 pr-a** 统一结账页 |
| `payment-loading` | Processing payment... spinner | main/pr-b/pr-c 的 review；**pr-a 必须不出现** |
| `payment-error-modal` | 失败 modal | main/pr-a/pr-b 的失败分支；**pr-c 必须不出现** |
| `retry-payment-button` | 重试按钮 | 同上；**pr-c 必须不出现** |
| `order-success-message` | 成功文案 | /order/success |

## 3. 三个 PR 分支的改动规格

### PR-A（分支 `pr-a`）— 主菜：一步结账但丢失 loading feedback

全场最重要的语料，必须最稳。

改动：
1. 把 shipping / payment / review 三页合并为**一个统一结账页 `/checkout`**（根元素 `data-testid="page-checkout"`，含地址输入、卡号输入、`pay-now-button`）。
2. `/cart` 的 `checkout-button` 直接跳 `/checkout`。
3. 点击 `pay-now-button` 后：
   - **不显示任何 loading 指示**（`payment-loading` 元素不得渲染）；
   - **按钮不 disabled**；
   - 页面静止 1.2 秒后跳 `/order/success`。
4. 失败分支（`/checkout?fail=1`）保持和 main 相同的 error modal + retry（PR-A 不动失败分支，那是 PR-C 的事）。

验收（Playwright 视角）：
- before（main）：`place-order-button` 点击后 `isDisabled() === true`，`payment-loading` 在 800ms 内 visible；
- after（pr-a）：`pay-now-button` 点击后 `isDisabled() === false`，`payment-loading` 在 800ms 内**不** visible；
- 两边最终都到 `/order/success`；
- after 的 navigation 次数 < before（体现 step-removed）。

### PR-B（分支 `pr-b`）— 反衬：纯 cosmetic

改动：**只把两处 `continue-button` 的文案从 `Continue` 改成 `Next step`**。

不许改：路由、流程、timing、loading、失败分支、任何 testid。

验收：除 `continue-button` 的 textContent 外，before/after 的 evidence 序列完全一致。系统应只输出 "Cosmetic change only."

### PR-C（分支 `pr-c`）— 追问弹药：失败分支退化

改动（只动失败分支，happy path 与 main 完全一致）：
1. `/checkout/review?fail=1` 点击 `place-order-button`、1.2s 处理后：**不再显示 error modal**，改为跳转 `/order/error`；
2. `/order/error` 文案：`Something went wrong.`（模糊、无帮助）；
3. **页面上不得有 `retry-payment-button`**，也没有任何返回 payment 的入口。

验收：
- before（main）失败：`payment-error-modal` visible，`retry-payment-button` visible，文案 "Payment failed. Please try again."；
- after（pr-c）失败：URL 变为 `/order/error`，`retry-payment-button` 不存在。

## 4. 本地验证清单（FE-1 每个分支自测）

```bash
npm install && PORT=3001 npm run dev
```

- [ ] main：cart → shipping → payment → review → Place order → spinner 1.2s → success
- [ ] main：`/checkout/review?fail=1` → error modal + Retry payment → 可重试
- [ ] pr-a：cart → `/checkout` → Pay now → 无 spinner、按钮可点、1.2s 静止 → success
- [ ] pr-b：仅按钮文案变化，其余与 main 逐像素无所谓、逐流程一致
- [ ] pr-c：happy path 与 main 一致；`?fail=1` → 跳 `/order/error`，无 retry
- [ ] 每个分支跑一遍 pipeline 冒烟：`npm run pipeline -- --base main --head <branch> --flow checkout-happy`（PR-C 另跑 `--flow checkout-fail`）

## 5. 时间要求（对应主仓里程碑）

- **Sat 16:00（M1）**：pr-a 必须完成并推到 remote——pipeline 要用它出 PR-A 的 before/after 真实录像。
- **Sat 19:00**：pr-b、pr-c 完成并推到 remote。
- **Sat 22:00–01:00**：配合出预生成兜底视频后，分支冻结（只修 bug）。

## 6. Definition of Done（PRD 第 19 节）

- [ ] demo app 可跑
- [ ] PR-A/B/C 三个分支存在且推到 remote
- [ ] 所有关键元素有 data-testid
- [ ] PR-A loading regression 稳定可见（1.2s，Playwright 可断言）
- [ ] PR-C failure branch 稳定可触发（`?fail=1`）
