# Veo 3.1 – AI Text-to-Video & Image-to-Video in MaxVideoAI (720p/1080p, 4–8s)

> Goal: make this the definitive, high-intent resource for Veo 3.1 in MaxVideoAI, with clear specs, examples, sequenced prompts, best-practice tips, and strong CTAs.

---

## Hero

**Veo 3.1 – Cinematic AI Video with Native Audio & Framing Control (4–8s, 720p/1080p)**  
720p/1080p · 4–8s · Text or Image input  
Generate short, cinematic videos with Google DeepMind's Veo 3.1 directly inside your MaxVideoAI workspace. MaxVideoAI gives you instant access to Veo text-to-video and image-to-video, with transparent per-second pricing and Cinematic Controls for framing, tone, and motion. [oai_citation:0‡MaxVideoAI](https://maxvideoai.com/blog/veo-3-updates)  
Describe the scene, choose a duration (4, 6 or 8 seconds), pick 16:9, 9:16 or 1:1, decide whether you want native audio, and let Veo 3.1 generate polished footage for ads, explainers, campaigns, and client work. [oai_citation:1‡Skywork](https://skywork.ai/blog/veo-3-1-capabilities-resolution-duration-use-cases-2025/)

**Primary CTA**  
➡️ **Start generating with Veo 3.1**

**Secondary CTA**  
Compare **Veo 3.1 vs Veo 3.1 Fast** →

Audio on · 8 s  
Veo 3.1 – Cinematic 8-second spot with framing presets and native audio  
Logline: An 8-second hero shot of a premium product on a tabletop, with a slow dolly move, branded color grade and a clean sonic logo on the final frame.  
【View render →】

---

Why Veo 3.1 is powerful inside MaxVideoAI:

- Text → Video, Image → Video and multi-image reference in one place  
- Cinematic Controls for framing, tone and motion before you hit render [oai_citation:2‡MaxVideoAI](https://maxvideoai.com/blog/veo-3-updates)  
- Native audio (dialogue, ambience, SFX), with an audio on/off toggle in the UI [oai_citation:3‡blog.google](https://blog.google/technology/ai/veo-updates-flow/)  
- Seed and Extend options to keep framing consistent and grow longer sequences over multiple 4–8s beats [oai_citation:4‡Skywork](https://skywork.ai/blog/veo-3-1-capabilities-resolution-duration-use-cases-2025/)  
- Pay-as-you-go pricing – you only pay for the seconds you generate  
- Available in Europe, UK and worldwide via licensed DeepMind endpoints – no separate Veo subscription required [oai_citation:5‡MaxVideoAI](https://maxvideoai.com/blog/compare-ai-video-engines)  
- Designed to sit alongside Sora 2, Sora 2 Pro, Pika 2.2, Kling, Wan, MiniMax Hailuo, Nano Banana, etc., so you can A/B the same script across engines

Best use cases

- High-end brand hero shots and product reveals  
- Campaign assets that need consistent framing and tone over many variants [oai_citation:6‡MaxVideoAI](https://maxvideoai.com/blog/veo-3-updates)  
- Social ads in 9:16, 16:9 or 1:1  
- Short explainers, education clips and cinematic B-roll  
- Film pre-viz and concept tests where camera language matters

---

## What Veo 3.1 Actually Is in MaxVideoAI

On paper, Veo 3.1 is Google DeepMind's latest short-form video model with richer audio and tighter prompt adherence. [oai_citation:7‡blog.google](https://blog.google/technology/ai/veo-updates-flow/)  
In practice, the way it behaves for you depends on how it is wired into MaxVideoAI.

In MaxVideoAI, Veo 3.1 is exposed as a controlled, production-ready engine:

- Clip length options: 4 s, 6 s, 8 s per generation  
- Output resolutions: 720p or 1080p (24 fps cinematic cadence) [oai_citation:8‡Skywork](https://skywork.ai/blog/veo-3-1-capabilities-resolution-duration-use-cases-2025/)  
- Formats: 16:9 (landscape), 9:16 (vertical), 1:1 (square)  
- Inputs:  
  - Text → Video  
  - Image → Video  
  - Text + 1–4 reference stills to lock identity, wardrobe and lighting [oai_citation:9‡MaxVideoAI](https://maxvideoai.com/models/veo-3-1)  
- Audio: native audio on by default (VO, ambience, SFX) with a toggle to generate silent clips when you only need visuals  
- Controls: framing presets (close-up / medium / wide), motion cues, tone presets, seed + extend controls in the advanced panel [oai_citation:10‡MaxVideoAI](https://maxvideoai.com/blog/veo-3-updates)

MaxVideoAI wraps all of this in a simple flow:

1. Pick Veo 3.1 as the engine.  
2. Choose Text → Video or Image → Video.  
3. Set duration (4/6/8 s), aspect ratio, and resolution (720p or 1080p).  
4. Choose framing/tone presets, then paste a structured prompt.  
5. See the final price per clip before you generate.  
6. Compare against other engines in the same GUI.

---

## Real Specs – Veo 3.1 in MaxVideoAI (720p/1080p, 4–8s)

> These specs describe Veo 3.1 exactly as you can use it today via MaxVideoAI – not theoretical lab demos.

### Duration & Output

- Durations: 4 s, 6 s, 8 s  
- Output resolution:  
  - 720p (1280x720)  
  - 1080p (1920x1080)  
- Frame rate: 24 fps cinematic cadence (good for ads, explainers and social) [oai_citation:11‡Skywork](https://skywork.ai/blog/veo-3-1-capabilities-resolution-duration-use-cases-2025/)

### Aspect Ratios

- 16:9 – classic horizontal / YouTube / web video  
- 9:16 – vertical / TikTok / Reels / Shorts  
- 1:1 – square / feed placements and carousels  

All three are supported in Text→Video, Image→Video, and Text+reference workflows.

### Inputs & File Types

- Text prompts  
  - Works best with concise, cinematic descriptions written like a shot list – not a random stack of adjectives.  
  - Use 1–3 sentences for single-beat clips, or a short "Shot 1 / Shot 2 / Shot 3" structure for 8s sequences. [oai_citation:12‡Google Cloud](https://cloud.google.com/blog/products/ai-machine-learning/ultimate-prompting-guide-for-veo-3-1)

- Reference images  
  - File types: PNG, JPG, WebP (GIF/AVIF support depends on your upload pipeline)  
  - Max size per image: ~10 MB (workspace limit)  
  - Up to 4 reference images to stabilize wardrobe, lighting or product design across clips. [oai_citation:13‡MaxVideoAI](https://maxvideoai.com/models/veo-3-1)

- Image → Video  
  - Start from a single still (from Nano Banana or your own brand assets) and animate it into a 4–8 s shot.  
  - Great for turning keyframes, diagrams or product photos into motion.

- No direct video input in this configuration – use text, images and Extend to build longer sequences.

### Audio

- Veo 3.1 generates native audio with your video: ambience, sound design and short lines of dialogue. [oai_citation:14‡blog.google](https://blog.google/technology/ai/veo-updates-flow/)  
- In MaxVideoAI you can toggle audio on or off per job:  
  - Audio on: use Veo's mix as a first-draft soundtrack.  
  - Audio off: cheaper silent renders when you plan to design sound in your editor.

Best practice: treat Veo's audio as a strong starting point, then polish timing and loudness in your DAW for final delivery.

### Pricing

- Veo 3.1 uses a per-second pricing model inside MaxVideoAI.

**Internal config (example):**

- perSecondCentsAudioOn = 40  
- perSecondCentsAudioOff = 20

**Approximate costs (USD):**

- Audio ON (~$0.40/s)  
  - 4 s ≈ $1.60  
  - 6 s ≈ $2.40  
  - 8 s ≈ $3.20

- Audio OFF (~$0.20/s)  
  - 4 s ≈ $0.80  
  - 6 s ≈ $1.20  
  - 8 s ≈ $1.60

No monthly subscription: top up your MaxVideoAI wallet and only pay for what you generate. Use Price Before You Generate to preview the exact cost before hitting Render. [oai_citation:15‡MaxVideoAI](https://maxvideoai.com/blog/compare-ai-video-engines)  
**Render timing placeholder:** add observed render time here (e.g., "~25–70s for 8s 1080p with audio on") once measured.

---

## Example Gallery: Real Veo 3.1 Outputs

See a handful of live Veo 3.1 renders powered by the same settings you have in MaxVideoAI.

【View all Veo 3.1 examples → `/examples?engine=veo-3-1`】

Each card in the gallery shows:

- A thumbnail preview  
- Engine, duration, resolution and aspect ratio  
- A short logline of the prompt (e.g., "8s 16:9 product hero shot with macro dolly and native audio")  
- A "Recreate this shot →" button that opens the scene in the Generate composer with the same engine and settings

➡️ **Open this scene in Generate and adapt it with your own brand →**

---

## Text-to-Video with Veo 3.1

Veo responds best when your prompt reads like a short director's note, not a bag of keywords. Google's guide recommends building prompts around cinematography, subject, action, context and style. [oai_citation:17‡Google Cloud](https://cloud.google.com/blog/products/ai-machine-learning/ultimate-prompting-guide-for-veo-3-1)

A simple reusable pattern:

1. Cinematography and framing – medium close-up, wide tracking shot, top-down macro, etc.  
2. Subject – who or what we see (person, product, scene).  
3. Action – what happens in the 4–8 seconds.  
4. Context / environment – office, city street at night, kitchen studio, classroom.  
5. Style and ambiance – realistic, cinematic, documentary, stylized; lighting, color grade.  
6. Audio cues – ambience, music style, one short line of VO ("Character says: ..., no subtitles."). [oai_citation:18‡Powtoon](https://www.powtoon.com/blog/veo-3-video-prompt-examples/)  
7. Format and length – 8 seconds, 16:9 (or 9:16 / 1:1).

Reusable skeleton:

> Medium shot of [subject] in [environment], [clear action] over 8 seconds. Camera [movement], 16:9 at 1080p, cinematic look with [lighting and color]. Audio: [ambience] + [music/VO cue], no subtitles.

Drop that into MaxVideoAI, choose Veo 3.1, set duration/orientation, and you are ready to render.

---

## Image-to-Video Workflow with Veo 3.1 (+ Nano Banana)

Pair Veo 3.1 with Nano Banana to lock style and iterate on motion.

1. Generate 1–4 reference stills in Nano Banana (or import your own product or brand stills).  
2. Send them into Veo 3.1 as reference images in Text→Video, or start from a single still in Image→Video. [oai_citation:19‡Skywork](https://skywork.ai/blog/veo-3-1-capabilities-resolution-duration-use-cases-2025/)  
3. In your prompt, focus on motion, timing and audio, not restyling:  
   - How the camera moves  
   - How the subject moves  
   - How the beat should end at 4/6/8 seconds  
4. Generate, review, and tweak only the camera and audio language. Re-run with the same references for consistent identity.

Perfect for:

- On-brand product hero clips  
- Logo and title animations with consistent backgrounds  
- Short explainer visuals based on diagrams or UI stills

---

## Multi-Shot & Sequenced Clips – Directed 8s Beats in Veo 3.1

Veo 3.1 can compress a mini-sequence into a single 6 or 8 second clip when you write a structured prompt.

Guidelines:

- Aim for 2–3 shots per 8-second clip.  
- Give each beat one main action and one clear camera move.  
- Keep subject, wardrobe and environment consistent; use reference images to lock them. [oai_citation:20‡Skywork](https://skywork.ai/blog/veo-3-1-capabilities-resolution-duration-use-cases-2025/)  
- Do not try to visit many locations in 8 seconds – treat it like a single scene with multiple angles.  
- Use the Extend feature for longer arcs: start with a strong 6–8 s base shot, then extend to build a 12–24 s establishing sequence.

A simple structure:

> Shot 1 (0–3 s) – establish scene and subject  
> Shot 2 (3–6 s) – introduce movement or interaction  
> Shot 3 (6–8 s) – payoff and brand or emotional beat

---

## Demo: One Sequenced Prompt (with Native Audio)

Prompt – 8 second cinematic product story for wireless earbuds (16:9, 1080p)

> 8 second cinematic product story for a pair of matte black wireless earbuds on a wooden desk.  
> Shot 1 (0–3 s): macro close-up of one earbud rotating slowly on the desk, shallow depth of field, warm desk lamp glow in the background.  
> Shot 2 (3–6 s): medium shot of a young professional putting the earbuds in before stepping onto a busy city street, subtle bokeh lights behind.  
> Shot 3 (6–8 s): close-up of the charging case clicking shut next to a laptop, soft logo reflection in the lid.  
> Camera: smooth dolly moves between shots, handheld feel but not shaky.  
> Lighting: evening, warm indoors transitioning to cool street light, gentle film grain.  
> Audio: city ambience low in the mix, soft electronic music bed, short VO line: Character says: "Block the noise, keep the focus." No subtitles.  
> Negative: no brand names, no on-screen text, no extreme wide angles.

This prompt shows:

- Clear 3-beat structure with coherent environment  
- Cinematography, lighting and color grade defined  
- Short, realistic VO that fits in 8 seconds  
- Explicit request for no subtitles to avoid unwanted text overlays [oai_citation:21‡Powtoon](https://www.powtoon.com/blog/veo-3-video-prompt-examples/)

Audio on · 8 s  
Demo: One Sequenced Prompt – 8s earbud product story with native audio  
【View render →】

---

## Tips & Limitations in Plain English

Play to Veo 3.1's strengths:

- Strong camera control – framing presets and motion cues make it predictable, not random. [oai_citation:22‡MaxVideoAI](https://maxvideoai.com/blog/veo-3-updates)  
- Excellent for ads, explainers and campaigns where you need consistency across variants.  
- Native audio is great for first-pass sound design and VO. [oai_citation:23‡blog.google](https://blog.google/technology/ai/veo-updates-flow/)  
- Handles short, focused sequences better than chaotic "everything at once" prompts.

Know its boundaries:

- Clips are 4–8 seconds, not long-form. Build longer stories by stretching shots with Extend and sequencing clips in your editor. [oai_citation:24‡Skywork](https://skywork.ai/blog/veo-3-1-capabilities-resolution-duration-use-cases-2025/)  
- 1080p max – no 4K outputs in this configuration; do not over-promise resolution. [oai_citation:25‡Skywork](https://skywork.ai/blog/veo-3-1-capabilities-resolution-duration-use-cases-2025/)  
- Complex tiny text and detailed UI can be hit-or-miss; keep critical copy as overlays in post.  
- Veo can occasionally improvise extra motion or background elements; if it drifts, tighten subject and camera instructions and reduce the number of actions. [oai_citation:26‡Powtoon](https://www.powtoon.com/blog/veo-3-video-prompt-examples/)

When you lean into those constraints, Veo 3.1 becomes a repeatable, directable tool instead of a slot machine.

---

## Safety, People & Likeness

Veo 3.1 inherits Google's safety systems and provenance tools. [oai_citation:27‡Skywork](https://skywork.ai/blog/veo-3-1-capabilities-resolution-duration-use-cases-2025/)

- Do not generate real public figures, politicians or celebrities.  
- No minors in risky or suggestive contexts, no explicit sexual content, no hateful or violent scenes.  
- Avoid using real people's likeness without consent, even if the model technically can.  
- Some prompts and images will be blocked or adjusted by provider policies – this is expected behavior. [oai_citation:28‡Google Cloud Documentation](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/model-reference/veo-video-generation)  
- Veo outputs carry Google's SynthID-style provenance watermark, which helps downstream systems recognize AI-generated media. [oai_citation:29‡Skywork](https://skywork.ai/blog/veo-3-1-capabilities-resolution-duration-use-cases-2025/)

MaxVideoAI layers its own safety filters on top so the engine stays usable and compliant for professional work.

---

## Veo 3.1 vs Veo 3.1 Fast – Quick Overview

- Veo 3.1 is your premium, full-fidelity tier – best detail, smoothing and audio quality.  
- Veo 3.1 Fast is your cheaper, faster sibling – ideal for rapid iteration and social variants.

Use this pattern:

- Draft ideas, hooks and A/B variants in Veo 3.1 Fast.  
- Regenerate the winners in Veo 3.1 at 1080p with richer audio and more refined motion.

【Compare Veo 3.1 vs Veo 3.1 Fast →】

---

## FAQ – Veo 3.1 in MaxVideoAI

### Is Veo 3.1 available in Europe or the UK?

Yes. MaxVideoAI routes Veo jobs through licensed Google DeepMind endpoints (via Fal.ai and Google APIs), so you can render from Europe, the UK and most supported regions without separate Veo contracts. [oai_citation:30‡MaxVideoAI](https://maxvideoai.com/blog/compare-ai-video-engines)

### Can Veo 3.1 generate vertical videos?

Yes. Veo 3.1 in MaxVideoAI supports 16:9, 9:16 and 1:1. Choose 9:16 for Reels, TikTok and Shorts; keep the key action centered so it crops safely across feeds. [oai_citation:31‡Skywork](https://skywork.ai/blog/veo-3-1-capabilities-resolution-duration-use-cases-2025/)

### Does Veo 3.1 support image-to-video?

Yes. You can either:

- Start from a single still (Image→Video), or  
- Use 1–4 reference images to guide a Text→Video clip.

Both work from the same Veo 3.1 composer in MaxVideoAI. [oai_citation:32‡MaxVideoAI](https://maxvideoai.com/models/veo-3-1)

### Can I extend Veo 3.1 videos beyond 8 seconds?

Base clip lengths are 4/6/8 s. To go longer, use Extend on a successful shot and/or chain clips in the Workflows or timeline view. Treat each extension as another 4–8 s block with consistent camera and subject. [oai_citation:33‡Skywork](https://skywork.ai/blog/veo-3-1-capabilities-resolution-duration-use-cases-2025/)

### How do I keep Veo 3.1 on-brand?

Use:

- Reference stills from Nano Banana or your existing brand library  
- Consistent descriptions for your hero characters and settings across prompts [oai_citation:34‡Powtoon](https://www.powtoon.com/blog/veo-3-video-prompt-examples/)  
- Clear guidance on color palettes and lighting (e.g., "clean, neutral corporate look" vs "warm, golden-hour lifestyle")

---

## Explore other models

Compare pricing, latency, and output options across other engines available in MaxVideoAI.

**openai**

### OpenAI Sora 2

Create short cinematic clips with strong physics and ambient sound. Great for realism-first concepts and product shots.

【View model → /models/sora-2】

### OpenAI Sora 2 Pro

Generate longer 1080p clips with advanced multi-beat prompts, audio control and more temporal coherence.

【View model → /models/sora-2-pro】

**google-veo**

### Google Veo 3.1 Fast

Use Veo 3.1 Fast for affordable, fast AI video generation. Up to 8-second clips with optional native audio—ideal for social formats and iterative testing.

【View model → /models/veo-3-1-fast】

**pika**

### Pika 2.2

Stylized, fast AI video for animation-like and experimental looks. Perfect for quick social loops and storyboard studies.

【View model → /models/pika-text-to-video】

Veo 3.1 in MaxVideoAI gives you direct, pay-as-you-go access to Google's most controllable short-form video engine – with framing and audio controls that make it feel like a virtual camera, not just another black-box generator.
