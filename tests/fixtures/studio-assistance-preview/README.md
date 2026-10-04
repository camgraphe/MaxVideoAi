# Studio assistance local review

Run `node scripts/studio-assistance-preview.mjs --port=3047` from the repository root.
The server binds only to `127.0.0.1`; browser API connections are disabled by CSP.
It does not start Next.js, load environment files, access a database, call an assistant,
generate media, or connect checkout. Generated assets live in ignored `.local/`.
Reload a page to rebuild after presentation changes.

- `/`: real `StudioAssistance` component, CSS and tariff contract. Account usage is
  explicit demo data. Choices only update React state and the demo revision.
- `/concept`: separate design fixture with the proposed monthly Sol allowance,
  purchased-token bars, $2/$5/$10 packs, purchase review, and Luna fair use.
  This proposal is not the current financial contract and is not imported by the app.

The original app still has one-time limited allowances and wallet spending-limit
authorization. The proposal does not change those policies, tariff or ledger.
Before implementing packs, define token quantity/conversion, margin, allowance size,
renewal and expiry, payment source, and enforceable Luna fair-use rules separately.
Percentages, pack usage and purchase confirmation in this fixture are illustrative.
