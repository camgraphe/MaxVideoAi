# Billing and Wallet Refonte Qualification

## Outcome

The Billing route now presents one wallet-first flow: current balance, USD wallet-credit selection, exact quoted payment amount, secure hosted Checkout, eligible express methods, checkout-return reconciliation, and a compact payment ledger. Existing pricing, Stripe, webhook, receipt, invoice, captcha, currency, minimum-amount, analytics, and cancellation owners remain in place.

Branch: `codex/billing-wallet-refonte`

Base provenance:

- `45c45a812` is an ancestor of the branch.
- `0eb139aa5` is an ancestor of the branch.
- The source worktree was not modified.

## Browser qualification

The production build and development preview were both served from this isolated worktree on port `3037`. Public-only local Supabase placeholders were used; no secret was read or printed. Guest states were exercised on the real `/billing` route. Populated balance, successful return, EUR quote, express eligibility, first-top-up notice, and ledger rows used a temporary page labelled “Local preview data — not account data and no payment will be submitted.” That page and its visitor exception were removed before commit.

Verified at 1440×1000 and 390×844:

- Light and dark tokens preserve hierarchy, contrast, borders, and selected states.
- Preset selection and custom amount work; `$9` shows the `$10` minimum and disables submission, while `$17` produces `$17.00` paid and `$17` received.
- Guest Checkout opens the existing auth gate and preserves `amount=1700&currency=USD` in the continuation URL.
- Cancellation reports that no charge completed, retains the selected amount, and removes checkout-only query fields.
- Populated state separates `€21.40` payment from `$25` wallet credits.
- Successful return says account data was refreshed without claiming webhook settlement.
- Ledger rows distinguish top-up, charge, and refund; native details expose wallet movement and the Stripe document action.
- Tab order covers the header, presets, custom amount, currency, Checkout, FAQ, and history. Shift+Tab from Checkout returns to the currency selector.
- Enter activates a preset and a native FAQ details row.
- At 390 px the root width equals the viewport width (`378 px` CSS viewport after browser chrome), with no horizontal overflow.
- Browser reduced-motion emulation matches; the route-local contract disables the reconciliation spinner animation under that preference.

Local captures:

- `output/playwright/billing-wallet/billing-guest-light-desktop-3037.png`
- `output/playwright/billing-wallet/billing-guest-light-mobile-3037.png`
- `output/playwright/billing-wallet/billing-guest-dark-desktop-3037.png`
- `output/playwright/billing-wallet/billing-populated-light-desktop.png`
- `output/playwright/billing-wallet/billing-populated-dark-mobile.png`
- `output/playwright/billing-wallet/billing-ledger-expanded-light-desktop.png`

## Automated evidence

- Full repository suite: `4,488` tests passed; `0` failed.
- Focused Billing, Wallet, hosted Checkout, and receipt suite: `91` passed; `0` failed on the final HEAD.
- TypeScript: passed with `tsc --noEmit`.
- ESLint: passed with no errors or warnings.
- i18n parity: French `4,388` keys and Spanish `4,382` keys passed.
- Public exposure guard: passed.
- Production build: passed, including model-registry, engine-catalog, public-rendition, and home-poster prebuild gates; `/billing` built at `22.1 kB` route size.
- Architecture audit: no newly introduced Billing owner is at or above 500 lines. New style owners are `290`, `420`, and `239` lines. The pre-existing `WalletExpressCheckout.tsx` remains `528` lines.
- `git diff --check`: passed.

## Environment-only warnings and limits

- The local machine ran Node `23.9.0` while the repository requests Node `22.x`.
- The production build retained the existing Supabase Edge-runtime `process.version` warning.
- Local browser sessions reported the expected missing cookie-policy configuration and absent Vercel Insights endpoints. Billing quote and Stripe-mode endpoints returned successfully.
- No real authenticated wallet, payment method, Stripe redirect, webhook, provider-specific express wallet, email receipt delivery, or production database write was exercised. Those contracts are covered by the repository test suite; the browser fixture was presentation-only.

## Safety record

No pricing formula, bonus, generation estimate, membership discount, Stripe/webhook policy, dependency, database schema, environment file, deployment, production write, push, or real payment was added or performed. The branch and host-managed worktree are intentionally preserved for review.
