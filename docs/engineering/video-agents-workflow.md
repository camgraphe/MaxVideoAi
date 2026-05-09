# Video Agents Workflow

This guide documents the local architecture for the first MaxVideoAI Video Agents prototype.

## Product Boundary

Video Agents is a first-class app family, separate from direct Generate Video and Generate Image flows.

- Generate Video: direct prompt and manual model controls.
- Video Agents: guided workflow that turns a client request into a model-specific production package.
- V1 agent: Commercial Video Agent.
- V1 video engine: Seedance 2.0.
- V1 mode: text-to-video only.
- V1 output: final prompt package for manual testing, not a provider generation call.

## V1 Pipeline

The prototype flow uses a server-side LLM layer with deterministic local fallback:

```text
public chat
-> nano intake agent, with local extractor fallback
-> safety and feasibility review
-> confirmation summary
-> user confirms
-> mini prompt writer, with local Seedance prompt fallback
-> reviewer checklist
-> visible prompt package
```

The final prompt package is created only after the user confirms in chat. This preserves the future payment boundary: pricing can be shown before confirmation, but the expensive agent/provider sequence must not start before explicit consent.

The V1 route is `frontend/app/api/video-agents/commercial/chat/route.ts`. It owns OpenAI calls and falls back to the local deterministic helpers when `OPENAI_API_KEY` is missing, the model is unavailable, or the API returns invalid JSON. Client files must not import the OpenAI SDK.

## Prompt Package Contract

The V1 output should include:

- `agent`: `commercial-video`
- `videoEngine`: `seedance-2.0`
- `imageEngine`: `null`
- `mode`: `text-to-video`
- `settings`: selected duration, aspect ratio, resolution, audio, estimated price, engine label
- `clientBrief`: structured client request
- `structuredScenario`: category, intent, timeline beats, camera, lighting, mood, composition, audio direction, final frame
- `finalPrompt`: English Seedance-ready prompt
- `negativePromptOrAvoid`: compact avoid list
- `warnings`: safety, legal, provider, text, or logo risks
- `reviewChecklist`: quality and safety booleans

## LLM Strategy

The app keeps orchestration models configurable.

- Intake/classifier model: `gpt-5.4-nano`
- Prompt writer model: `gpt-5.4-mini`
- Reviewer model: `gpt-5.4-mini`
- Premium/rewrite model: `gpt-5.5`

The intended agent split is:

- global public chat: explain Video Agents and route the user to the right agent
- intake agent: extract the brief and ask one missing-field question at a time
- scenario agent: reduce the request to realistic short-video beats
- engine prompt writer: adapt the scenario to the selected video engine
- reviewer: check duration fit, safety, brand/IP risk, CTA, camera, and prompt clarity

The chat UI also enforces a small minimum visible latency. Instant replies read as fake; the user should see the agent think for roughly one second during intake and longer during prompt writing, while still skipping extra delay when the real API call already takes longer.

## Seedance 2.0 Doctrine

Seedance prompts should be short, structured, and visual:

- one main subject
- one clear product action
- one primary visual style
- one coherent camera language
- explicit duration timeline
- explicit aspect-ratio composition
- clear lighting and mood
- short final CTA
- compact avoid list

Duration rules:

- 5s: one action, up to 3 beats
- 10s: hook, action, benefit/CTA
- 15s: mini commercial, up to 5 beats

Avoid long readable text, exact logos without references, celebrity likeness, protected IP, medical/financial guarantees, overcrowded scenes, and too many camera movements.

## Seedream Future Path

Seedream belongs to a separate future image-preparation stage, not the V1 text-to-video path.

Future workflow:

```text
client brief
-> product or continuity asset needed?
-> Seedream image preparation
   -> product reference
   -> style reference
   -> character or creator continuity reference
-> Seedance or other video engine prompt
-> provider generation
```

Keep this as `imageEngine` or `imagePreparation` metadata in future prompt packages. Do not expose Seedream controls in the V1 Commercial Video Agent UI until image/reference mode is actually supported.
