# MCP model-mode coverage

This document records the public model-mode boundary exposed to compatible AI
clients. The authored model registry and engine input schemas remain the source
of truth; this file explains the MCP projection and must not duplicate prices.

## Current coverage

Fal-primary MCP video execution uses enqueue-only submission from the trusted
paid continuation. Provider-ID tracking completes before acceptance; webhook
and cron owners finish the job. Keep this separate from the site's synchronous
subscription: MCP's 120-second request lifetime cannot contain long renders.
`frontend/server/fal-poll-timing.ts` owns the bounded timeout policy (90 minutes
for H3, 55 minutes for other Fal engines); terminal errors remain refund-eligible.

H3 `ref2v` image fields publish `imageAspectRatio` bounds of 0.4–2.5 and require
an owned asset. Validate stored dimensions before an exact MCP quote and again
at execution, using the shared media-field constraint helper. Never trust
client dimension claims or silently crop references. See the
[7 September incident audit](../operations/minimax-h3-mcp-incident-20260907.md).

Checked 2026-09-22 against the canonical runtime registry and engine schemas.

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

Seedance 2.5 uses the existing ModelArk account and key for all five modes when
`SEEDANCE_2_5_EDIT_TRANSPORT=modelark` and the reviewed Edit flag is enabled.
ModelArk Edit includes 1080p. Environments explicitly retaining LAS preserve
its separate access, key and narrower resolution requirements.

Gemini Omni Flash is exposed under the stable `gemini-omni-flash` identity and
the visible 1.1 label. Its executable MCP projection is Google-direct only and
contains `t2v`, `i2v`, `ref2v`, `fl2v`, `v2v`, and `extend`. `fl2v` and `extend`
require owned MaxVideoAI assets whose persisted MIME type, file extension, byte
size, and applicable duration metadata pass the same generation-route checks as
the workspace. Raw media URLs cannot satisfy that contract.

## Specialized workflows still closed

One app-published model-mode pair remains intentionally absent from MCP execution:

| Model | Mode | Scope | Why it remains closed |
| --- | --- | --- | --- |
| Gemini Omni Flash 1.1 | `retake` | Public MCP | Requires a private previous-interaction identifier; exposing it would break the transport-neutral contract. The authenticated workspace can retain that private interaction state. |

LTX 2.3 audio-to-video and retake, the Luma Ray reframe modes, and Kling 2.5
Standard now use verified MaxVideoAI assets, exact canonical pricing, and the
existing website execution pipeline. They therefore remain subject to the same
provider configuration and runtime availability as the website.

`tests/mcp-special-video-modes.test.ts` is the drift guard. It fails when a new
app-published mode is not represented by the canonical MCP contract or when the
H3 Max owned-media modes stop being executable without a corresponding review.

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

MiniMax H3 Max exposes executable `t2v`, `i2v`, and `ref2v` in public MCP. Its
details contain neither a Fal provider label nor a Fal endpoint. Image-to-video
accepts a start frame, end frame, or both. Text and image generation accept an
owned audio reference as the target soundtrack. Reference generation accepts
owned images, videos, and audio, including audio alone. The mode details project
MIME types, extensions, byte-size limits, durations, and alternative required
references from the shared schema. Target soundtracks do not inherit the combined
reference-audio duration limit.

H3 Max reference quotes use the shared `calculateMinimaxH3MaxReferenceTokenBudget`
supplier-cost budget and the canonical commercial policy. This fixes the customer
price before approval; it does not claim to reproduce the provider's exact token
invoice. The adapter feeds only account-owned persisted dimensions and durations,
never raw URL claims or caller token counts. Confirmation resolves and validates
the same assets again before repricing and reserving funds. The budget tool has
only reference roles, so its H3 Max `ref2v` lines return an actionable request to
prepare a quote with actual owned assets instead of inventing metadata.

Wan 3 and Wan 3 Prime document and webpage references use the canonical
`documentUrl` and `webpageUrl` settings. They map to the existing provider fields,
require controlled HTTPS URLs, remain mutually exclusive, and require prompt
expansion. `enablePromptExpansion` is schema-derived. A document or webpage can
satisfy reference mode without a media attachment. Image-to-video's `source`
role resolves the authored start-image field alongside `first_frame`.

