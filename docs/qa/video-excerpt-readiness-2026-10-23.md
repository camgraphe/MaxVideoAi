# Shared video excerpt qualification — 2026-10-23

Status: locally qualified on `codex/marketing-media`. No push, deployment, paid
render, or production storage/database mutation occurred. The combined final-review findings are fixed; scoped confirmation remains the
separate final gate. The local demo remains at `http://127.0.0.1:3266/?view=excerpt`.

## Real bytes and canonical timing

The supplied `/Users/adrienmillot/Downloads/IMG_9773.MOV` is 5.558333 seconds,
26,852,432 bytes, H.264/AAC, displayed at 2160×3840 with rotation metadata.
Its original SHA-256 remains
`ad2341851ab3434c19d27e297a8c2b7d295b4b20f2eececb6c2abe08867c0b69`.
The earlier worker-only run produced a 4-second, 19,373,540-byte derivative;
that historical evidence remains `output/video-excerpt-demo/phone-cut-evidence.json`
and `phone-1-to-5.mp4`. It predates the final encoder cadence correction.

Final browser runs use the actual Composer, workspace asset/excerpt/pricing hooks,
`uploadVideoFile`, `prepareVideoExcerpt`, FFmpeg and upload metadata probe. The
minute source uses the single-upload transport; the supplied phone uses multipart
chunks. Authentication, owned library/database/storage, signed access and quote
HTTP transport are local adapters. Quotes use the canonical calculator and local
versioned tariff policy without production overrides; they are not payable prices.
All generation actions are disabled. Trimming is actual encoding, not playback offsets.

| Final source/range | Measured derivative | Bytes | Desktop / mobile preparation |
| --- | --- | --- | --- |
| Synthetic 60 s, 12–18 | 6 s, 640×360, H.264/AAC | 628,733 | 1,029 / 937 ms |
| Supplied iPhone, 1–5 | 4 s, 2160×3840, H.264/AAC | 19,372,284 | 21,641 / 9,438 ms |
| Kling source 60 s, 12–18 | 6 s, requested output remains 15 s | 628,733 | 491 / 488 ms |

These are local wall-clock samples while other checks were running, not capacity
or production latency measurements. Each result has a new canonical owned asset
reference; originals remain intact. API facts are independently probed. The demo
now projects the exact production ReferenceAsset fields rather than spreading an
extra original `mediaFacts` object into selected state.

The original 29.97 fps bug was reproduced: a 6-second selection encoded to 6.006
seconds and crossed the canonical ceiling tariff into 7 seconds. Encoding now
fits complete frames into a millisecond-aligned interval with rational cadence at
or below source fps. No pricing epsilon, metadata rounding, invented duration or
model-limit tolerance was added. Real audible/silent 29.97/23.976 tests cover 6,
5.999, 6.001, 18, 10 and 3-second boundaries, persistence re-probing and canonical
quote input. VFR with 44.1 kHz audio, 120 fps, short selections and too-small
selection rejection are covered. Measured metadata remains authoritative.

## Source policy and quote behavior

Limits project model source fields; preparation budgets do not become generation
limits. Covered current policies include Luma Ray 3.2 Modify max 18 s with inherited
source timing, Reframe max 10 s with requested timing, Kling O3 Standard source
3–10 s independent of requested output 15 s, Wan 3 source max 15 s, Seedance 2.0
max 15 s, Seedance 2.5 max 30 s, and extension field discovery. Unknown minima stay
unknown. Closed/unsupported modes remain unavailable. Ray2's unspecified source
maximum is not invented. Canonical tariffs and provider code are unchanged.

Desktop and mobile Luma preparation invalidated the old quote during editor and
preparation, then recalculated: 6 s produced local USD 1.69; 4 s used the existing
5-second minimum billable quantity and local USD 1.41. Kling preserved requested
15 s. Focused canonical integration also verifies Reframe requested 5 s with a
10-second source. Existing pricing tests cover normal workspace and API behavior.

## Browser and ownership evidence

Chromium exercised 1440×1000 and touch/mobile 390×844: full-source import, invalid
and valid numeric ranges, keyboard slider, manual playback, loop/pause inside
range, actual Apply, reopen against the original timeline, Cancel, failure, quote
invalidation/recalculation and original identity retention. There were no browser
page errors. The mobile harness now asserts `innerWidth === 390` and no horizontal
overflow; local demo facts wrap long canonical IDs. A separate committed browser
test covers product CSS at 1440, 390 and 320 px, unobstructed controls, keyboard
Enter, Cancel/Escape focus restoration and zero media requests before Play with
`preload="none"`.

