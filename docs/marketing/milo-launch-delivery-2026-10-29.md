# Milo launch delivery — 29 October 2026

## Implemented in PR #555

- `main` through `fd6f9cbe9` merged into the feature branch at `8a30450bd`. Both the compact source picker and the new source-duration generation guard remain. Studio retains the common Milo scope boundary and main's read-only checking instructions.
- `/ai-video-prompt-generator` and its `/fr` and `/es` versions: Milo identity, an interactive reference → conversation → prompt illustration, current context, free/credit levels, separate media/analysis costs, visible FAQs, matching JSON-LD and canonical/hreflang metadata. Existing route discovery includes the page in the sitemaps.
- Illustrative material: the existing MaxVideoAI-owned public watch asset, `/assets/studio/starters/product-ad.webp`. The conversation is authored educational copy, clearly labelled; it is not a captured provider reply or a measured result. No generated video or end-to-end savings demonstration is claimed.
- Generator CTA opens `assistant=milo`, preserves existing drafts and authentication, and never sends or generates automatically. The small help link is available before the first message. Manual mode remains available.
- Contextual discovery from the homepage's Studio block, public Studio page, pricing, footer and EN/FR/ES Getting Started.
- Existing consent analytics receives allowlisted `milo_try` / `home_milo` CTA names and placements. No message, prompt, reference URL or account content is sent through this acquisition path.

## Creative decision and budget

Lead with the user's idea and show how it becomes a usable prompt. The watch stays still while the camera reveals it; the example demonstrates one concrete direction, rather than decorating the page with unrelated AI imagery. Interface teaching is factual illustration, not a new film concept. A real generated-result demo can follow once its brief, model/settings and costs can be shown together honestly.

Paid generation authorization: **$10 maximum**. Spend in this increment: **$0**. No purchase or external generation call. Existing image reused; no private account screenshot published.

## Before production activation

1. Review the committed PR candidate and required **Quality CI**, including selected integration/browser/financial lanes. Fetch current `main` again before release; `8a30450bd` is a reconciliation record, not a permanent claim of freshness. Run `pnpm deployment:check` according to `docs/deployment/github-vercel.md`. Production merge remains a separate final action.
2. Inspect the target database's migration history and apply **only pending** migrations with the reviewed direct-connection procedure. Prerequisites include Studio schemas 52/64/67 as documented by the individual owners. Ordered new migrations: `85_prompt_assistance.sql`, `86_milo_three_levels.sql`, `87_milo_runtime_bounds.sql`, `88_milo_task_profiles.sql`, `89_composer_reference_analysis.sql`, `90_assistant_review.sql`, `91_assistant_review_retention.sql`. Do not replay historical policy migrations. Existing isolated QA application of 85–89 is not production evidence.
3. Before enabling composer assistance or expanded Studio capture, publish the updated EN/FR/ES privacy information and confirm authorised reviewers. The approved review interval is 90 days, separate from original history, creations and billing. Composer saves its provider-facing textual input/history in native request storage whenever live assistance runs; `ASSISTANT_REVIEW_CONTEXT_ENABLED` gates only expanded Studio capture and does not disable composer retention. Verify the deployment's own provider project access and exact runtime policy from [the assistance activation guide](../engineering/prompt-assistance.md): `STUDIO_ASSISTANCE_ENABLED=true`, with `STUDIO_ASSISTANCE_APPROVED_POLICY=studio-credits-2026-10-05-v2` in production. Local project access does not prove another credential. Keep credentials out of source, screenshots and this document. Do not replace existing Preview credentials with production secrets.
4. Deploy the compatible runtime and workers after schema prerequisites. Configure `PROMPT_ASSISTANCE_ENABLED=true` and build-time `NEXT_PUBLIC_PROMPT_ASSISTANCE_LIVE=1` together. Reference perception additionally requires `PROMPT_ASSISTANCE_PERCEPTION_ENABLED=true`, `NEXT_PUBLIC_PROMPT_ASSISTANCE_PERCEPTION=1` and the approved existing Studio analysis policy. Verify `STUDIO_MEDIA_ANALYSIS_ENABLED` and `STUDIO_VERCEL_WORKERS_ENABLED=true`, worker/cron authorization and durable recovery. A successful web build does not certify worker operation.
5. Enable `ASSISTANT_REVIEW_CONTEXT_ENABLED=true` only after migrations 90–91 and publication of the approved customer-information/retention policy. Confirm authorized admin reveal auditing. Verify the authenticated hourly cleanup, aggregate results and absence of a persistent backlog.
6. Qualify guest → sign in → Lite, Standard/Max with included and purchased credits, insufficient-funding recovery, lost response/reload, explicit image/video/audio coverage, Apply/Undo, manual mode, Draft, source restrictions and mobile. Do not interpret a fixture or offline provider test as a production check.
7. Publish the public promise together with the enabled functionality. Marketing is complete in EN/FR/ES; some underlying service errors are still English. Review that launch limitation explicitly. Verify canonical/hreflang, sitemap output, CTA and both production domains against the merged SHA.

