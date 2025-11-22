# {{Engine Name}} – AI Text-to-Video & Image-to-Video in MaxVideoAI

> **Goal of this page**: make this the definitive, high-intent resource for **{{Engine Name}} in MaxVideoAI** – with clear specs, live examples, a sequenced demo prompt, best-practice tips and strong calls to action.

---

## Hero

**{{Engine Name}} – {{Positioning line}} ({{Durations}}, {{Resolution}})**  
Short benefit-led paragraph explaining what users can do with this engine in MaxVideoAI (text-to-video and/or image-to-video), pricing transparency, and that no invite is required. Mention choosing duration (e.g., 4/8/12 s), aspect ratio (16:9 or 9:16), and that outputs are ready for ads/content/client work.

**Primary CTA**  
➡️ **Start generating with {{Engine Name}}**

**Secondary CTA**  
Compare **{{Engine Name}} vs {{Sibling/Pro Variant}}** →

Why {{Engine Name}} is powerful inside MaxVideoAI:

- **Text → Video** and **Image → Video** in one place  
- **Sequenced / multi-shot prompts** for mini-stories in a single clip (if supported)  
- **Pay-as-you-go pricing** – you only pay for the seconds you generate  
- Available in **Europe, UK and worldwide**, no invite required  
- Designed to sit alongside **Veo, Pika, Kling, Wan, MiniMax Hailuo, Sora, etc.**

---

## What {{Engine Name}} Actually Is in MaxVideoAI

Plain-English description of how the engine is exposed in MaxVideoAI (not just theoretical specs). Cover:

- **Clip length options:** {{Durations}} (single generation)  
- **Output resolution:** {{Resolution}}  
- **Formats:** {{Aspect Ratios}} (e.g., 16:9, 9:16)  
- **Inputs:** Text → Video; Image → Video (list supported file types, size limits)  
- **Audio:** {{On/Off/Togglable}}  
- **Focus:** e.g., short, high-impact clips vs long-form

Outline the in-app flow (pick engine → choose T2V/I2V → set duration/aspect → paste structured prompt → see price → compare engines).

---

## Real Specs – {{Engine Name}} in MaxVideoAI

> These specs describe {{Engine Name}} exactly as you can use it today via MaxVideoAI.

### Duration & Output

- **Durations:** {{Durations}}  
- **Output resolution:** {{Resolution}} (e.g., 1280×720)

### Aspect Ratios

- {{Aspect Ratios}} (e.g., 16:9, 9:16)

### Inputs & File Types

- **Text prompts** – describe expected style (short cinematic sentences, shot-list style, etc.)  
- **Reference images** – list supported types and max size  
- Note if video input is or isn’t supported.

### Audio

- State default behavior (audio on/off/toggle) and how to mute/replace if needed.

### Pricing

- Internal config: `perSecondCents = {{Price in cents}}`  
- Example costs: show 2–3 durations with USD equivalents.  
- Reiterate pay-as-you-go wallet, no subscription.

> **Value proposition**: one-liner on why this engine is useful here (speed, predictability, style, etc.).

**Render timing (placeholder to fill):** In practice, renders take about {{Render time placeholder}} for a {{typical duration}} clip at {{typical resolution}}. Update this with real observations per engine.

---

## {{Engine Name}} Example Gallery

- Note that the page shows a live gallery powered by MaxVideoAI (same engine and settings users get).  
- Link to the broader Examples gallery filtered to this engine: `/examples?engine={{engine-slug}}`.  
- Explain what each card shows (preview, engine/duration, one-line description, CTA).

**CTA under the gallery**  
➡️ **Open this scene in Generate and adapt it with your own brand →**

---

## Text-to-Video with {{Engine Name}}

Explain how to write prompts like a concise shot list (subject/action, environment, camera, movement, light/mood, format/duration). Provide a reusable skeleton:

> *Wide shot of [subject] in [environment], lit by [lighting], camera [movement], {{Duration}} seconds, {{Aspect}}, cinematic, natural colors.*

---

## Image-to-Video Flow

If supported, describe pairing with an image engine (e.g., Nano Banana) to lock style and iterate on motion:

1. Generate a reference frame.  
2. Send to {{Engine Name}} as Image → Video.  
3. Prompt for motion/timing, keeping style anchored.  
4. Regenerate focusing on movement while keeping composition consistent.

List when this is useful (product shots, brand consistency, looping scenes).

---

## Multi-Shot / Sequenced Clips (engine-specific)

If this engine supports sequenced prompts, describe the best pattern for it (e.g., 2–3 beats with one action + one camera move per beat, continuity tips). If not supported, swap this section for the engine’s standout capability instead (e.g., first/last frames, audio-guided timing, or ultra-fast iterations).

---

## Demo: One Sequenced Prompt (With a Matching Clip)

Provide a realistic, ready-to-run prompt with timings and aspect ratio. Include 2–3 shots with clear camera moves. Note that the page should show the actual video generated from this prompt beside the text.

