# Connected Toolbox — implementation plan

**Goal:** ship a visual, usable MaxVideoAI toolbox with reusable media contracts and the existing working tools.
**Architecture:** a browser-safe capability catalogue feeds standalone and Studio placements. Existing tool services retain authorization, pricing, provider calls and persistence. Tool UI separates source, controls and result; it never invents provider qualification.
**Stack:** Next.js, React, TypeScript, existing SWR/auth/library, CSS modules, original SVG illustrations.
**Specification:** delegated user brief in task 01a07e3c-37a3-7691-a1c1-497e34094416 and `docs/design/global-app-concept/integration-contract.md`.

## Provenance and convergence

- Research copied without edits from `/Users/adrienmillot/Desktop/MaxVideoAi V2/docs/plans/2026-09-07-maxvideoai-toolbox-discovery-brief.md`, updated 8 September, task `01a07dd1-19cc-7430-bf1b-8f09f70cdf00`.
- Versioned copy: `sources/2026-09-08-toolbox-discovery.md`; SHA256 `6cd5279eb3f1fac10613df73a99800175c12324af662788853590f55bbf37798`. Research prices/capabilities are unqualified historical notes.
- Initial HEAD `ab2cb9fbd`; isolated branch `codex/connected-toolbox`. Merge `059a5f0fa` composes app source `cf5acc60f` with newer main fixes. No source worktree edited. This shared ancestry avoids selectively omitting media handoff/account protections; new toolbox commits follow the merge separately.
- Studio agreed ownership on 8 September: toolbox owns identities/eligibility/standalone reusable surfaces; Studio owns project/canvas/timeline adapters, persistence and existing SFX. Main owns global app, creators, draft continuity and final integration.

## Action inventory

| Action | Input | Controls | Quote/execution owner | Result and reuse |
|---|---|---|---|---|
| Upscale image | uploaded, library or HTTP image original | factor/target, format; existing implementation in advanced choice | `upscale-pricing-context.ts` / `runImageUpscaleTool` | persisted image, source/result/wipe and pixel zoom, download/save/reference |
| Upscale video | uploaded, library or HTTP video original | factor/target, format; existing implementation in advanced choice | `upscale-pricing-context.ts` / `runVideoUpscaleTool`; server video probe | persisted video, native original/result readers, download/save/reuse |
| Remove background | video only, max 60s | transparency/solid color, container/codec, preserve audio | `background-removal-pricing-context.ts` / `runBackgroundRemovalToolBase` | persisted output, original/result switch; transparent preview only for compatible format; original intact |
| Character Builder | prompt and optional image identities/styles | traits, eight views, existing generation/edit controls | existing Character Builder service/canonical billing | sheets/views and generation reference reuse |
| Storyboard | story/prompt and optional image references | sequence/shot/edit workflow | existing Storyboard service/canonical billing | editable board and shot images |
| Angle | one image | rotation/tilt/zoom and existing multi-angle choices | existing Angle service/canonical billing | alternate image views with original retained |
| Audio context | audio asset | no supported quick tool currently | no new audio provider route | explicitly no eligible quick tools; keep Audio creator/Studio SFX separate |

Gaps found: Upscale can submit without a ready preview; client estimates can outlive metadata/engine changes. Background removal controls can mutate while a run is pending; its empty player displays fictional timing. Both standalone pages are form-heavy, lack a common reusable frame, and need explicit contextual reuse.

## Visual specification

Open workspace, compact title + media filter, three compact quick-action cards (image upscale, video upscale, video cutout). Each has an authored figurative scene: magnified landscape detail, sequenced film frames, or subject lifted from a checkerboard. Label illustrations as illustrations; never counterfeit a processed comparison. Below, three wide workshop covers use the existing photographic assets/illustrated board. No inactive tool-looking cards for speculative capabilities.

Opened tools share a concise back/title row, a large central preview, compact input/settings rail and one price/action area. Empty preview contains the tool's scene and a source action; result shows actual media and explicit original/result controls. Safran selection, warm charcoal/off-white tokens, 44px controls, visible keyboard focus, 120–180ms only on user interaction, reduced-motion override. Mobile uses source → preview → controls/result actions without fixed elements covering content.

## Implementation sequence

- [x] **Shared contract commit.** Add `frontend/src/lib/toolbox/{catalogue,contract}.ts`, typed media identity (`asset` vs `job-output`, kind), versioned settings/output lineage and pure eligibility validation. Add tests rejecting wrong kind, unsupported version, invented output IDs and speculative tools. Publish additive integration guide to Studio. No stored project migration and no provider endpoints in blocks.
- [x] **Visual catalogue commit.** Replace hand-authored five-card list with capability projection and reusable `ToolboxCatalogue`; add original SVG scenes, localized labels, image/video/audio context and distinct workshop composition. Routes stay stable. Verify DOM actions and feature gate.
- [x] **Connected workbench commit.** Recompose Upscale and Background Removal around a reusable surface. Retain provider-specific useful controls in advanced settings, input import/library, original/result/download/save/reuse. Guard concurrent source changes and account scope. Remove fictional playback/progress. Keep workshop workflows reachable and coherent.
- [x] **Quote correctness commit.** Add a read-only server quote adapter using existing pricing owners and matching normalization. Bind displayed quote to exact inputs; disable run while stale/loading/error. Revalidate amount before charging for callers that supply an accepted quote. No multiplier/policy changes or job migration.
- [x] **Qualification and delivery.** Run relevant contracts, types, frontend lint/exposure and build. Use local fixture transport for paid actions, never real processing. Browser desktop/mobile light/dark, source selection, keyboard, result/reuse, errors and changing prices. Keep a usable isolated preview on a free port other than 3026/3032; document fixture limits. Send commits and evidence to Studio and parent task.

## New tools and MCP

Prepare capability schemas and release gates for Denoise, Fix Blur, Smooth Motion and Clean Audio; status remains qualification-required and excluded from active catalogue/execution. Restore is not a silent generative substitution; Smart Reframe must distinguish crop from generated fill. Bria pricing reconciliation and any 2.5× policy belong to a separate commercial review. No new prices asserted from research.

Current MCP has model discovery/generation, uploads/media and job status; it does not execute these quick tools. Share pure catalogue/validation now; do not advertise MCP execution before exact preparation/confirmation/idempotency has an implemented adapter. Montage MCP remains Studio-owned. Existing app tool routes keep their job surfaces and server billing authority.


## User simplification pass, 8 September

Quick tools are approximately 180–210px wide on desktop and two columns on phones. The catalogue now shows covers and names only; workshop covers stay larger. Workbenches omit slogans, empty histories and repeated explanations. Import/Library are compact actions, one primary adjustment stays visible, Options contains secondary controls, and the price lives on the launch button. Save/download use accessible icon actions. No production action or paid generation was run.

Validation and precise integration order: `2026-09-08-toolbox-validation.md`.
