# ByteDance Direct Workflow, Pricing Visibility, and Marketing Design

Date: 2026-09-28

Status: design updated 2026-09-29 for the Seedance 1.5 withdrawal decision; no production price or provider switch is authorized by this document.

## Outcome

Make BytePlus the direct execution path for MaxVideoAI's supported current ByteDance video and image models, give creators a genuine Seedance 2.5 Draft-to-final workflow, and give admins one clear place to compare supplier cost with the customer quote before changing commercial policy. Once the behavior and prices are verified, review every affected marketing surface in English, French, and Spanish.

## Current evidence and scope

- Current product identities in `frontend/config/model-registry.json`: Seedance 1.5 Pro, 2.0, 2.0 Fast, 2.0 Mini, 2.5, Seedream 5.0 Lite (`seedream`), and Seedream 5.0 Pro. The unpublished `seedance-2-0-fast-byteplus` entry is a compatibility duplicate, not an eighth offer to promote.
- Recent production Seedance 2.x jobs use BytePlus `cgt-` task IDs; 1.5 still has Fal-only provider IDs. Seedream Lite and Pro already execute directly through BytePlus. Fal-looking endpoint strings and generic admin diagnostics are not proof of Fal execution.
- BytePlus supports Seedance 2.5 Draft at 480p followed by a new 1080p final task from the Draft task ID. The two steps are charged separately; the ID is valid for seven days. Seedance 1.5 also supports Draft. Seedance 2.0, Fast, and Mini do not expose this Draft mode. Final generation reuses the original creative inputs; it is not pixel upscaling.
- MaxVideoAI currently accepts ordinary Seedance 2.5 1080p but has no `draft: true` or `draft_task.id` execution path. The Draft is a mode and a lifecycle, not a new model identity.
- The repository has an authenticated `/admin/pricing` cockpit with canonical preview, explicit confirmation, immutable history, and rollback. On 2026-09-28 the live `/admin/pricing` URL redirected to `/admin/settings`, whose text says model prices use an engineering workflow. Reconcile deployment/routing before exposing new admin controls.
- The BytePlus negotiated quote CT20260925128931 was still `To be confirmed` in the console on 2026-09-28. Show list rates and pending proposed discounts separately; do not label unconfirmed discounts as effective.
- Current Seedance 2.5 1080p cost accounting uses the 480p/720p no-video token rate; BytePlus publishes a distinct 1080p rate. Current Seedream 5.0 Pro marketing mentions 4K although the provider's Pro API supports at most 2K. These are factual review items, not authorization to change customer prices.
- The existing Seedance 2.x public/billing token rate is intentionally padded by `2.5 / 1.3` before the versioned default `+30%` rule. Consequently the canonical `vendorSubtotalCents` and the admin “Supplier subtotal” are not reliable BytePlus cost for these rows. The separate poller rate table estimates cost from usage but currently equates list and effective cost. See `docs/engineering/bytedance-pricing-path-audit-2026-09-28.md`.
- BytePlus schedules Seedance 1.5 Pro shutdown for 2026-11-11. The activated model still returned `InvalidEndpointOrModel.NotFound` to the direct canary in this account on 2026-09-29. Keep the new direct path disabled; do not treat console activation as a successful generation canary. Preserve historical Fal reads and the dated shutdown guard.

## Seedance 1.5 withdrawal and offer positioning (decision added 2026-09-29)

