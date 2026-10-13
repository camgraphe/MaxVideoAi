# Seedance ModelArk creative option parity

The user authorized implementation, tests and normal production delivery of the missing Seedance options, within the existing two-call provider budget. Both genuine generation calls were consumed before this work; this change must use fixtures, disposable PostgreSQL, real local media and read-only production checks.

## Product contract

Current Seedance 2.0 Standard, Fast, Mini and 2.5 expose their documented creative capabilities through the existing workspace, public catalogue and MCP adapters. Seedance 1.5 remains archived. Unsupported legacy controls such as camera_fixed and seed must not become promised capabilities of current models. Account scheduling, callbacks and inference infrastructure are service implementation details rather than composer controls.

- Standard and Fast gain the already-priced 4-second duration. All current models gain Auto duration and adaptive aspect ratio where permitted. Auto is a fixed, disclosed quote at the model's maximum duration (15 or 30 seconds), not a claim to know the eventual output duration. Adaptive pricing uses a verified bounded pricing basis; it must never silently use a cheaper default ratio.
- ModelArk 2.5 Edit exposes 1080p, while any retained LAS route keeps its documented narrower resolution contract. Source-preserving Edit still sends duration=-1 and uses trusted source timing/framing for pricing.
- 2.5 gains MP4/MOV output selection. All current models gain return-last-frame and optional provider watermark. Options flow through validated extraInputValues, snapshots and provider requests; default behavior remains MP4, no last frame and no watermark.
- Multimodal field combinations follow current ModelArk limits, including audio-only 2.5 references, supplementary references for Edit/Extend, mutually exclusive first/last-frame versus Omni inputs, and aggregate per-media reference limits.
- 2.5 Draft works with documented input modes and inherits creative options into its owned 1080p Final. Existing seven-day lineage, debit lock, idempotent recovery and refund rules remain. Final uses server-owned immutable Draft media pricing facts; caller values cannot forge them.
- MOV original bytes and format are preserved. Browser playback uses a separate compatible derivative when needed. Last-frame JPEG is a durable, distinct reusable output, never a substitute for a thumbnail or a generated video.

## Delivery and validation

Tests must cover UI-to-request propagation, malformed options, maximum Auto quote consistency, adaptive/source geometry, exact original media preservation, separate JPEG identity, recovery after partial persistence, Draft/Final owner isolation and concurrency. Run all selected Quality CI lanes and a full build. Merge only a committed candidate containing current main with passing Quality CI and production alignment. Verify both production domains against the merge commit and inspect changed routes without generating paid media.

No new vendor key, LAS request, vendor communication, wallet credit or supplier generation is needed. Existing tariff evidence already includes 4 seconds for Standard/Fast and 1080p Edit 2.5; do not modify their prices.
