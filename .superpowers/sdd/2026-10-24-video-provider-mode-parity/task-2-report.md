# Task 2 report

Status: DONE_WITH_CONCERNS

Implemented the optional strict `operation` seam and Kling Standard/Pro/4K Edit plus 4K Reference. Existing omitted-operation Standard/Pro Reference normalization, hashes, pricing selectors and direct routing remain unchanged. New operations select verified fal endpoints; no Kling Extend or direct 4K support was inferred. Task 1 fixes and valid Seedance Draft remain intact.

## Delivered

- Full operation schemas shared through engine catalog, Site, canonical MCP details/preparation and Studio media/pricing actions. Compact localized Modify selector derives its default from caps, preserves inactive settings, persists/reuses selection, and filters effective payloads.
- Edit source timing/framing come from owned measured media, including fractional duration; explicit stale requested controls and unknown/incompatible operations fail closed. Sources require 3–15 seconds and 720–3840 pixels on each side, with existing owned MIME/size controls. Legacy Reference retains its 3–10 second source bound.
- Distinct exact selectors, endpoint/transport quote binding and trusted source identity binding through confirmation. No Reference tariff reuse or legacy pricing fallback for new operations.
- Read-only revision-bound tariff proposal through canonical factual/selector owners: 3 continuous Edit classes and 13 requested-duration 4K Reference classes. Public reference rates are 12.6/16.8/42 cents per second; generic 14-cent metadata is not used as the effective charge.
- Generated engine catalog refreshed; obsolete 4K exclusion contracts corrected. MCP fingerprint refreshed only for the additive preparation enum, retaining the 70 curated decisions and fixture contract hash.

## Verification

- Focused shared/provider/canonical/Studio/workspace/tariff/confirmation tests: 205 passed (`/tmp/task2-verified-suite.txt`). Covers all 38 public video models and valid Draft, existing legacy requests, actual builders, real DOM selector, source metadata, strict operation validation, distinct quote identity and tariff fail-closed behavior.
- New operation tests rerun after final selector/capability adjustment: 10 passed; localized DOM selector rerun: 1 passed.
- `pnpm mcp:client:check`: 173 passed, one existing skip; all 70 offline curated scenarios pass (`/tmp/task2-mcp-client-final.txt`).
- `pnpm --prefix frontend exec tsc --noEmit`: passed (`/tmp/task2-final-typecheck.txt`).
- Frontend lint: passed with six existing warnings; exposure lint passed. `git diff --check` passed.
- `pnpm engine:catalog --check`: current, 56 catalog entries.
- No paid calls, database writes, push, PR mutations or deployment. Parent owns complete CI, live browser/host smoke, financial gates and release validation.

## Concerns and release prerequisites

1. Retail tariff authoring is intentionally unfinished. Proposal entries have `customerPrice: null` and `activationReady: false`. Task 6 must author/review literal retail policy, qualify effective supplier billing and transport access, prepare a bounded revision-checked canonical application, and validate exact quote/debit behavior before activation. Published reference prices alone do not establish invoice charges or retail prices. New paid operations remain unavailable until reviewed active cells exist.
2. Canonical MCP/Studio had no owned Kling Element representation before this task. Their supported ordered reference images now work with operations, but full Element parity remains absent. Site retains its existing owned Elements builder/submission contract; new fal endpoints enforce the four combined image/element limit. No unchecked URLs/provider IDs or ad hoc Element JSON were added to canonical requests. This is a pre-existing cross-surface gap, not a Site regression.
3. No authenticated live browser or installed-host refresh was exercised here. Local DOM and in-memory SDK tests establish source contracts, not deployed UI/provider availability. Existing host connections need a catalog refresh after delivery.
