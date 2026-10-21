# Kling V4 — preparation handoff

22 October 2026, Europe/Madrid. Branch `codex/kling-v4-launch-prep`, based on `28b0d14f6c0b59220b85b458427c670a6f6b8896`. This is a draft launch preparation, not a working or released V4 integration.

## Decisions that persist

- Direct Kling is the intended primary provider, fal the fallback. Both require separate V4 account access and parity qualification. Do not infer direct endpoints from V3 or fal. A timeout, missing ID or ambiguous server failure must never cause a second paid submission.
- Normal published fal cost plus30% is the customer price-authoring basis. The prepared matrix uses the existing canonical pricing calculator; it is not an active tariff or a quote. No spend is authorized for V4.
- Preserve all historical model/family URLs and current owner-curated playlist ordering. Add new launch media later through the dedicated admin/library and video-SEO workflows.
- Normal model template in EN/FR/ES, noindex and protected preview only. No fake generated examples, poster, hero, score or VideoObject. No production deployment, merge, indexing, gallery edit or tariff activation.

## Prepared work

Read `PLAN.md`, `implementation-map.md`, `provider-evidence-2026-10-21.md`, `pricing-plan.md` and `media-qualification.md` for exact owners and blockers. Ten cinematic scenarios with English prompts and French explanations are in `films.json` / `films.md`. The private static creative review runs at `http://127.0.0.1:3046/`; the local model page at `http://127.0.0.1:3042/models/kling-v4`.

The pure fal adapter covers four documented modes, strict durations/shot sums, seven elements with per-element voice binding, reference counts and mode restrictions. Transport preserves owned reference metadata/order. Rejection happens for unsupported FPS/controls, unconsumed attachment slots, malformed elements and conflicting duration selectors. The new API-key authentication path preserves legacy JWT; no real credential was changed.

The hard release gate blocks V4 before billing/provider work, including trusted continuations and agent execution. Publication flags, maintenance flags or provider environment flags cannot alone bypass it. Direct V4 is deliberately not registered. App/Studio/MCP editors and canonical element/voice ownership still require design and implementation after the exact direct contract is known; no new mode certification was added.

Launch readiness explicitly reports missing V4 source media and requires durable originals, posters and short previews. Existing FLUX/Kling media was not modified. The completed FLUX project is separate and must not be replayed.

## Verification and limits

Independent read-only review found four P2 semantic-preservation issues; all were corrected and independently rechecked. Reviewer final verdict: suitable for a draft PR, no actionable remaining finding within the reviewed preparation scope. This is not launch approval.

The final focused run passed all 129 request/projection/auth/fallback/gate/media and marketing tests. TypeScript, registry projections, launch-asset projection, exposure guard and lint pass (six existing warnings, zero errors). The updated MCP schema fingerprint is backed by `mcp-offline-evidence.json`, with 70 curated decisions and 173 MCP tests passing plus one skipped; no real-host or paid-provider evidence is claimed.

The first full fast run completed8,336 tests:8,321 passed,14 failed,one skipped. Twelve failures were stale exact model/content counts or the MCP schema fingerprint and were repaired and retested in their focused suites. Two remaining environment failures are the shared installed Sharp0.34.5/libheif1.20.2 versus the committed Sharp0.35.4 expectation. This worktree currently uses symlinked dependencies from the shared checkout; the shared install was not modified. Do not report the full suite green. A clean locked CI install must verify those checks and all selected lanes before any merge.

The Vercel project read showed SSO protection enabled for all deployments except custom domains. Noindex is not access control. Verify the actual draft deployment protection, status and rendered output after the Git-backed preview exists. Local EN/FR/ES rendering checks passed without an application error: normal model sections, noindex, self-canonical, locale alternates, no video and no VideoObject. The local anonymous preview uses dummy public auth configuration only, without a production account/database.

A local full build was deferred with only 2.2 GiB disk space available and stale symlinked dependencies. The clean Git-backed preview/CI must supply the build result; local development rendering is not a production build claim.

## Account and early access follow-up

The official documentation banner links to a Business Inquiry form for V4 early access. No request was sent. An exact851-character request draft is kept locally at `.local/kling-v4/review/early-access-request.md`; do not include private account/credential details in the PR.

The SOCIETE recovery investigation was consulted at Adrien's request. Its archived messages establish historical API purchases and consumption on the inaccessible mailbox, with six purchased packs shown in an October 12 console capture. It found no evidence of migration to the proposed admin or alternative mailbox. A read-only sign-in to the alternative existing account on October 22 confirmed a different profile, zero purchased packs and no displayed API keys. The admin Google flow presented first-time consent and was cancelled; this does not rule out a separate password-based account. Exact identities and private evidence paths are recorded only in `.local/kling-v4/review/account-identity.md`.

The existing local legacy credentials still authenticate on a free account read, but that response does not identify their mailbox or establish V4 entitlement. Recovery of the historical account or explicit provider confirmation is still needed. No account/key was created or rotated and no support/early-access request was sent.

A private fal support reply dated8 October stated early access was Enterprise-only then. It does not establish today's entitlement, pricing or a permanent restriction. Recheck fal separately before advertising a working fallback. The current public pages still provide schemas without proving account-level execution.

## Next authorized preparation steps

1. Resolve the actual API account from the recovery evidence and console; prepare the exact early-access request for individual user validation if needed. No external message was preapproved.
2. Obtain direct V4 create/poll/callback/cancel schemas, billing precision, regional/plan access and provider-specific voice rules. Implement direct-first routing and conservative recovery using these sources.
3. Complete the App/Studio/MCP controls and ownership/hash/persistence contracts described in `implementation-map.md`. Keep gates closed until all modes are verified.
4. Review an exact bounded quote for the user-selected creative batch. Only then generate, inspect, score and deliver real owned media via `media-qualification.md`.
5. Prepare immutable tariffs and add approved media/linking through the existing owners. Obtain explicit release authorization after latest selected CI and protected preview checks; never treat the draft PR as authorization to merge.
