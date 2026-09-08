# Selected finishing tools

The user clarified on 8 September that the Toolbox delivery includes the tools selected in task `01a07dd1-19cc-7430-bf1b-8f09f70cdf00` (Étudier une toolbox d’outils), including the Standard/Pro interaction. The previous delivery covered the existing tools only. This increment adds Restore Video, Denoise, Fix Blur and Smooth Motion alongside Upscale and Background Removal. Smart Reframe remains the next pilot; the other P1/P2 tools are not silently included in this first group.

## Product and release contract

Small cover + name tiles; one source; zero to two adjustments; quality only where another candidate exists; one action with the current price. Standard is the initial selection. No provider selector. Existing IDs, tool blocks and job routes remain valid. New blocks have their own IDs and version 1. Editor/MCP reuse the service contract; neither receives automatic new execution permissions.

Standard/Pro are candidate comparisons until reviewed. In particular, Nyx Fast must not become Standard merely because it is cheaper; it must pass texture, identity, audio and temporal checks. If it fails, promote the qualified Nyx route to Standard and omit Pro. Themis has only one qualified-candidate slot. ByteDance Pro is reconstruction and must be disclosed. Aion must demonstrate a useful improvement before Pro is activated.

## Sources checked on 8 September

- [Restore API](https://fal.ai/models/fal-ai/bytedance-upscaler/upscale/video/api): general preset, Standard/Pro, high fidelity, 8-bit, measured source FPS, 1080p/4K. [Prices](https://fal.ai/models/fal-ai/bytedance-upscaler/upscale/video): $0.0072/$0.0288 per second at 30fps; Pro ×10; FPS scales the price.
- [Denoise API](https://fal.ai/models/topaz/denoise/video/api): Nyx Fast/Nyx, source resolution, optional noise strength, H264. [Prices](https://fal.ai/models/topaz/denoise/video): published 10s/30fps examples, depending on output resolution/model.
- [Motion deblur API](https://fal.ai/models/topaz/deblur/video/api): Themis 2, source resolution and cadence, H264; no model or blur-type control. [Prices](https://fal.ai/models/topaz/deblur/video): examples at 10s and 60s prove that a flat per-second interpolation would be inaccurate.
- [Interpolation API](https://fal.ai/models/topaz/interpolate/video/api): Apollo/Aion, target FPS, slowdown factor fixed to 1, H264. [Prices](https://fal.ai/models/topaz/interpolate/video): billing depends on newly generated frames when slowdown is 1.

Topaz's public examples are vendor budget inputs, not exact invoice formulas. The candidate estimator rounds to complete 300-frame example blocks. It must be reconciled with actual billing before activation. No assertion of benchmark superiority is inferred from these sources.

## Implementation and validation

- [x] Add four versioned capability definitions, compact covers, localizations and shared form.
- [x] Implement server-owned routing, strict limits, read-only preparation and canonical customer quote.
- [x] Implement authenticated execution, source ownership, idempotency, wallet/job persistence and exact result lineage.
- [x] Test contracts, quote/tier/source changes, failures, mobile/desktop and result reuse with isolated transports.
- [ ] Compare candidates on owned test media; reconcile provider invoices and approve eligible Standard/Pro profiles before commercial activation. No paid generation is authorized in this delivery yet.

The commercial target is provider cost ×2.5, as explicitly confirmed in the source user messages. New policy must use the canonical pricing owner; existing Upscale/Background Removal prices are unchanged. No deployment or production mutation is authorized.


## Commercial qualification still required

Suggested corpus: six owned, 10-second, 1080p/30fps clips covering a compressed face, low light, fine texture, moving text, camera pan and a cut with dialogue. Compare seven candidate profiles on the same exact originals; inspect identity, text, grain/texture, temporal stability, cut handling, source audio and duration. Compare Standard/Pro blind before choosing the public labels. The published-example vendor estimate for this 42-run comparison is approximately $11.95 (motion at 60fps), excluding taxes and invoice discrepancies; it is not a verified bill or execution authorization. Any real run requires the owner to authorize the corpus and a hard budget first. No credentials, provider submission or paid test is part of this implementation.

The release review also covers interrupted submissions, output finalization and invoice reconciliation. A session can resume a stored job after reload, but this increment has no background sweeper or new webhook. Final persistence/refund occurs when the status owner is read again. Cross-device history reopening and scheduled orphan reconciliation should be agreed before public activation. User-facing cards and buttons disclose the current validation state.