Wan 3 and Wan 3 Prime video-reference, edit, and extension quotes include input
video seconds as well as generated seconds. MCP derives `inputVideoDurationSec`
from account-owned persisted durations, counting each storage URL once, and
repeats this derivation at confirmation. Raw video URLs and missing duration
metadata cannot create an exact quote. Image/audio-only requests have zero input
video seconds. The project-budget tool cannot classify or measure its role-only
reference placeholders, so those Wan modes return `REFERENCE_REQUIRED` with a
route to `prepare_generation` and actual assets. Text/image-only mode estimates
remain available. This follows the input-plus-output billing documented in
[Alibaba Model Studio pricing](https://www.alibabacloud.com/help/en/model-studio/model-pricing).

Launch videos are a separate publication concern: the eight P1 media rows are
published as ordinary production gallery media and attached to their exact
model and family playlists. None has an editorial watch page or video-sitemap
entry; any later Video SEO enrollment must still use the normal admin SEO
workflow.

Mode details keep `durationSec` positive and numeric. Current Seedance modes
that support Auto additionally advertise `durationOption: "auto"`; canonical
pricing fixes the billed duration at 15s (2.0) or 30s (2.5), while the provider
receives -1. Source-preserving 2.5 Edit keeps its verified source timing. Auto
aspect pricing uses the highest current exact tariff among the six documented
formats, or the verified source class when framing is inherited. Unsupported
arbitrary inherited framing fails closed until its pricing domain is reviewed.

Seedance output settings expose `outputFormat` through the shared creative input
schema; MOV selection belongs to 2.5. Optional AI watermark and return-last-frame
controls were retired on 2026-10-24 across the site, MCP and Studio. Saved/reused
values are dropped before new submission, including native Draft finalization.
BytePlus video/image payloads force optional watermark off and omit last-frame
extraction. Provider-required provenance markers are unaffected. Existing original
downloads, compatible playback and already-produced last-frame JPEGs remain
distinct owned artifacts. P0 and P1 modes continue to derive settings,
references, prices and paid request bodies from the site execution owners.

Numeric mode settings also project their authored `step`. Custom image modes
project the five public `imageSize` limits (pixel multiples, total pixel bounds,
maximum edge and aspect ratio) from the same input schema. Studio uses this exact
projection. Never infer arbitrary custom dimensions from min/max alone, silently
round a client size or weaken canonical validation: a supported predefined size
may remain valid even when those dimensions are invalid as a custom request.
`tests/mcp-model-details-custom-size.test.ts` guards this distinction and parity.

## Native Seedance Draft workflow — 2026-10-18 source candidate

Seedance 2.5 details include `seedanceWorkflow`: live MCP/web availability,
compatible executable modes and their native `modeDetails`, native 480p single-output constraints, inherited
1080p finalization, the conservative seven-day validity boundary and assistant
choice guidance. Ordinary `resolution=480p` remains ordinary generation.
The workflow uses the existing server release switch and paid-generation gate;
it does not enable either. Missing independent tariffs refuse quotation.

`prepare_generation` accepts an additive optional `seedanceWorkflow` discriminator:
`{"step":"draft"}` selects native Draft; `{"step":"final","draftJobId":"…"}`
resolves an account-owned ready Draft and inherits creative facts. Final requests
can omit mode, prompt, settings and references. Each step has its own exact quote,
hash, expiry and explicit `confirm_generation` approval. No provider task ID is
accepted or returned. The final reserves the parent in the wallet/job transaction;
competing quotes cannot both charge. Expiry and changed parent facts are rechecked
before debit. Submitted quotes recover their existing job even after a gate closes.

Status/history label workflow lineage; full status adds current eligibility,
actual `expiresAt`, `finalJobId` and `finalizationAvailable`. A pending, failed,
expired or already reserved Draft cannot start another final. The existing
refund reconciliation alone can release a fully refunded failed final; ambiguity,
partial refunds and reconnect never authorize replacement work. Original Draft
media and both receipts remain separate.

`seedanceWorkflowPrices` presents the actual Draft charge, final supplement and
same-currency total when available. A prospective final price is a current
canonical estimate, not a second quote or price reservation. Final preparation
returns the new exact final quote and the stored Draft charge. Missing prices are
null, never zero or ordinary-tariff fallbacks. Discovery and skills make no free
finalization, pixel-for-pixel or unverified-savings claim.

Native readiness is computed per selected mode using ModelArk credentials and
the operator mode allowlist. It does not inherit the ordinary LAS Edit gate or
require the unrelated t2v mode to be enabled. Ordinary `publicModes` remain
unchanged; the workflow capability adapter projects ModelArk mode caps separately.
The public-engine policy stays a pure leaf. Current native mode readiness also
participates in quote catalog revisions.


## Modify / Extend parity — 23 October 2026 candidate

The web controls, canonical model details and Studio use
`lib/video-workflow-capabilities.ts` for source timing and framing. Modify can
inherit measured duration (Omni/Luma and Seedance 2.5 ModelArk) or request its own
output duration (including Seedance 2.5 LAS); Extend retains each model's declared
output duration and continuation/combined-output contract. Canonical preparation
resolves omitted inherited duration from an owned, verified source before pricing.
The integer dispatch placeholder must not replace fractional source pricing facts.

The canonical settings and paid request adapter also carry Kling `keepAudio`,
Veo `audioSetting`, `personGeneration`, `compressionQuality` and Omni prompt audio,
camera and edit-direction controls as free text, plus FLUX Extend safety tolerance. Only settings declared for that model and mode
are accepted. Studio preserves the canonical per-role Modify/Extend reference
capacities; the shared transport ceiling is 66 (64 Luma keyframes, guide and source),
while per-model counts, combined budgets and source checks remain authoritative.

Seedance's recognizable-person advisory is shared by web reference controls,
canonical details/prepared quotes and Studio quote cards, including Extend. It is
informational and does not disable a mode. The four paid reference trials all
returned the provider's person-reference rejection; this is not proof that every
future reference will be rejected.

`config/video-modify-review.json` records the owner's preference from one iPhone
noir-edit trial: Luma, Wan 3 Prime, Kling Pro, Wan 3, Kling Standard, Omni. Live mode
details expose its basis and scope. Recommendations use it only for Modify, after
explicit choices and requested priorities, with the existing availability and
capability filters and a 90-day review window. It does not publish admin models,
rank Extend, certify identity preservation or establish relative prices.

`tests/video-workflow-surface-parity.test.ts` covers discovery, Studio projection,
canonical requests and paid-body forwarding; the composer DOM matrix covers every
authored Extend mode. Host catalog refresh after server delivery is separate from
these source checks; no installed plugin release is implied.

## Kling Omni operations (2026-10-24)

`v2v` keeps its historical Reference meaning when `operation` is omitted.
Explicit `kling-reference` has the same Standard/Pro tariff selector; it does not
rewrite omitted-operation canonical JSON or historical receipts. `kling-edit`
selects a full source-timed schema: owned 3–15s source, required prompt, optional
reference images and `keepAudio`, with no requested duration or aspect ratio.
The shared operation details project those inputs to Site, MCP and Studio.
Standard/Pro/4K Edit and new 4K Reference select their verified fal endpoints;
there is no Kling Extend or inferred direct 4K route. Legacy Reference keeps its
conservative 3–10s contract; this change does not widen direct transport limits.

New operations bind operation, fal endpoint and trusted source metadata to the
quote. They require separate active reviewed customer tariffs, even when the
legacy pricing policy is active. Missing cells fail closed. The read-only
`server/pricing/kling-operation-tariff-proposal.ts` prepares 16 exact selector
classes (three fractional source-second Edit classes and thirteen requested
3–15s 4K Reference classes), tied to the loaded tariff revision. It neither
copies Reference retail prices nor writes or activates cells. The dated public
supplier rates are Standard Edit $0.126/s, Pro Edit $0.168/s, and 4K $0.42/s;
they are published endpoint reference rates, not verified effective invoices.
Generic Standard/Pro $0.14 base metadata does not replace them.

Site retains its existing owned Kling Elements. Canonical MCP and Studio now
compose Elements with typed `elements` entries: `{kind: "images", frontalSlot,
referenceSlots}` (one to three supporting slots), or `{kind: "video", videoSlot}`.
Slots are the zero-based ordered `role: "reference"` entries and must resolve to
owned assets, never HTTPS references or provider IDs. Studio uses its existing
attached-library and ready-project-output checks and promotion owner. Element
slots are removed from ordinary guidance images; at most three Elements and four
Elements plus guidance images are allowed. Every member is owner-resolved again
at confirmation, and its exact resolved metadata is quote-bound to prevent media
substitution. Stored intents and canonical requests retain the typed composition.
The MCP schema and Studio director/pricing schemas expose the same composition;
model operation details describe it. No second ownership or grant path exists.

### Operation discovery and source-fact handoff

Mode discovery evaluates the authored operation alternatives through the real
provider routing and credential gates. An available alternative publishes the
mode; request admission still checks only the selected operation. FLUX source
operations and H3 Recast/Relight require explicit operation identity. Historical
Kling Reference omission and inferred standard LTX 2.3 Reframe remain unchanged.

Owned-source validation returns its qualified facts through both the attachment
and trusted-reference projections. A byte probe supersedes stored duration for
FAST/LTX and H3; later duration-limit checks must consume that projection rather
than reload stored timing. Site preflight normalizes inferred operations before
selecting exact source seconds, matching execution and canonical quotation.
`tests/video-operation-source-seams.test.ts` connects the executable catalogue,
prepare admission, normalized attachments, Site preflight, source execution guard
and canonical customer billing with only storage/probe/policy I/O substituted.
It includes credential rejection, source identity mismatch, busy/invalid probes,
missing stored timing, fractional customer-cent transitions and strict FAST bounds.