### Recovery

Stop new assistance calls with `STUDIO_ASSISTANCE_ENABLED=false` and new composer perception requests with `PROMPT_ASSISTANCE_PERCEPTION_ENABLED=false`. Keep `PROMPT_ASSISTANCE_ENABLED=true` while accepted calls or analyses still need status/recovery: disabling that endpoint returns 404 for those paths as well. Preserve settlement, workers/cron and their existing analysis policy for accepted work. Reconcile outstanding operations before disabling the endpoint or removing its client entry. Public build flags require a new build. Do not drop evidence/financial tables or infer refunds. Roll forward where historical runtime reservations require compatibility; retain the last verified deployment and exact schema/config record.

## Remaining decisions and measurement work

- The user selected 90 days for detailed review context on 30 October. Publish the revised privacy notice, confirm the authorised reviewer group and verify cleanup before activating expanded capture. Original history, media and billing are separate. The production `legal_documents` privacy version/publication timestamp must be updated through the existing admin publication flow; the code fallback is `2026-10-30`. This PR does not alter production legal records or past consent evidence.
- The real end-to-end example (actual Milo exchange, applied prompt, media quote, full result) and controlled evidence of avoided retries remain separate from this illustrated walkthrough. Do not turn its copy into a savings claim.
- Acquisition CTA tracking is implemented. A first-message → proposal → Apply/Undo → generation → user-rated usable-result study still needs linked, bounded outcome events and an agreed definition of success. Retained admin conversation evidence does not establish conversion or quality. Exclude admin/QA and separate assistance, analysis and generation spend.
- Expand model-specific public examples on the existing model guides after this launch is qualified. No thin duplicate landing pages or unsupported search-volume estimates were added. Semrush's previous request had no remaining API units; keywords here reflect intent, not measured demand.


### Retention qualification — 30 October 2026

The additional review-context policy is 90 elapsed days. Migrations 90 → 91 were
applied only to `test/milo-pr555-live-20261029` (`br-tiny-base-aeohobbn`, project
`shy-flower-71253790`), after verifying it is non-default, non-primary and unprotected.
The exact versioned SQL ran transactionally; indexes are valid/ready and all four
review guards are present. Native counts stayed 19 composer requests, 537 Studio
responses and 556 assistance calls. Read-only eligibility checks found 0 expired
composer snapshots, 0 Studio snapshots and 0 notes. No hosted content cleanup,
backdating, production schema/configuration or legal-publication change was made.

Local PostgreSQL qualification covers expiry before cleanup, exact-field removal,
scoped IDs, locked/concurrent/repeated batches and old composer recovery with the
real credit ledger. Seven focused runtime tests and 49 existing legal/marketing
checks passed. Full CI and Preview must qualify the new commit; prior success at
`f175c2941` does not qualify this increment.
