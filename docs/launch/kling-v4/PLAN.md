# Kling V4 — implementation and release ledger

Prepared 2026-10-22 (Europe/Madrid), from main `28b0d14f6c0b59220b85b458427c670a6f6b8896`.

## Authorized outcome

Prepare a complete launch candidate in `codex/kling-v4-launch-prep`, using the FLUX launch quality bar. Adrien explicitly selected **Kling direct first, fal fallback** on 22 October. Preserve previous Kling URLs, historical media, and owner-curated playlists. Produce normal localized model-page content, not a coming-soon page. Keep the candidate private and noindex until API access, paid qualification, media and pricing are verified.

No production merge/deployment, live tariff activation, public admin/gallery changes, paid generation or voice creation is authorized in this preparation. No source or schema is evidence of account entitlement. No generated output is available yet; never borrow another model's output as V4 evidence.

## Architecture

- The authored registry owns identity, publication, family and discoverability. Use `kling-v4`; model route enabled for branch review and noindex, other publications disabled.
- Pure canonical request validation and provider adapters own V4-specific limits. Do not reuse V3's 15-second, six-shot, three-element truncation.
- Reuse the established Kling direct client, provider attempts, polling and financial recovery only where the verified V4 contract matches. Direct payload translation must be based on current direct documentation, never a guessed V3 model-name substitution.
- Preserve provider acceptance before any fallback decision. A missing task ID after an ambiguous submission is not proof that nothing was accepted. Fallback must preserve every requested option or fail closed.
- Enforce a closed release gate before billing/credentials/provider work, including trusted continuations and agent execution. Provider flags alone cannot qualify a release.
- Consumer presentation comes from shared schemas, localized content and registry projections. Do not advertise unsupported controls, fabricated scores or absent media.
- Prepare financial scenarios from normal list prices and the authorized 30% fal markup. Only canonical exact quotes can authorize later generation; candidate estimates never activate tariffs.
- Use the canonical owned-media importer, thumbnails, short previews, display renditions and launch-asset contract after real approved renders exist. Preserve originals and playlist order.

## Work and verification

| Work | Owner | State / proof |
| --- | --- | --- |
| Public fal/direct evidence, capabilities, normal prices and entitlement distinction | facts agent | Prepared; `provider-evidence-2026-10-21.md`, local snapshots, no direct V4 submit contract |
| Registry, raw definition, normal model template, EN/FR/ES content | surfaces agent | Prepared; `implementation-map.md`, no fake launch media, visibility closed except noindex model route |
| Original cinematic scenarios and private creative review | films agent | Ten unrendered scenes in `films.json` / `films.md`; local review on port3046 |
| Strict request adapter, execution gate, direct-first/fallback policy | root | Offline adapter and release gates tested; direct V4 transport still blocked pending its contract |
| Price preparation and media qualification workflow | root / facts agent | `pricing-plan.md`, canonical candidate matrix, `media-qualification.md`; no activated tariff |
| Focused tests, registry/catalogue generation, lint, types and selected full CI | root / surfaces agent | Focused tests, types, lint and registry pass; full fast run exposed count/fingerprint fixes and inherited Sharp mismatch, see handoff |
| Protected review preview, draft PR and handoff | root | Project preview protection read-only verified; local normal page noindex; no production merge |

## Launch blockers (must remain visible)

1. Account-level V4 access on direct Kling and fal has not been established. fal pages currently say API access is coming soon.
2. Direct V4 request/polling and fallback parity must be verified independently of fal schemas.
3. No approved paid qualification, rendered scenes, factual scores, owned thumbnails/previews or playable marketing assets exist.
4. No active V4 customer tariff or production pricing coverage is authorized.
5. Exact latest commit requires passing selected CI and protected/noindex review evidence before any release discussion.

Account recovery remains unresolved. The SOCIETE investigation ties historical API purchases to the inaccessible mailbox and found no migration proof. A read-only console check confirmed the alternative existing account has zero purchased packs and no displayed API keys. The admin Google flow was first-time consent and was cancelled. The working local legacy credentials prove authentication only, without identifying their mailbox or V4 access. Preserve existing keys/accounts; resolve the historical account before submitting an early-access request against an assumed owner. Private identity evidence stays outside the PR.

Refresh this ledger with actual results; a prepared candidate is not an activated product.
