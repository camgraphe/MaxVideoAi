# Character Studio V2 — implementation

Branch: `codex/character-studio-v2`, isolated from `origin/main`.
Design reference: `docs/redesign/2026-11-03-character-studio-proposal.md`.

## First delivery: visual character creation

Implement the approved two-column creator with six collapsible groups, original visual choices, inspiration presets, a permanent new-character action and real generation/history through existing account-scoped owners. Visual selections describe the next generation; never composite a live face or present a prepared image as generated output.

Extend request sanitation and immutable settings snapshots for eye shape and scene, preserving legacy snapshots. Keep existing reference upload, authentication, billing, polling, result download/save and image/video continuation. Localize new UI in EN/FR/ES. Preserve account isolation and pending jobs when starting another character.

Validation: focused character architecture/account tests, new prompt/catalog/state behavior tests, lint, exposure, TypeScript and local browser on desktop/mobile. No paid generation during QA.

## Subsequent deliveries

1. Durable named characters, approval snapshots and identity-linked looks (hair, clothing, scene). Existing image history is not mislabeled as a new durable character library.
2. MaxVideoAI Recast: source video, replacement images, optional prompt, settings, examples and recovered jobs. No look picker inside Recast.
3. Service identity on quotes, jobs, media, transactions and receipts with exact internal provider identity. The proposed 2× provider job cost remains undecided; no tariff activation in this delivery.
4. Produce and verify the influencer example videos, register media and publish reviewed recipes. Current illustrated assets are not video templates.

No production deployment or merge is part of this start.

## First delivery verification — 2026-11-03

Implemented on the branch: visual creator, six groups, twelve hairstyles, eight
wardrobe families, six eye shapes, 24 scene choices, six inspiration presets,
new-character navigation, real API integration and the existing image history.
29 focused tests pass. TypeScript, exposure and whitespace checks pass. ESLint
reports no errors and seven existing warnings outside this feature.

Browser/IAB: desktop at the normal 1268px viewport, then 390px and 320px. At 320px
the creator measures 282px client/scroll width with no overflowing controls.
Checked eye selection, hair expansion/Locs, Bohème clothing, scene filters,
new-character reset, historical tab and the local unavailable-database error.
Authenticated generation is disabled when the current price is unavailable.
No paid provider generation was performed.

Visual comparison used the approved interactive reference on port 50764 and the
Next app on port 3016; both screenshots were inspected with `view_image`.
The initial captures differ in native viewport dimensions because the reference
is a contained mockup. The implemented responsive widths were measured separately.

| Comparison point | Implemented / intentional difference |
| --- | --- |
| Composition | Left creator, right three-column inspiration grid; six collapsible groups retained |
| Media | Same original atlas cells; corrected square hair and unstretched wide eye crops |
| Typography and chrome | Existing app header/sidebar and product tokens retained; product font, readable 12–20px content |
| Palette | Uses live MaxVideoAI surfaces and brand accent, rather than a separate hardcoded mockup palette |
| Copy and navigation | Permanent New character; accurate My images label until durable character entities exist |
| Mobile | Stacks panels and wraps filters at 320px; no clipped controls |
| Deliberate first-lot omissions | Recast, named character identity approval, looks and influencer videos remain subsequent deliveries |

The creator structure and assets were verified against the accepted design;
this is a reviewed implementation slice, not a claim of complete mockup parity.
The local preview uses public frontend configuration only. Database-backed
pricing/history, real uploads and provider output quality remain to be checked
in a configured test environment before release.

## Visual iteration — compact studio, 2026-11-03

User-requested reference: the live Higgsfield AI Influencer settings panel,
https://higgsfield.ai/ai-influencer-studio . This iteration adopts its compact
mode control, large photo upload target, illustrated choices and fixed generation
action. It intentionally retains MaxVideoAI's palette, typography, navigation and
own generated images. It removes the previous route title/back/new-character row.

| Reference point | Implementation and verification |
| --- | --- |
| Header density | Compact Character / Recast selector with AI badge; accessible plus action, no extra page banner |
| Photo upload | Whole large target is clickable, overlapping original photo cards, optional badge and subtle shadow; existing upload/library handlers retained |
| Choices | Own photographic type, presentation and adult-age thumbnails; existing eye/hair/clothing/scene atlases retained |
| Scrolling | Independent constrained settings/results panels; Generate remains visible at normal height and 720px desktop height |
| Mobile | Editor/results toggle preserves state; dock accounts for the existing bottom navigation; checked at 390px and 320px |
| Copy/visual system | Deliberate deviation: localized MaxVideoAI copy, original gold accent and app header; no competitor branding or assets |
| Recast | Visible mode and usable local preparation; clearly unavailable generation, no fake video examples or provider output |

The live reference and latest implementation were captured and inspected in IAB;
local screenshots are QA artifacts outside the repository. New visible copy is
limited to the requested mode/identity controls, photo guidance, local Recast inputs
and truthful availability. No new hero or marketing sections were added.

Final screenshot comparison: reference 1228×1112 and implementation 1106×1112
at their normal browser sizes, plus explicit 1280×720 / 390×844 / 320×700 checks.
The reference and latest rendered screenshot were both inspected with `view_image`.
This verifies the requested compact layout and visual-control treatment, not exact
competitor parity. After a clean reload, no new feature runtime error was recorded;
the existing cookie-policy warning remains because the local server lacks its DB.