- Stop planning a public Seedance 1.5 direct launch or 1.5 Draft parity. Keep any existing adapter code behind its disabled gate until historical job, receipt, refund and polling paths are verified; then remove unused new-job compatibility in a bounded change. Do not remap a saved 1.5 job or a paid request to another model.
- Seedance 2.0 Mini is the **candidate budget entry offer**, conditional on comparing live MaxVideoAI customer quotes for equivalent settings and confirming the supplier cost in the admin grid. It is not the technical successor to 1.5 Pro. Seedance 2.0 Fast is a separate, prominent option for speed and cost balance. Seedance 2.5 is the relevant option to evaluate for 1080p and the Draft-to-final workflow. Do not present any one of these as feature-identical to 1.5.
- Prefer a localized, indexable historical 1.5 archive page that explains the closure and offers contextual Mini, Fast and 2.5 paths. This preserves 1.5-specific search intent and media history. Audit Search Console queries, landing pages, backlinks and locale paths before deciding whether any 301 is better. If a single permanent redirect is eventually justified, compare Fast with Mini and 2.5 against the observed intent, document the destination and change the authored model registry through its retirement contract. No automatic 301 or `successorId` is implied by this decision.
- Plan the public withdrawal early enough to verify it before the provider shutdown. Close new 1.5 generation, app and pricing discovery only with tested lifecycle and historical-reader gates. Preserve old model, comparison, example and media URLs while the archive remains published. Remove live Product/Offer and generation CTAs from archived pages and structured data.
- Market the distinctions with factual comparisons: Mini for a verified lower customer price, Fast for its supported speed/cost proposition, and 2.5 for supported higher-resolution/Draft use. State actual resolution and mode limits. Do not call Mini the cheapest until exact canonical quotes across comparable live scenarios prove the claim; do not conflate a temporary provider discount with an approved customer tariff.
- SEO/GEO work covers EN/FR/ES canonical and hreflang, sitemap, robots and crawler access, internal links, comparison and example pages, accurate visible structured data, stable video playback and thumbnails, and search-intent-based page copy. Measure indexing, impressions, clicks and qualified traffic after release. Use ordinary crawlable, helpful content for AI search; do not add unsupported GEO schema or promise placement in generated answers.

## Creator workflow

1. Keep one public Seedance 2.5 identity. Offer an optional **Draft 480p** action only for supported modes; show its separate price before generation.
2. Save the original provider Draft task ID, account/region, owner, generation time, expiry, model, input provenance, and a link to the MaxVideoAI Draft job. Store no provider credentials in browser data.
3. On a completed Draft, show **Finaliser en 1080p** in the library and Studio. Requote the final independently, show the second charge, and require the ordinary generation confirmation. Reject expired, foreign-account, failed, already-finalizing, or unsupported Drafts before charging. A final may be retried only through an explicit new quote; duplicate requests must not double-charge.
4. Preserve two separate job/receipt records and an intelligible relationship between them. A user who keeps only the Draft pays only for that step. Explain that the final is a new model render with consistent creative inputs, not a guaranteed frame-for-frame upscale.
5. Keep Seedance 1.5 new direct/Draft execution disabled and prepare its public withdrawal before 2026-11-11. Preserve historical Fal jobs and their provider-specific readers. Retire ByteDance-specific new-job Fal choices only after the remaining supported direct modes pass canaries and rollback checks; leave Fal infrastructure for unrelated providers.
6. Keep Seedream Lite and Pro direct. Evaluate Flash as a distinct candidate before publication. Test same-account original Seedream Lite output reuse in Seedance; the existing copy-to-MaxVideoAI-storage path may remove the provider's trust signal. Authorized real-person/virtual asset workflows require their own consent and capacity design.

## Admin pricing comparison