Library qualification deliberately uses a 2-second gallery preview of a 60-second
original. The editor obtains the full original through the new ownership-resolved
read endpoint, and native playback reports 60 seconds. Canonical refs stay
separate from signed presentation URLs; ordinary card previews stay unchanged.
Tests cover same-origin auth, bounded/no-store responses, arbitrary URL/audio ref
rejection, account/source ownership, and late responses after cancel/model/account/
source change. Local blobs use their complete uploaded original directly.

Independent parent Cua inspection confirmed full 60-second playback, selected
12–18 range, playback at 16.686 inside it, 6-second prepared source, distinct
canonical ref, refreshed quote, preserved range on reopening, Cancel focus return,
and visible desktop/mobile actions.

Local evidence under `output/video-excerpt-demo/` (not committed):

- `browser-evidence.json`, `browser-preparation-evidence.json`,
  `requested-timing-browser-evidence.json`, plus the browser scripts.
- Viewport captures `390-phone-selection.png`, `1440-phone-selection.png`,
  `390-valid-excerpt.png`, `1440-valid-excerpt.png`, and corresponding long-source,
  failure and prepared-quote captures; Kling requested-15 captures.
- Independent `cua-desktop-selector.png`, `cua-mobile-selector.png` and final
  `cua-mobile-phone.png` (390×844; manual playback inside 1–5, no additional Apply).

## Validation

- Focused feature/workspace/pricing/disposable-PostgreSQL checks: 320 passed.
- Composer extraction and UI checks: 78 passed; latest source-access/browser check:
  4 passed. Real final canonical encoder integration: 8 passed. Additional media
  edge cases: 6 passed.
- Full fast lane: 8,564 passed, 7 failed, 1 skipped initially. Failures identified
  Composer/AppClient line contracts, a stale quote-mask architecture assertion and
  non-video library preview regression. All failed files and affected related
  tests passed a focused 102-test rerun after fixes. The 10-minute lane was not
  repeated unchanged. The skip is the absent packaged skill/plugin validators.
- Final production build passed, including prebuild model/media checks, lint,
  types and postbuild sitemap. Standalone `tsc --noEmit` exited 0. Explicit lint passed with six existing warnings
  outside changed code; exposure lint and diff whitespace checks passed.
- CI selector classifies both real FFmpeg files in integration and the new real
  browser test in browser. Exhaustive CI/premerge lanes remain required before a
  future push/merge; no such delivery operation is part of this task.

