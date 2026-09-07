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
