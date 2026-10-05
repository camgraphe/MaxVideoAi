# Studio assistance credits — local implementation evidence

Implemented on `codex/studio-assistance-preview`, in the isolated assistance
worktree. The release-validation checkout and production state were not changed.
The [approved spec](../superpowers/specs/2026-10-05-studio-assistance-credits.md)
and [accounting guide](../engineering/studio-assistance-economics.md) own the policy.

## Result

- 500 free GPT‑6.1 Sol credits per UTC month; 1,000 credits = $1 of customer usage.
- $2/$5/$10 packs debit the MaxVideoAI wallet once, accumulate without expiry,
  preserve prior usage, and consume free credits before purchased lots.
- Supplier basis plus 100%; frozen historical tariffs remain supported.
- GPT‑6 Luna has no monthly account quota, one active message and a generous
  128,000 input-token bound. Its trigger says “No monthly quota,” rather than 100%.
- The actual product dialog supports EN/FR, monthly and purchased gauges,
  per-pack history, explicit purchase review and localized MCP setup links.
- Selecting Sol preserves a purchased-credit pause. Resumption is a separate
  explicit control; legacy authorization is inactive under the new policy.
- Sponsored outages are reflected in status and UI. Packs cannot bypass
  free-first priority. Pure purchased calls remain independent of sponsored funds.
- Previous-month free-credit holds remain visible separately from the new grant.

## Checks

The complete editor suite passed with PostgreSQL 17.6 and two concurrent test
files: **1,003 passed, zero failed, one skipped**. The existing opt-in local
multitrack-render test requires `STUDIO_MULTITRACK_RENDER_TEST=1` and was not run.

```sh
PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH" ./node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test --test-concurrency=2 tests/maxvideoai-editor-*.test.ts tests/studio-*.test.ts tests/timeline-export-*.test.ts
frontend/node_modules/.bin/tsc --noEmit -p frontend/tsconfig.json
npm --prefix frontend run lint
npm run lint:exposure
git diff --check
```

These are the checks used by `qa:editor`, with bounded test concurrency. The first
unmodified `npm run qa:editor` attempt selected host PostgreSQL 14 and exhausted
shared-memory identifiers when many disposable databases started together. It
also found an outdated director-instruction assertion, which was updated to the
approved policy while retaining its permanent-guidance size contract. No host
kernel setting, shared dependency or unrelated database was changed.

TypeScript and exposure checks pass. Frontend lint has zero errors and four
existing image-element warnings in unrelated conversation components. Final
focused dialog/client/legacy tests passed after the browser-safe MCP helper and
Luna trigger label changes.

An independent financial review identified three Important issues and one Minor
display issue. Regression tests reproduced all four before implementation; the
ten targeted tests passed afterward. Follow-up review found no remaining
Important correctness or consent issue in those fixes.

## Browser evidence

`http://127.0.0.1:3047/` renders the actual component using explicit demo data and
in-memory callbacks. `/concept` preserves the approved prototype. The local server
disables API connections via CSP; purchase buttons cannot spend money or call a
provider. Both URLs are retained for review.

Checked French desktop, dark theme and a 390 × 844 mobile viewport. The mobile
dialog has equal client/scroll widths (354 px), with vertical scrolling for its
footer. Temporary viewport overrides were reset.

Verified a $10 demo purchase added to an existing $2 pack: 11,280 available out of
12,000 purchased credits, with the original 720-credit consumption preserved.
Pack gauges show 1,280/2,000 and 10,000/10,000. Verified paused purchases remain
paused when switching Luna → Sol; a simulated 100-credit use reduced free credits
from 360 to 260 and left purchased credits at 1,280.

Local screenshots and detailed logs are under ignored
`.local/studio-assistance-preview/`: `credits-desktop-fr.png`,
`credits-mobile-fr.png`, `credits-dark-fr.png`, `purchase-review-fr.png`,
`editor-final-2026-10-05.log`, `review-regressions-red.log`,
`review-regressions-green.log`, `dialog-final.log`, `types-final.log`, and
`lint-final.log`. The standalone browser build also caught and corrected a
server-only localization import; the product now uses the existing browser-safe
marketing locale helper.

## Activation boundary

No production migration, deployment, policy activation, real assistant dispatch,
payment or media generation was performed. Migration 63 was applied only to
disposable local databases. Production still requires migrations 54/62/63, the
new explicit approved policy value, an operational sponsored-funding decision,
and the provider/session/support qualification in the accounting guide. These
local tests do not establish provider-account eligibility or live model quality.