Reproducible verification commands (repository root):

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/video-excerpt-*.test.ts tests/client-video-excerpt.test.ts tests/workspace-video-excerpt-dom.test.ts tests/workspace-assets-hook-contract.test.ts tests/workspace-assets-split-contract.test.ts tests/workspace-upload-owner.test.ts tests/video-workflow-surface-parity.test.ts tests/luma-source-video-contract.test.ts tests/luma-agents-pricing.test.ts tests/luma-ray2-pricing.test.ts tests/studio-video-workflows-postgres.test.ts
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/composer-architecture.test.ts tests/workspace-app-client-architecture.test.ts tests/workspace-progressive-references.test.ts tests/workspace-recent-media.test.ts tests/workspace-recent-media-dom.test.ts tests/workspace-assets.test.ts tests/workspace-assets-hook-contract.test.ts tests/workspace-assets-split-contract.test.ts tests/workspace-upload-owner.test.ts tests/workspace-video-excerpt-dom.test.ts
pnpm run test:validate -- --suite fast
node scripts/run-validation-tests.mjs --plan
npm --prefix frontend run build
npm --prefix frontend run lint
pnpm --prefix frontend exec tsc --noEmit
npm run lint:exposure
git diff --check
```

Local logs are retained at `output/video-excerpt-demo/logs/`, including encoder
red/green, fast-lane failures/focused repairs, final candidate build, explicit
lint and empty successful final TypeScript log. Output evidence is uncommitted.

## Operational boundaries

The opt-in worker accepts sources up to 100 MiB and 180 seconds, excerpts up to
60 seconds further constrained by model policy, at most 16,777,216 display pixels
and 120 fps. These budgets do not change full-video workflows or the upload
endpoint's configured limit (50 MiB by default). It permits one active request
per account and two per process; this is not distributed rate limiting.
Runtime memory/CPU/timeout qualification on the intended host remains a release
check. Full-original signed access expires after five minutes; reopening refreshes
it. This local proof does not certify live authentication, deployed private storage
or a provider render. No production state changed.


## Combined final-review corrections

The single fix wave after `a82dde680354e668b44e930f3660715ddc89b052`
addresses both reproduced P2 issues and the browser error assertion:

- Original → excerpt → full original now validates the current model's source
  limits, restores the exact original ref, URL, selection/asset identity, filename,
  MIME, bytes, measured duration and dimensions, and clears excerpt/editor state.
  No second preparation request or encode occurs. Restoration also checks the
  active slot URL inside the atomic mutation, so a same-ID source replacement
  cannot be overwritten before React effects flush. Reapplying the unchanged
  prepared range remains a no-op. The real quote gate invalidates and requotes
  both source changes; requested output duration stays independent. Remote and
  blob originals are covered, including retained blob lifetime.
- Both `WorkspaceReferenceSection` and default `ComposerReferenceFields` keep a
  surviving excerpt trigger for focus return. The dialog retains a URL-keyed
  session under the model/mode/slot-keyed control. A session token fences late
  preview and Apply callbacks. Chromium verifies successful URL-changing Apply,
  Cancel and Escape at 1440, 390 and 320 px for both surfaces, then late Apply
  completion after source, model and account replacement without closing the new
  dialog or moving focus out of it.
- Browser `pageerror` events are collected and asserted empty before teardown.
  Full-timeline media still has `preload="none"` and makes no request before Play.
  The default source card's existing short-preview request is measured separately
  from the excerpt reader; workspace controls make no media request.

RED evidence: the new hook regression observed two preparation requests instead
of one for both remote and blob originals. The browser regression observed a false
focus-return assertion on successful Apply. Logs are
`output/video-excerpt-demo/logs/final-fix-red.log` and
`final-fix-browser-red.log`. The first combined browser attempt also exposed a
fixture timing race around initial modal focus; the test now waits for actual
focus inside the dialog before keyboard interactions.

Final focused verification (repository root):

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/workspace-video-excerpt-dom.test.ts tests/video-excerpt-selector-dom.test.ts tests/video-excerpt-browser.test.ts tests/client-video-excerpt.test.ts tests/video-excerpt-policy.test.ts tests/video-excerpt-source-access.test.ts tests/workspace-assets-hook-contract.test.ts tests/workspace-assets-split-contract.test.ts tests/composer-architecture.test.ts tests/workspace-app-client-architecture.test.ts tests/workspace-progressive-references.test.ts tests/workspace-pricing-lifecycle-dom.test.ts tests/workspace-upload-owner.test.ts tests/workspace-assets.test.ts tests/video-workflow-surface-parity.test.ts
pnpm --prefix frontend exec tsc --noEmit
npm --prefix frontend run lint
npm run lint:exposure
git diff --check
```

Results: **167 passed, zero failed/skipped**, TypeScript exit 0, lint exit 0 with
six existing unrelated warnings, exposure guard passed, whitespace check passed.
The affected hook, shared UI/browser, ownership, pricing lifecycle and architecture
checks are included. Logs use the `final-fix-` prefix in the existing local log
folder. No full fast-lane or production build rerun is claimed: the base production
build passed, and these narrow client state/focus changes were verified with the
full frontend type check plus browser compilation of the actual shared Composer
and product CSS. The encoder, backend, routes, tariff and model contracts are
unchanged, so previous real-cut qualification was not repeated.

The complete local demo was rebuilt from `output/marketing-demo/serve.ts`, retaining
all views. HTML and the rebuilt JavaScript returned HTTP 200 at
`http://127.0.0.1:3266/?view=excerpt`. No root Cua tab was manipulated by the fix
wave. The parent replayed the supplied phone's 1–5 s Apply, obtaining a measured
4 s derivative, local USD 1.41 quote and focus on Choose excerpt, then restored
0–5.558333 s immediately to `IMG_9773.MOV`, original asset
`ma_11111111111111111111111111111111` and measured 5.558333 s without a preparation
screen. The quote invalidated and began recalculating; focus returned correctly.
Parent captures are `output/video-excerpt-demo/final-desktop-selector.png`
(1440×1000) and `final-mobile-selector.png` (390×844), showing the actual shared
selector with all controls visible and manual playback paused at 4 s. Scoped
review remains owned by the parent.
No push, deployment, production mutation or paid render occurred.
