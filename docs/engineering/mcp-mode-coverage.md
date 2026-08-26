# MCP model-mode coverage

This document records the public model-mode boundary exposed to compatible AI
clients. The authored model registry and engine input schemas remain the source
of truth; this file explains the MCP projection and must not duplicate prices.

## Current coverage

Checked 2026-08-26 against the 42 app-published models.

The MCP can discover, validate, quote, confirm, submit, and recover these
transport-neutral modes when the selected model and connected environment mark
them executable:

- `t2v`: text to video;
- `i2v`: image to video, including an optional final frame when supported;
- `ref2v`: image, video, and audio reference generation as allowed by the model;
- `fl2v`: required first and last frames;
- `v2v`: source-video editing with supported references;
- `r2v`: one or more ordered reference videos;
- `extend`: ordered source-video extension;
- `t2i` and `i2i`: text and reference-image generation.

Seedance 2.5 uses ModelArk for `t2v`, `i2v`, `ref2v`, and `extend`. Its `v2v`
mode remains hidden from executable MCP discovery until the separate LAS price,
accounting, failure, refund, and canary contract is approved.

## Specialized workflows still closed

Seven public model-mode pairs remain intentionally absent from MCP execution:

| Model | Mode | Why it remains closed |
| --- | --- | --- |
| Gemini Omni Flash | `retake` | Requires a stored provider interaction identifier; exposing a raw provider identifier would break the transport-neutral contract. |
| Kling 2.5 Turbo | internal `i2i` Standard tier | This is a legacy code for lower-cost image-to-video, while `i2i` means image-to-image in the public MCP contract. It needs a non-ambiguous video-mode alias before exposure. |
| LTX 2.3 | `a2v` | Output duration follows verified source-audio duration; the current resolved-reference DTO does not carry duration into quote validation. |
| LTX 2.3 | `retake` | Needs source-time and replacement controls plus a mode-specific pricing/projection contract. |
| Luma Ray 2 | `reframe` | Price and output duration depend on source-video metadata that is not yet represented in the canonical quote. |
| Luma Ray 2 Flash | `reframe` | Same source-duration requirement as Ray 2. |
| Luma Ray 3.2 | `reframe` | Requires source-video duration plus reframe-specific output controls and provider constraints. |

These modes remain available on the MaxVideoAI website. They must not appear as
MCP-executable until the agent contract can return an exact quote and project a
confirmed request without hidden defaults or provider-only state.

`tests/mcp-special-video-modes.test.ts` is the drift guard. It fails when a new
app-published mode is not represented by the canonical MCP contract or by the
explicit closed list above.
