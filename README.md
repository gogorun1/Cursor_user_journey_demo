# demo-shop — FE-1 Demo 语料（独立 git repo）

假电商 checkout app。真身在 **git@github.com:gogorun1/Cursor_user_journey_demo.git**，队友用 `npm run bootstrap:demo-shop` clone 到主仓的 `apps/demo-shop/`（主仓已 gitignore）。本目录 `templates/demo-shop-seed/` 只是离线兜底种子。**分支即语料**：

| 分支 | 内容 |
| --- | --- |
| `main` | Before 基线：两步结账（shipping → payment → review），Place order 后 button disabled + 1.2s `[data-testid='payment-loading']` spinner |
| `pr-a` | 一步结账（统一 `/checkout`），点击 Pay now 后页面静止 1.2s，**无 spinner、button 不 disabled**（主菜 regression） |
| `pr-b` | 仅文案：`Continue` → `Next step`（cosmetic 反衬） |
| `pr-c` | 失败分支退化：error modal + Retry → 跳 `/order/error`，文案 "Something went wrong."，无 retry（追问弹药） |

## 运行

```bash
npm install
PORT=3001 npm run dev
```

支付失败分支通过 URL 触发：`/checkout/review?fail=1`（pr-a/pr-c 分支统一 checkout 页也遵循 `?fail=1` 约定）。

## FE-1 Definition of Done

- [ ] demo app 可跑（`main` 分支已可跑，见上）
- [ ] `pr-a` / `pr-b` / `pr-c` 三个分支存在且能稳定触发预期体验变化
- [ ] 所有关键元素有稳定 `data-testid`（新增页面也必须遵守，pipeline 靠它采 evidence）
- [ ] PR-A 的 loading regression：1.2 秒静止窗口肉眼可见，且 `[data-testid='payment-loading']` 不存在、`pay-now-button` 不 disabled 可被 Playwright 断言
- [ ] PR-C 的 failure branch 通过 `?fail=1` 稳定可触发

## 已预埋的关键 data-testid

`add-to-cart-*`, `go-to-cart`, `cart-item`, `checkout-button`, `shipping-address`,
`continue-button`, `card-number`, `place-order-button`, `payment-loading`,
`payment-error-modal`, `retry-payment-button`, `order-success-message`,
`page-*`（每个页面根元素）。

pr-a 分支需要新增：`pay-now-button`、统一的 `page-checkout`。

## 铁律

- 不要改 `data-testid` 命名（合约级约定，pipeline / narrator 都依赖）。
- 页面不求复杂，求体验变化明显、可被 Playwright 观察。
