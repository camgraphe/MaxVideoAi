# OpenAI image generation and recovery

GPT Image 2.6 Flare/Sunburst use the direct Images API. Their identity,
publication, canonical manual tariffs and Studio certification remain separate
gates. No fal key or fallback is needed on this image path. The raster correction
admits seventeen exact pixel presets, custom/automatic dimensions, five explicit
qualities plus Auto, ten outputs in App/MCP, one in Studio, and up to sixteen
owned raster references on all three surfaces. GIF/SVG belong to the separately
requested additional tool; annotations and masks are not admitted by this raster
contract.

`gptImage26Dimensions.ts` owns the exact 2.6 dimension envelope and ratio checks.
`gptImage26.ts` validates raster settings and JPEG/WebP-only compression. Custom
dimensions survive canonical imageWidth/imageHeight, the immutable quote and
paid execution before becoming OpenAI's literal size string. Automatic settings
remain `auto` in the provider payload; their conservative quote uses separately
authored native cells and must not become a claim of measured supplier output.
See [the raster tariff extension](../launch/2026-11-07-gpt26-raster-tariffs/README.md).
The 2,040 historical exact cells remain preferred and unchanged. Unsupported or
missing active tariffs still reject the request; catalog changes cannot activate
prices. Compression is part of immutable request identity but is price-neutral.

`openai-image-client.ts` owns one POST with the exact model ID, a fixed OpenAI
origin and no automatic retry. A transport timeout, unreadable success response
or 5xx leaves the paid job ambiguous. A request ID is diagnostic evidence, not
an endpoint from which Images API output bytes can be retrieved. Neither a
client retry nor recovery may submit a second paid provider request.

`openai-image-result-store.ts` reserves a private receipt before the POST and
persists validated returned image bytes and token usage before object uploads.
The completion context contains an allowlist of the original paid facts; it
contains no API key, prompt or signed reference URL. Private image bytes are
never selected into job, browser, MCP or admin DTOs. Database-only checkpoint
retries are bounded to three and never invoke generation. Simultaneous database
and object-storage outages after a received response are not a guaranteed
recovery path; the job retains its ambiguous identity and must not be resubmitted.

`openai-image-output-recovery.ts` owns storage and completion, with a ten-minute
per-job lease and private per-image upload checkpoints. Only the shared
`persistCompletedImageGeneration` publishes final `render_ids`. Its OpenAI lease
guard atomically checks current owner, paid status, nonterminal job and current
receipt lease; a concurrent admin refund cannot be overwritten. Already stored
outputs survive later upload/thumbnail errors. Recovery uses the stored price
and remains possible after model publication is closed or credentials change.

A validated incomplete response preserves its partial originals and enters
`needs_review`; its job uses the established `provider_polling_stalled` state.
The browser receives `outputPreparationState=manual_review` and stops polling.
MCP returns its established manual-review failure message, no polling retry,
and the actual persisted payment status. No automatic refund or regeneration
is inferred. An operator must inspect this receipt and settle the existing job.

`GET /api/cron/openai-image-recovery` requires the existing `CRON_SECRET` even
locally. Each invocation handles up to five received batches; it has no provider
client, quote, debit, schema initialization or user-supplied job selector. It
clears receipt bytes only after complete output publication; interrupted cleanup
is resumed independently. Unresolved/partial bytes remain until operator
resolution or the parent job's deletion, which cascades to its private receipt.

Before public admission, apply Neon migration
`95_openai_image_results.sql` explicitly and verify the cron secret in the
deployed environment. The mutation/bootstrap owner also initializes this table;
polling and job GETs do not. This branch has not applied the migration in
production. Keep the cron and receipts through a publication rollback.

Focused verification: `openai-image-provider.test.ts`,
`openai-image-execution.test.ts`, `openai-image-output-recovery-postgres.test.ts`
and `openai-image-recovery-route.test.ts`; broader shared accounting, schema,
status, browser and financial contracts remain mandatory. Tests cover first and
later storage failures, overlapping workers, expired leases, cleanup interruption,
foreign ownership, concurrent refunds and truthful partial-batch status.