- Extend the existing `/admin/pricing` domain rather than creating a competing price editor. Group by **model brand** and show the **actual execution provider** separately (e.g. ByteDance / BytePlus versus ByteDance / Fal during migration).
- Each representative row identifies model, mode, resolution, duration, audio, input-video/reference class, and whether it is Draft or final. The left side shows supplier list cost, effective cost only when a verified agreement applies, observed actual cost when available, unit, source link/version, effective date, and uncertainty. The right side shows the canonical MaxVideoAI customer quote, policy provenance, gross difference and percentage, and any fees not yet included in that gross comparison.
- Missing, estimated, stale, or pending supplier rates must be visible as such. Never turn an absent cost into zero or present an unconfirmed contract as current. For Draft → final show Draft, final, and combined totals, while retaining two independent charges.
- Editing on the right proposes an explicit **customer tariff cell** (rate/unit/rounding or fixed scenario amount), independent of supplier facts and the global 30% margin rule. Show the exact current/proposed quote, every affected scenario and surface, and a warning when a selector touches other models. Use the existing server `preview → explicit confirmation → transactional apply` and immutable history/rollback. No direct-save price endpoint and no duplicate pricing formula in the UI.
- ByteDance is the first complete family-specific price grid. On activation every sellable ByteDance scenario must resolve to an authored customer tariff; missing cells block quotation rather than fall back to the global 30%. Seed the initial grid from current customer quotes for no-change migration, then adjust reviewed cells intentionally. State the tariff unit, dimensions, rounding and effective period clearly. A deliberate below-cost introductory price requires an explicit exposure limit and approval; do not encode it as a negative margin or a false supplier cost.
- The first admin comparison shows the verified provider cost beside the **customer amount actually quoted by the effective live tariff today**, including any production DB override. Rebuilding the calculation must reproduce that amount to the cent for every currently sellable scenario. Do not derive a new customer amount from the newly corrected provider cost. Adrien decides separately whether each customer price should rise, fall, or remain unchanged.
- Supplier facts are a separate ownership domain from commercial margins. This first version can read verified versioned provider rates and actual usage, and flag disagreements. A later tariff-maintenance workflow may update supplier facts with evidence, effective dates and audit history; it must not secretly mutate customer prices.
- Start with the ByteDance/BytePlus family to prove the design, then apply the same comparison and manual-tariff workflow provider by provider. Price values remain unchanged until a separate reviewed proposal is confirmed.

## Final marketing review

The 1.5 archive and closure can proceed as a separately verified release before the 2.5 Draft and manual pricing-grid launches. For each release, inventory and review the home page, model catalogue and pages, pricing matrix, comparisons, examples, workflow pages, Studio onboarding, and MCP/assistant guidance in EN/FR/ES. Present 2.5 Draft as a two-step paid workflow only when live, distinguish it from Fast/Mini, and keep 1.5 historical content distinct from current offers. Correct provider capability and resolution claims, quote exact supported scenarios, and decide whether Flash or a Seedream-to-Seedance journey merits prominent placement. Verify canonical URLs, hreflang, structured data, localized copy, examples and first playback before publishing changes. Do not advertise unpublished or unverified features.

## Release boundaries

- Preserve current customer prices, credits, receipts, historical jobs, refunds, public URLs and model identities until an explicit change is reviewed.
- Do not activate a paid BytePlus plan, sign the quote, or use free inference tokens without a separately approved test budget and expected result.
- Distinguish provider estimated cost, negotiated cost, actual billed cost, commercial pricing basis, customer price and gross margin in both API names and UI labels. Never derive the supplier column from a padded customer-pricing basis.
- Roll out direct execution and the admin view behind existing authorization and canary gates; finish with a verified marketing pass, not a speculative copy rewrite.

## Sources and code owners

- Provider rules: <https://docs.byteplus.com/en/docs/ModelArk/2607688>, <https://docs.byteplus.com/en/docs/ModelArk/1544106>, <https://docs.byteplus.com/en/docs/modelark/image-generation-api>.
- Model sunset and discovery: <https://docs.byteplus.com/en/docs/ModelArk/1350667>, <https://docs.byteplus.com/en/docs/ModelArk/seedance-2-0>, <https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes>, <https://developers.google.com/search/docs/fundamentals/ai-optimization-guide>.
- Current model and routing owners: `frontend/config/model-registry.json`, `frontend/src/server/video-providers/byteplus-modelark-profiles.ts`, `frontend/src/config/fal-engines/seedance-1-5.ts`, `frontend/src/config/fal-engines/seedream.ts`.
- Pricing owners and runbook: `docs/engineering/pricing-engine.md`, `frontend/server/pricing-admin/`, `frontend/app/(core)/admin/pricing/`, `packages/pricing/`.
