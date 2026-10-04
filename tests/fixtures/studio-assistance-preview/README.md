# Studio assistance local review

Run `node scripts/studio-assistance-preview.mjs --port=3047` from the repository root.
The server binds only to `127.0.0.1`; browser API connections are disabled by CSP.
It does not start Next.js, load environment files, access a database, call an assistant,
generate media, or connect checkout. Generated assets live in ignored `.local/`.
Reload a page to rebuild after presentation changes.

- `/`: real `StudioAssistance` component, CSS and tariff contract. Account usage is
  explicit demo data. Choices only update React state and the demo revision.
- `/concept`: separate design fixture with the proposed monthly Sol allowance,
  remaining/total Sol credit bars, $2/$5/$10 packs, purchase review, and Luna fair use.
  This proposal is not the current financial contract and is not imported by the app.

The original app still has one-time limited allowances and wallet spending-limit
authorization. The proposal does not change those policies, tariff or ledger.
Before implementing packs, define token quantity/conversion, margin, allowance size,
renewal and expiry, payment source, and enforceable Luna fair-use rules separately.
The proposed demo unit is **1,000 Sol credits = $1**. It expresses metered spending
in one stable unit, because raw input, cached input and output tokens have different
prices. It is not a final token conversion or an authored customer tariff.
The 200-credit monthly grant and every starting balance are illustrative.

Purchases append a new pack and retain all existing remaining credits. The total
purchased balance sums the pack totals and remainders; each expandable pack row has
its own gauge. A $2 pack followed by $10 yields 12,000 purchased credits, with prior
usage deducted. Simulated usage exhausts free credits first, then purchased packs
in purchase order. No purchase resets the balance to 100% or erases prior usage.

Expand **How credits & pricing work** and use **Simulate 100 credits of usage**
to verify the order without an assistant call. `demo-credit-wallet.ts` owns only
fixture arithmetic; it is not imported by the product or financial ledger.
Run its focused checks with:
`frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/studio-assistance-preview-wallet.test.ts`.