---

## Tips & Limitations

**Play to its strengths:** subjects, environments, camera behavior, tone/styles it handles well.  
**Know its boundaries:** resolution/duration limits, input limits (no video input? no seeds?), small text issues, etc.  
Encourage iterative prompting and comparing with adjacent engines in the same UI.

---

### Page Hygiene Checklist (keep site-specific patterns)

- Hero + dual CTAs (primary “Start generating with {{Engine Name}}”, secondary compare link).  
- Mention availability (EU/UK/worldwide) and pay-as-you-go wallet.  
- Link to `/examples?engine={{engine-slug}}` for the filtered gallery.  
- Keep tone: practical, benefit-first, plain English (no hype).  
- Keep section order consistent with this template for SEO/internal links.  
- Use real, current specs from config when you fill in placeholders.  
- Ensure any demo prompt has a corresponding real clip in the gallery if shown.  
- Add translation-ready copy (short sentences, avoid idioms) to ease i18n.  
- Preserve MaxVideoAI naming (MaxVideoAI, not variations).  
- If a pro variant exists, add a compare link and note key differences (resolution, audio toggle, duration).  
- Reference other engines (Veo, Pika, Kling, Wan, MiniMax Hailuo, Sora, etc.) to reinforce multi-engine positioning.  
- Keep the “Example Gallery” copy aligned with existing pages (live outputs, same engine as users get).

---

### Implementation guide (EN base → ES Latam, FR, JSON, wiring)

- **Fill this template in EN**: create `page model/{{engine}}.md` as the source doc with real specs/prompts/CTAs.  
- **Create locale JSON**: add `content/models/en/{{engine}}.json`, `content/models/es/{{engine}}.json` (ES Latam), and `content/models/fr/{{engine}}.json` with finalized copy and CTAs. Mirror keys/structure already used in other model JSON files.  
- **Hook into the model page**: ensure the slug (`{{engine}}`) matches the expected path in `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/page.tsx` and any config entries.  
- **Examples filter**: if you want the gallery to show relevant clips, make sure the engine slug is usable via `/examples?engine={{engine}}` and that playlists/indexable videos include that engine.  
- **Translations**: avoid idioms; keep sentences short to ease FR + ES localization. If you add new strings outside the JSON, update translation files accordingly.  
- **QA before publish**: validate hero CTAs, compare link (if pro variant), gallery renders, SEO/meta, and that JSON-LD on `/video/[id]` pages reflects the new engine’s outputs.  
- Ensure any demo prompt has a corresponding real clip in the gallery if shown.

---

### Current model quick reference (pricing/modes/durations)

- **Sora 2** — t2v/i2v; 4/8/12s; 720p; 16:9 or 9:16; audio on; image ≤50 MB; ~$0.12/s (≈$0.48 for 4s).  
- **Sora 2 Pro** — t2v/i2v; 4/8/12s; 720p/1080p/auto; 16:9 or 9:16; audio toggle; image ≤75 MB; ~$0.30/s @720p, ~$0.50/s @1080p.  
- **Veo 3.1** — t2v/i2v; 4/6/8s; 720p/1080p; 16:9/9:16/1:1; audio toggle; seed + extend; image ≤10 MB; ~$0.40/s audio on, ~$0.20/s off.  
- **Veo 3.1 Fast** — t2v/i2v; 4/6/8s; 720p/1080p; audio toggle; image ≤10 MB; ~$0.15/s audio on, ~$0.10/s off.  
- **Veo 3.1 First/Last** — i2v/i2i with first+last frames; 4/6/8s; 720p/1080p; audio toggle; image ≤12 MB; ~$0.40/s audio on, ~$0.20/s off.  
- **Pika 2.2** — t2v/i2v; 5/8s; 720p/1080p; multiple aspect ratios; audio off; image ≤25 MB; ~$0.04/s @720p, ~$0.09/s @1080p; seed + negative prompt.  
- **Kling 2.5 Turbo** — t2v/i2v/i2i; 5/10s; 720p/1080p; 16:9/9:16/1:1; audio off; image ≤25 MB; ~$0.07/s (≈$0.35 per 5s); supports CFG.  
- **Wan 2.5** — t2v/i2v; 5/10s; 480p/720p/1080p; 16:9/9:16/1:1; audio on + optional audio URL; image ≤25 MB; ~$0.05/0.10/0.15 per s by resolution; seed optional.  
- **MiniMax Hailuo 02** — t2v/i2v; 6/10s; 512p/768p; 16:9/9:16/1:1; audio off; image ≤20 MB; optional end frame; ~$0.045/s (≈$0.24 for 6s).  
- **Nano Banana** — t2i/i2i (images only); up to 8 images per call; wide aspect options; image ≤25 MB; ~$0.039 per generated image. Use its stills as references for i2v in Sora/Veo/Pika/Kling/Wan/Hailuo.
