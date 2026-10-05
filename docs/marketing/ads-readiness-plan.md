# Ads readiness — 5 October 2026

Initial local preparation was reviewed by Adrien on 5 October 2026. He then authorized coordinated push and site delivery and requested retiring Studio's beta presentation. The Studio task owns the final current-main merge and production checks; this task prepares the shared PR and required CI. English audience, media budget below €100 total and network undecided remain advertising assumptions. No advertising campaign, paid generation, new paid service or spend is authorized by this site release.

## Outcome and working hypothesis

One chain: a creator who already uses Claude Desktop brings a short visual brief → sees a quoted clip-generation workflow → visits `/integrations/claude` → connects and authorizes MaxVideoAI → returns to Claude → approves a quote → retrieves a completed clip. This is a hypothesis to validate, not proven acquisition efficiency. Prepare Studio as a second candidate without running a second campaign. Studio presents individual media creation, references and timeline editing. Sol assistance uses included or purchased credits and media generation has its own quote; Luna retains its request and availability conditions. Sequence export stays outside the public promise while its production flag is disabled.

## Prioritized batches

| Priority | Batch | Local state | Evidence / dependency |
| --- | --- | --- | --- |
| P0 | Base/public/Desktop comparison | Complete | Started from main = both live domains = `e50fb575a`; rebased onto newly merged main `0d16f0248` during verification, with zero missing main commits. Desktop was 254 commits behind at the initial check, preserved. [Audit](ads-readiness-20261005/baseline-audit.md) |
| P0 | Measurement and auth/payment attribution | Implemented; independent review completed | Shared GA4 ≤ 25 parameters; strict consent/live/admin boundaries; true Google account-created evidence; current-visit completion. Receipt-history flag deliberately narrower than all-flow first payer. [Measurement](ads-readiness-20261005/measurement.md) |
| P1 | Studio and named assistant landing pages | Visually reviewed; coordinated site release in progress | Four entries × EN/FR/ES, one primary action, proof/price/limits, preserved metadata and publication owners. Studio launch copy removes beta and obsolete export marketing; no assembled-MP4 promise. [Pages](ads-readiness-20261005/pages.md) |
| P1 | First-use/auth continuity | Implemented; local contract checks | Signup/language/Studio next+editable starter, no automatic request/generation; Google login vs signup distinction and delayed return. Authenticated external rehearsal still required |
| P1 | Proof and ad pack | Complete for local review | Eight MP4s (A/B × 16:9/9:16 × 24/48 s),16 caption sidecars,4 posters,2 editable thumbnails, sources/manifest. Existing sample, illustrations and dated host capture labelled separately. [Pack](ads-readiness-20261005/creative.md) |
| P2 | QA and review dossier | Complete locally; visual and authenticated acceptance remain | 24 desktop/mobile captures,12 narrow routes,3 anonymous signup continuations, locale sitemaps, eight playable cuts, full fast lane/build and comparable loading samples. [Verification](ads-readiness-20261005/verification.md) |
| P2 | Launch preparation | Complete draft; no launch | Claude Desktop hypothesis, UK/YouTube candidate assumptions, €60 proposed / €80 gross ceiling, observation/stop criteria, no invented CPA/ROI. [Launch sheet](ads-readiness-20261005/launch-sheet.md) |

## States to keep separate

**Realized:** dedicated branch `codex/ads-readiness-20261005` from the exact production/main base, then updated to the new main merge during verification; local implementation, creative exports and concrete review dossier. No wholesale Desktop dependency was imported. A bounded read-only installed Codex account/catalogue/existing-result recovery check succeeded without generation or private-media export.

**Explicit limits:** lifetime first external payer remains uncertified across the active direct-card and wallet flows; new receipt history is not sold as complete acquisition measurement. Browser journey completion is scoped to supported current-visit emitters, not all channels or lifetime media. GA4 delivery is best effort. Raw anonymous visits cannot guarantee admin exclusion before identity is known. Field CWV, real mobile/Safari, external OAuth, new account/checkout/paid creation and property configuration remain separate acceptance work.

**Dependencies before a paid pilot:** clear ad reuse rights, produce a fresh Claude host recording, complete isolated consent/auth/payment/debug/replay checks, finish the all-flow first-payer contract, select one ad network with an enforceable total cap, and obtain campaign/spend authorization. Existing evidence cannot establish compatibility for untested hosts. The authorized site release uses the normal GitHub/required Quality CI/Git-backed deployment policy and does not enable purchase optimization or certify those advertising prerequisites.

**Visual validation:** Adrien reviewed the dossier and approved continuing with coordinated site delivery. His additional Studio copy instructions are applied in the release candidate. The eight review cuts remain drafts, with their evidence and paid-reuse limits intact.

## Review location

Open [the local review dossier](ads-readiness-20261005/index.html), served at `http://127.0.0.1:3018/ads-readiness-20261005/index.html`; candidate application uses 3017. It contains the source-backed audit, technical verification, launch sheet, exact rendered copy, before/after desktop/mobile views and playable exports. Screenshots stay in its `review/` folder. Local MP4s/intermediate frames are ignored by Git; editable sources, captions, posters, small assets and reports are versioned. No secrets or private account/media identifiers are included.
