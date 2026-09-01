# MCP model-mode coverage

This document records the public model-mode boundary exposed to compatible AI
clients. The authored model registry and engine input schemas remain the source
of truth; this file explains the MCP projection and must not duplicate prices.

## Current coverage

Checked 2026-09-01 against the canonical runtime registry and engine schemas.

MCP catalog and exact hidden-model resolution are read-only database paths. They
use `frontend/src/server/agent-api/read-only-engine-catalog.ts`, whose transitive
dependencies contain only configuration `SELECT` owners and pure projection.
They never run billing-schema bootstrap or engine-settings seed writes. The
transactional confirmation variant takes a share lock and reads the same two
configuration tables through the caller executor before selection; quote,
reservation, and provider mutations remain downstream of successful selection.

Default discovery and recommendations contain only current, app-published
models. An exact legacy ID remains available when its runtime route is ready,
but is marked non-default and includes its canonical successor ID and slug.
Exact deep-legacy or retired identities remain inspectable for migration and
are rejected by budget, preparation, and confirmation before pricing or spend.
Model links always use the registry slug.

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
- `a2v`: audio-driven video using the verified source-audio duration;
- `retake`: replacement of a bounded source-video time range;
- `reframe`: source-video reframing using verified source dimensions and duration;
- `i2v_standard`: the lower-cost Kling 2.5 Standard image-to-video tier, exposed
  without reusing the image-only `i2i` name;
- `t2i` and `i2i`: text and reference-image generation.

Seedance 2.5 uses ModelArk for `t2v`, `i2v`, `ref2v`, and `extend`. Its `v2v`
mode is represented by the same canonical contract but remains hidden from
executable discovery in environments without the separate LAS access and key.
This does not restrict its image-to-video, multimodal-reference, or extension
workflows.

## Specialized workflows still closed

One public model-mode pair remains intentionally absent from MCP execution:

| Model | Mode | Why it remains closed |
| --- | --- | --- |
| Gemini Omni Flash | `retake` | Requires a stored provider interaction identifier; exposing a raw provider identifier would break the transport-neutral contract. |

LTX 2.3 audio-to-video and retake, the Luma Ray reframe modes, and Kling 2.5
Standard now use verified MaxVideoAI assets, exact canonical pricing, and the
existing website execution pipeline. They therefore remain subject to the same
provider configuration and runtime availability as the website.

`tests/mcp-special-video-modes.test.ts` is the drift guard. It fails when a new
app-published mode is not represented by the canonical MCP contract or by the
explicit closed list above.

## Prelaunch access

The seven P0 video identities can be exercised before publication only by the
existing production staging canary: exact staging host, allowlisted account ID,
and allowlisted OAuth client ID must all match. The private access set is
derived from the canonical P0 pricing scenarios and rechecks that every model
is still current and app-unpublished. It is used only for an exact known ID in
details, project budgeting, preparation, and confirmation. Public listing and
recommendation never receive it, and prelaunch details omit unpublished model
and example links.

Mode details normalize provider duration labels to executable numeric seconds;
provider-only values such as `auto` are never advertised as MCP inputs. The 23
P0 modes continue to derive settings, references, prices, and paid request
bodies from the shared engine, pricing, and site execution owners.
