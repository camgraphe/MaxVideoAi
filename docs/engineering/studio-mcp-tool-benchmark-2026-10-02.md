# Studio and MCP tool benchmark — 2 October 2026

## Decision and scope

Give the AI composable film-making capabilities with exact constraints. Creative direction, prompts and the choice of operations belong to the AI; validation, ownership, quotes, execution and saved state belong to MaxVideoAI. Studio uses its embedded Sol director; an MCP client uses its own agent. Both should reach the same business services through their respective authorized adapters.

Stop improving the current 25-second pilot film. Its media, editing and mixed export provide integration evidence, not creative acceptance. This document records public-source research and a read-only local audit at `7038a4b85248`. The recommendations below are not implemented by this documentation change. No external plugin was installed or invoked, and no provider generation was requested.

## Verified public references

| Surface | Evidence inspected | Boundary |
| --- | --- | --- |
| Higgsfield hosted MCP | [Official integration explanation](https://higgsfield.ai/creator-hub/help-center/integrations/what-is-higgsfield-mcp) and [official agent skills](https://github.com/higgsfield-ai/skills) | The connector is official; its server implementation and authenticated tool schemas were not inspected. |
| Higgsfield CLI/API | [Media-role contract](https://raw.githubusercontent.com/higgsfield-ai/skills/main/higgsfield-generate/references/media-inputs.md), [CLI model schemas](https://raw.githubusercontent.com/higgsfield-ai/cli/main/MODELS.md), [request lifecycle](https://docs.higgsfield.ai/docs/concepts/requests) | These are documented contracts, not proof that every operation is exposed identically through hosted MCP. |
| Runway hosted generation MCP | [Official plugin](https://github.com/runwayml/runway-mcp-plugin), [media instructions](https://raw.githubusercontent.com/runwayml/runway-mcp-plugin/main/skills/runway-media/SKILL.md) and [workflow instructions](https://raw.githubusercontent.com/runwayml/runway-mcp-plugin/main/skills/runway-workflows/SKILL.md) | Public client instructions describe tools; the hosted server implementation was not inspected. |
| Runway API MCP example | [README](https://github.com/runwayml/runway-api-mcp-server/blob/main/README.md) and [server implementation](https://raw.githubusercontent.com/runwayml/runway-api-mcp-server/main/src/server.ts) | The repository was archived on 30 September 2026. It is a code reference, not a current integration dependency. Runway's [Dev MCP](https://docs.dev.runwayml.com/guides/mcp/) is separately documented from its generation MCP. |
| Replicate MCP | [Official reference](https://replicate.com/docs/reference/mcp) | Documented model discovery and prediction operations; no authenticated execution was tested. |

The public skill files above were studied as source material. Their account, approval and execution instructions were not applied to this repository.

## Patterns to adapt

1. **Compact discovery, exact details on demand.** Higgsfield separates model/workflow listing from schema inspection. Runway's public API example describes model-specific parameter validation before outbound requests; its hosted workflow instructions obtain current model information through resources. Replicate documents model search/list/get separately from prediction execution. MaxVideoAI should project its existing canonical facts rather than place a second model table in the director prompt. [Higgsfield discovery](https://raw.githubusercontent.com/higgsfield-ai/skills/main/higgsfield-generate/SKILL.md), [Runway validation](https://github.com/runwayml/runway-api-mcp-server/blob/main/README.md), [Runway workflow resources](https://raw.githubusercontent.com/runwayml/runway-mcp-plugin/main/skills/runway-workflows/SKILL.md), [Replicate operations](https://replicate.com/docs/reference/mcp).
2. **Explicit reference roles and reusable outputs.** Higgsfield distinguishes start/end frames and image/video/audio references, with limits per model. Runway's hosted instructions allow previous task IDs as supported inputs. Adapt this to owned MaxVideoAI asset/output identities and canonical role names. A reference can guide a generation without becoming a timeline clip or necessarily its first frame. Each role must also have an executable resolver. [Higgsfield media contract](https://raw.githubusercontent.com/higgsfield-ai/skills/main/higgsfield-generate/references/media-inputs.md), [Runway media contract](https://raw.githubusercontent.com/runwayml/runway-mcp-plugin/main/skills/runway-media/SKILL.md).
3. **Assembly independent of narrative planning.** Higgsfield documents `explainer_video`, an assembler of caller-ordered video/audio pairs, separately from `video_explainer`, its broader workflow. The assembler does not generate the shots or narration. Our canonical timeline and renderer already provide the foundation for this separation; no replacement renderer is needed. Hosted Higgsfield MCP availability of that assembler remains unverified. [Assembler contract](https://raw.githubusercontent.com/higgsfield-ai/cli/main/MODELS.md).
4. **Durable jobs and truthful progress.** Runway's generation instructions return a task ID and observe completion separately. Higgsfield documents asynchronous request states, polling and webhook handling. Keep our existing accepted job identity, charge and recovery owners; return progress or failure rather than treating an accepted request as a finished asset. [Runway result handling](https://raw.githubusercontent.com/runwayml/runway-mcp-plugin/main/skills/runway-media/SKILL.md), [Higgsfield lifecycle](https://docs.higgsfield.ai/docs/concepts/requests), [polling](https://docs.higgsfield.ai/docs/concepts/polling).

These recommendations are inferences from the inspected contracts. Do not copy vendor model defaults, credit policy or a mandatory image-to-video sequence. For example, the archived Runway server's `runway_generateVideo` requires an image, while its current hosted plugin instructions describe text-to-video too: a published model list alone does not establish executable tool coverage. [Archived implementation](https://raw.githubusercontent.com/runwayml/runway-api-mcp-server/main/src/server.ts), [hosted instructions](https://raw.githubusercontent.com/runwayml/runway-mcp-plugin/main/skills/runway-media/SKILL.md).

## Local findings: retain, change, complete

| Area | Current evidence | Required change |
| --- | --- | --- |
| Generation and billing | Studio visual services call the shared `ForActor` prepare/confirm services. Audio likewise shares normalization, quote snapshots, reservation, execution, refund and recovery. | Retain these owners and human financial confirmation. No second price formula or wallet pipeline. |
| Capability details | MCP's details projection already describes mode settings, duration, resolution, audio policy and reference constraints. Sol's `catalog.read` exposes a reduced summary and filters video to Wan 3; there is no details action. | Share the reusable facts projection while preserving each adapter's authority and eligibility checks. |
| Generation choices | Sol fixes video to Wan 3 / 5 s / 480p / silent / `first_frame`; image preparation chooses its model and high/PNG/one output; voice and music also use fixed presets. | Keep useful defaults, but allow explicit valid choices within an executable, certified set. Persist the complete request across draft and resume. |
| Reference coverage | Studio visual services currently accept image references and only `t2i`/`i2i` or `t2v`/`i2v`. MCP has additional canonical mode/role coverage. | Extend action inputs, resolution and service validation together. Merely removing the Wan filter would advertise unsupported operations. |
| Timeline | Manual gestures and Sol share insert/trim/move/remove/gain commands, revision checks and receipts. Job-output insertion is currently restricted to accepted `studio-session` jobs from that project. | Add an authorized MCP adapter and appropriate owned-output resolution; do not pretend an OAuth actor is a Studio-session actor. |
| Montage/audio MCP | Preparation, persisted montage creation and audio services exist behind disabled publication flags. `prepare_montage` produces a plan, not a render. | Qualify executable paths before publication; preserve the distinction between plan, saved edit and exported media. |
| Export | The UI already estimates, confirms, dispatches and recovers real mixed exports. Sol has no export action; MCP has no timeline-edit/export tool. | Extract shared authorized orchestration from the existing estimate/submit routes and add thin adapters. Reuse manifest, price, token, reservation, job and worker owners. |

Code references: [capability projection](../../frontend/src/server/agent-api/model-details.ts), [capability validation](../../frontend/src/server/agent-api/generation-capability-validation.ts), [Studio visual services](../../frontend/src/server/studio/image-generation-service.ts), [image request builder](../../frontend/src/server/studio/image-conversation-service.ts), [conversation actions](../../frontend/src/server/studio/conversation-actions.ts), [media request builder](../../frontend/src/server/studio/conversation-media-generation.ts), [Audio services](../../frontend/src/server/studio/audio-generation-service.ts), [edit commands](../../frontend/src/server/studio/conversation-edit-command.ts), [publication gates](../../frontend/config/mcp-publication.json), [export owners](../../frontend/src/server/timeline-exports/).

## Implementation order

### Batch 1: inspect and choose executable capabilities

- Add exact capability inspection to Sol using the existing projection. Intersect the bounded pilot model/mode set, adapter executability, Studio certification and runtime availability. Distinguish unavailable runtime configuration from unsupported parameters.
- Parameterize preparation for that same set: canonical model/mode, supported settings and typed references. Omitted fields may receive defaults; explicit valid values must not be silently overwritten. The user should not need to supply a technical generation prompt.
- Extend image/media drafts, checkpoints and resume together so model, settings and reference roles survive a reload. Preparation must remain non-spending; confirmation must use the current scoped quote service.
- Establish adapter parity for equivalent supported requests and canonical prices. Keep publication flags unchanged in this batch. Extending to video/audio reference modes requires their resolver/service work before discovery advertises them.

### Batch 2: complete editing and export through both adapters

- Retain canonical timeline commands and add real OAuth/project ownership handling for MCP edits and reused outputs.
- Give Sol and MCP export preparation, human confirmation and owned job observation through the existing renderer pipeline. An export is a snapshot of a saved sequence, not another generation request.
- Correct the bounded multi-action turn that can insert music then stop before setting gain. Preserve completed receipts and remaining work at the checkpoint; do not claim a control is absent because the turn budget ran out. Keep measured token/cost limits.
- Qualify Audio and montage publication separately. No publication flag should substitute for provider/runtime readiness.

### Batch 3: client qualification and release

Coordinate with Pricing through canonical quote owners. Define customer conversation usage/caps, qualify physical devices and account recovery, complete production/preview credential rotation, and review migrations/rollback before rollout. Existing client URLs, legacy Studio projects and unrelated Pricing work remain under their current owners. Advanced effects and creative recipe packs can follow the executable primitives.

## Focused acceptance checks

English is the primary test language. These scenarios test tool contracts and truthful behavior, not whether a particular film is artistically good:

| Client request | Required evidence |
| --- | --- |
| “Hi, I'm new here. What can I make?” | Useful guidance from available capabilities without triggering a generation. |
| “I have product photos. Can you make a cheap short ad?” | Sol writes prompts and selects supported operations; reference role and exact quote agree with the canonical request. No hard-coded requirement to animate every photo. |
| “Use this supported duration and resolution.” | Explicit values persist through preparation/reload; unsupported combinations fail before spend or provider submission. |
| “Shorten the first clip and move the next one earlier.” | Saved frame-aligned commands and receipts; a concurrent manual edit causes a useful revision conflict rather than lost work. |
| “Add the music and keep the voice easy to hear.” | All requested supported edits finish, or the response truthfully identifies remaining work. Reload preserves separate tracks and gain. |
| “Finish and export it.” | Current saved revision and exact estimate, human confirmation, then recovery of one accepted job and its recorded price. |

For Batch 1, update/run the existing `studio-conversation-actions`, `studio-media-conversation`, `studio-image-model-contract`, `mcp-model-details`, `mcp-generation-capabilities`, `mcp-prepare-generation` and `mcp-confirm-generation` tests. PostgreSQL scope/run tests must cover Studio project identity, OAuth separation and complete checkpoint persistence. Add adapter-parity coverage for equivalent requests/prices, rejected roles/settings, and absence of spend/provider submission during preparation. Most checks can use fixtures and canonical services; another paid demo film is not required.

The documentation-only change was checked for local links and whitespace. It does not constitute a fresh application test run or qualification of the proposed tools. Current delivery evidence and outstanding operational work remain in [the resume brief](studio-conversation-resume-brief.md) and [pilot readiness](studio-conversation-pilot-readiness.md).
