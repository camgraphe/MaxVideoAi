# Toolbox integration

`frontend/src/lib/toolbox/catalogue.ts` owns stable product IDs and actual media eligibility. `contract.ts` owns additive v1 blocks, source references, normalized result and observable run states. These modules have no provider endpoints, prices, auth or network effects. Standalone workbenches remain adapters of existing tool APIs; no generic job migration is introduced.

## Studio agreement, 8 September 2026

Toolbox task owns catalogue/eligibility, standalone and reusable surfaces, existing adapters and settings/source/result contracts. Studio task `01a07e2a-7f4d-7c83-b24d-11b6008f00d9` owns placements, canvas/timeline/project persistence and historical SFX. Shared changes arrive in separate commits.

Store `{ toolId, version: 1, inputs, settings }` in new blocks. Each input is exactly `{ type: 'asset', assetId, kind }` or `{ type: 'job-output', jobId, outputId, kind }`, using canonical IDs returned by the media API. Do not fabricate output IDs from a gallery card/index, convert a preview into an original, or store provider routes. A saved asset is preferable when available. Old projects retain their legacy settings and adapter; do not rewrite unresolved identities during load. Resolve real media under the current account before offering the new block path.

`validateToolBlock` is structural validation, not authorization. Server adapters must resolve account-owned originals, verify metadata and specific implementation support, then call existing canonical quote/execution services. Current quick-tool and Angle schemas are additive; Character Builder and Storyboard still use their existing rich settings owners. No API may treat this validator as proof that a source belongs to a caller or a provider supports arbitrary input.

A result contains the source identities and canonical returned output identities, original URLs and separate thumbnails. No output is returned until known. Preserve originals and original audio/metadata; any explicit conversion or muted output creates a distinct result. Running state has no invented percentage or ETA; job IDs appear only when actually received. Existing synchronous tool calls remain synchronous and cannot claim cancellable background execution.

## MCP

Existing MCP supports model discovery, prepare/confirm generation, media import/listing and status/presentation. Quick tools are not currently executable through MCP. Catalogue `mcpExecution: false` is explicit. The browser-safe contract can support a future shared prepare/confirm adapter, but no new MCP tool registration or standalone audio generation is included. Montage preparation/persistence belongs to Studio.

## Qualification backlog

Denoise, Fix Blur, Smooth Motion and Clean Audio have named prospective controls/gates in `TOOLBOX_CANDIDATES`; they are absent from active discovery and rejected by block validation. Qualification must establish task fidelity, temporal/audio preservation, failure behavior and quote/invoice reconciliation. Generative reconstruction is a separate semantic operation, never an implicit fallback for faithful restoration. Bria commercial reconciliation remains required before changing its existing policy. No new multiplier or provider rate is authored here.

## Standalone surface and quote adapter

`ToolWorkbench` owns the responsive frame and accepts source, settings, preview and recent slots; `embedded` omits app chrome. `ToolSourceInput` owns compact import/library/URL actions. The default UI exposes one primary adjustment, puts implementation/mode/export controls in Options and shows the current price on the run button. Empty history, promotional text and repeated source/result explanations are omitted. Desktop uses a narrow control rail and media stage; mobile follows source → media → adjustments. All controls keep 44px targets and keyboard focus.

`UpscaleWorkspace` and `BackgroundRemovalWorkspace` retain their existing API runners. Account-keyed sessions discard prior account selections, results and requests. Source/library changes clear the previous comparison; current requests lock source/settings and recent selection. `useToolQuote` posts an account/input/settings-scoped request to `/api/tools/quote`; render-time invalidation and cancellation prevent stale responses or account round trips from enabling submission. It debounces 250ms, expires a pending request after 60s and exposes explicit retry. The legacy API request's optional `acceptedQuote: {totalCents,currency}` is checked after canonical pricing and before job/debit; a changed amount returns `quote_changed`. Old callers remain supported and no pricing policy is changed.

The read-only server quote adapter calls the existing Upscale/Background Removal pricing owners. Video Upscale metadata uses the bounded HTTPS reference downloader with pinned public DNS/redirect validation, with an explicit MP4/MOV/WebM policy (the MCP import policy is unchanged), then probes a temporary local file with network protocols disabled. Temporary bytes are removed; only metadata is cached for 60s in a bounded account-scoped map. At most one probe per account and two per process run concurrently; a busy preparation can be retried. Private-network URLs and unsupported download inputs cannot receive a video quote. Browser duration for background removal follows the existing service contract; quote validation does not introduce a new billing authority.

`normalizeQuickToolResult` is an additive bridge for canonical returned asset IDs. Missing job/asset IDs return null instead of a guessed output identity. Long legacy `url:<owner>:<kind>:<URL>` IDs must be resolved to canonical public IDs by the media owner before using the v1 schema; they must not be truncated. Studio's existing adapters and project persistence remain separate; this branch does not claim to wire every new surface into Studio.

## Local review

The normal isolated preview uses `/app/tools`, `/app/tools/upscale?kind=image`, `/app/tools/upscale?kind=video` and `/app/tools/background-removal`. A logged-out preview displays sign-in and does not execute jobs.

For a no-cost UI review, run `node scripts/toolbox-review.mjs --prepare`, then open `/app/tools/upscale?review=local` on a localhost **development** server. The explicit banner identifies simulated auth, quote/job/library/save responses and sample results. The template blocks external fetches; its sample clip is generated locally with ffmpeg. This verifies UI state/transport, not provider quality, live billing or real account authentication. Run `node scripts/toolbox-review.mjs --clean` before build or commit. The installer saves the original page and refuses to overwrite an unexpected route; the cleaner refuses to discard subsequent edits. No fixture route is included in the committed app.
