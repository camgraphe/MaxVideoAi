# Commercial Video Agent V1 Mockup Design

## Goal

Create a simple, premium tool page for a first Commercial Video Agent. The V1 product creates one Seedance 2.0 commercial video up to 15 seconds. It should feel lighter than the current full workspace: a public chat on the left, a video preview/result on the right, and a compact pricing settings strip above them.

The page should sell and operate one clear workflow:

> Tell the agent what you want to promote. It asks only the missing questions, checks whether the request is possible, converts the request into a Seedance 2.0 prompt internally, then generates the video.

## Product Decisions

- V1 uses Seedance 2.0 only. Do not expose a Fast model toggle.
- The agent entrypoint is the chat, not a separate "Start agent" button in the settings strip.
- The initial chat agent is public and can explain the product, limits, and required inputs.
- Paid or credit-consuming work starts only after the user confirms from inside the chat flow.
- The user does not validate a scenario or storyboard in V1.
- The final Seedance prompt stays hidden by default.
- The right panel focuses on the resulting video, not a gallery or storyboard.
- Regeneration is the correction path when the result does not fit.

## Page Structure

The page keeps the existing MaxVideoAI header style:

- MaxVideoAI logo
- navigation: Generate, Video Agents, Pricing, Library
- credits balance
- account menu

Main content is centered and intentionally restrained. It should not fill every part of the viewport.

Title area:

- title: "Commercial Video Agent"
- subtitle: "Create one Seedance commercial video up to 15 seconds."

Settings strip:

- static model label: "Seedance 2.0"
- duration segmented control: 5s, 10s, 15s
- aspect ratio segmented control: 9:16, 16:9, 1:1
- resolution segmented control: 720p, 1080p
- audio toggle
- estimated price

The strip does not include a "Start agent" button. The commercial flow starts through the chat.

## Primary Layout

Use two refined vertical windows below the settings strip.

Left window: chat

- panel header: "Commercial Video Agent" with a small AI badge
- first assistant message: "Hi, ready to make a commercial video? What do you have in mind?"
- product image upload affordance near the input
- message input placeholder: "Describe your product, place, style, audience, CTA..."
- quick chips: "Premium product reveal", "UGC style", "Restaurant ad", "App promo"

Right window: video

- panel header: "Preview"
- vertical 9:16 placeholder by default, centered in the panel
- placeholder copy: "Your Seedance video will appear here"
- status row: "1 video • Seedance 2.0 • 10s • 9:16"
- result actions after generation: Regenerate, Make more premium, Download, Save

Keep the surrounding whitespace generous. Avoid rails, nested cards, multi-panel dashboards, visible storyboard lanes, and prompt editors in V1.

## Chat Flow States

### Initial Public State

The agent can answer what the tool does and guide the user. It should not create the final generation prompt yet.

Example behavior:

- explain that the tool creates one Seedance 2.0 commercial video
- explain the 15 second limit
- explain that duration, format, resolution, and audio influence the price
- ask the user what they want to promote

### Intake State

The agent extracts known information and asks only for missing fields.

Required or useful fields:

- product or offer
- location or scene context
- visual style
- target audience
- platform or usage context
- CTA
- required directives
- things to avoid
- optional product reference image

The agent asks one focused question at a time when possible.

### Feasibility State

Before generation, the agent checks for unsupported or unsafe requests.

The agent should block or ask for a rewrite for:

- nudity or explicit sexual content
- hate or harassment
- graphic violence
- real-person impersonation
- misleading medical, financial, or legal claims
- requests that depend on exact logo or readable text fidelity

For model limitations, use soft warnings rather than blocking when appropriate:

- exact product text and logos may vary
- very small text may be unreadable
- product consistency improves with a reference image but is not guaranteed

### Confirmation State

The confirmation happens in chat and is operational, not creative.

The agent summarizes:

- one Seedance 2.0 video
- selected duration
- selected aspect ratio
- selected resolution
- audio on/off
- estimated price or credits

The chat presents the generation CTA after this summary.

### Generating State

The chat indicates that the agent is preparing and generating the Seedance video. The video panel shows a loading state and progress/status text.

Do not show a storyboard approval step.

### Result State

The generated video appears in the right panel. The chat can offer short next actions:

- regenerate with changes
- make it more premium
- make it more realistic
- change the CTA
- download
- save to library

## Prompting Internals

The user-facing experience stays simple, but the backend should internally build a structured Seedance prompt from:

- product and offer
- reference image presence
- scene location
- visual style and mood
- audience and platform
- camera language
- product focus
- CTA intent
- avoid list
- duration, aspect ratio, resolution, and audio settings

For a product image upload, route to Seedance image-to-video. Without an image, route to text-to-video. Multi-reference workflows are out of scope for the first mockup.

## Quality Bar

The mockup should communicate:

- simple enough for non-expert users
- priced before generation
- guided by chat, not by a dense form
- clear video output area
- no prompt-engineering burden for the user
- no false promise of perfect logos or exact text

Visual requirements:

- compact typography
- 8px panel radius
- light borders
- mostly white and neutral gray
- restrained black primary actions
- subtle accent only where helpful
- no decorative gradient blobs
- no large hero composition
- no full workspace rail

## Out Of Scope For V1 Mockup

- model picker between Seedance 2.0 and Fast
- storyboard validation
- multi-scene film generation
- automatic editing or montage
- subtitles
- voiceover generation
- music generation
- public gallery
- prompt editor
- advanced provider settings

## Implementation Notes For Later

When implementation starts, keep the page route as an orchestrator and split the feature locally:

- `_components/CommercialVideoAgentChat.tsx`
- `_components/CommercialVideoPreview.tsx`
- `_components/CommercialVideoSettingsStrip.tsx`
- `_hooks/useCommercialVideoAgentFlow.ts`
- `_lib/commercial-video-agent-copy.ts`
- `_lib/commercial-video-agent-state.ts`

Server-side agent orchestration should live behind a route handler and should call the existing Seedance generation path rather than duplicating generation logic.

## Self-Review

- No unresolved placeholders remain.
- V1 scope is a single Seedance 2.0 video, not a full studio.
- The chat is the launch surface; no separate Start Agent button is required.
- The user does not approve storyboard or prompt in V1.
- The design keeps future expansion possible without burdening the first interface.
