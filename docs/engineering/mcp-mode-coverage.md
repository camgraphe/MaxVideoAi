# MCP model-mode coverage

This document records the public model-mode boundary exposed to compatible AI
clients. The authored model registry and engine input schemas remain the source
of truth; this file explains the MCP projection and must not duplicate prices.

## Current coverage

Checked 2026-09-03 against the canonical runtime registry and engine schemas.

MCP catalog and exact hidden-model resolution are read-only database paths. They
use `frontend/src/server/agent-api/read-only-engine-catalog.ts`, whose transitive
dependencies contain only configuration `SELECT` owners and pure projection.
They never run billing-schema bootstrap or engine-settings seed writes. The
transactional confirmation variant takes a share lock and reads the same two
configuration tables through the caller executor before selection; quote,
reservation, and provider mutations remain downstream of successful selection.
An authenticated prelaunch exact lookup may also resolve a current unpublished
runtime definition after the same access check. That fallback is configuration
only and is never consulted by default discovery or recommendations.

Default discovery and recommendations contain only current, app-published
models. An exact legacy ID remains available when its runtime route is ready,
but is marked non-default and includes its canonical successor ID and slug.
Exact deep-legacy or retired identities remain inspectable for migration and
are rejected by budget, preparation, and confirmation before pricing or spend.
Model links always use the registry slug.

A fully retired replacement may outlive its engine-catalog row. Exact details
then use the generated runtime identity (authored label, canonical ID/slug and
surface, plus the flattened current replacement target) and expose no modes,
capabilities, prompting sources, or URLs. Default list and recommendation still
omit it. This is a registry/runtime projection rule, not an MCP-owned retired
catalog.

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

Gemini Omni Flash is exposed under the stable `gemini-omni-flash` identity and
the visible 1.1 label. Its executable MCP projection is Google-direct only and
contains `t2v`, `i2v`, `ref2v`, `fl2v`, `v2v`, and `extend`. `fl2v` and `extend`
require owned MaxVideoAI assets whose persisted MIME type, file extension, byte
size, and applicable duration metadata pass the same generation-route checks as
the workspace. Raw media URLs cannot satisfy that contract.

## Specialized workflows still closed

One app-published model-mode pair and two unpublished prelaunch pairs remain
intentionally absent from MCP execution:

| Model | Mode | Scope | Why it remains closed |
| --- | --- | --- | --- |
| Gemini Omni Flash 1.1 | `retake` | Public MCP | Requires a private previous-interaction identifier; exposing it would break the transport-neutral contract. The authenticated workspace can retain that private interaction state. |
| MiniMax H3 Max | `i2v` | Public model, execution-gated mode | Trusted MIME type, extension, byte-size, and image-dimension enforcement has not been proven through the complete route. |
| MiniMax H3 Max | `ref2v` | Public model, execution-gated mode | Mixed image/video/audio references require trusted token metadata and complete per-type limits before the mode can execute. |

LTX 2.3 audio-to-video and retake, the Luma Ray reframe modes, and Kling 2.5
Standard now use verified MaxVideoAI assets, exact canonical pricing, and the
existing website execution pipeline. They therefore remain subject to the same
provider configuration and runtime availability as the website.

`tests/mcp-special-video-modes.test.ts` is the drift guard. It fails when a new
app-published mode is not represented by the canonical MCP contract or when the
explicit H3 Max execution-gated mode list changes without review.

## P1 public access

`kling-3-turbo-standard`, `kling-3-turbo-pro`, and `minimax-h3-max` are public
registry identities after the atomic P1 publication gate. Public MCP listing,
details, budgeting, preparation, and confirmation now resolve them through the
same public engine registry as the workspace. They are no longer members of
the private runtime or prelaunch-access sets.

Both Kling 3 Turbo tiers expose only `t2v` and owned-image `i2v`,
including their schema-derived multi-shot prompt contract. MCP metadata names
Kling by Kuaishou as the primary provider and serializes neither alternate
routes nor fallback implementation details. The direct route remains primary;
the narrowly tested depleted-balance response may fall back once before any
direct task is accepted.

MiniMax H3 Max exposes only executable `t2v` in public MCP. Its details contain neither a
Fal provider label nor a Fal endpoint. `i2v` and `ref2v` fail closed at the
executability boundary for the reasons recorded above; their theoretical
engine-schema presence is not projected as an executable capability.

Launch videos are a separate publication concern: the eight P1 media rows are
published as ordinary production gallery media and attached to their exact
model and family playlists. None has an editorial watch page or video-sitemap
entry; any later Video SEO enrollment must still use the normal admin SEO
workflow.

Mode details normalize provider duration labels to executable numeric seconds;
provider-only values such as `auto` are never advertised as MCP inputs. P0 and
P1 modes continue to derive settings, references, prices, and paid request
bodies from the shared engine, pricing, and site execution owners.
