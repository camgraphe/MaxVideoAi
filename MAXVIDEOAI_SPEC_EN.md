
# MAXVIDEOAI — Codex Implementation Brief (EN)

**Purpose:** This document gives Codex everything needed to redesign the homepage, implement the Engine→Version selector, add live cost estimation, and ship a clear pricing/SEO layer for **MaxVideoAI** (Vercel + Supabase + Neon + fal.ai + Stripe).  
**Audience:** engineers & content implementers.  
**Status:** ready to build.

---

## 0) Positioning (product promise)

**Tagline (Hero H1):** *Generate stellar AI videos. Compare engines. Pay only for what you render.*  
**Subheader:** *One control room for Veo 3, Kling 2.5, Pika 2.2, Luma and more—powered by fal.ai. Lock quality, cap budget, ship faster.*  
**Primary CTA:** `Start free →`  
**Secondary CTA:** `See live pricing →`

**Why this angle:** users don’t want a catalogue of all models; they want to **draft fast**, **compare outputs side‑by‑side**, then **promote the winner** to a quality engine—while seeing the **exact cost** before they click.

---

## 1) Stack & constraints

- **Frontend:** Next.js (Vercel).  
- **DB:** Supabase (Postgres on Neon).  
- **Video generation:** fal.ai endpoints (Queue + Webhooks).  
- **Billing:** Stripe (metered usage).  
- **Site language:** **English‑only** for now.

---

## 2) Scope of this delivery

1. **Homepage redesign** (copy + sections below).  
2. **Dashboard changes:** Engine→Version selector, Model‑aware inputs, *Promote to Quality*, *Budget Cap*, **Cost Pin** (live estimator).  
3. **Pricing page:** four **Formats**, engine examples, clear rules for multipliers (e.g., Luma), audio toggle (Veo).  
4. **SEO:** titles/meta/FAQ JSON‑LD.  
5. **Config & code:** a machine‑readable **models.config.json**, a reusable **lib/pricing.ts** cost engine, and a minimal **CostPin** React component.  
6. **Stripe metered usage** wiring + **Supabase** tables for jobs/usage.

---

## 3) Page‑level copy & UX

### 3.1 Homepage (copy blocks)

**Hero**  
- **H1:** *Generate stellar AI videos. Compare engines. Pay only for what you render.*  
- **Sub:** *One control room for Veo 3, Kling 2.5, Pika 2.2, Luma and more—powered by fal.ai. Lock quality, cap budget, ship faster.*  
- **CTA:** `Start free →` · `See live pricing →`

**“How it works” (3 steps)**  
1) **Draft smart** — Run quick drafts on budget engines (Kling, Pika, WAN).  
2) **Compare side‑by‑side** — Same prompt, multiple engines, synced thumbnails.  
3) **Promote to quality** — One‑click to Veo 3 (or Veo 3 Fast). Keep seed and settings.

**Model Switchboard (curated)**  
- **Veo 3** — cinematic, optional audio, 4/6/8s, 720p/1080p; supports 16:9, 9:16, 1:1.  
- **Kling 2.5 Turbo Pro** — fast, fluid motion; great for hook testing.  
- **Pika 2.2** — flexible T2V/I2V, many aspect ratios, 720p/1080p.  
- **Luma Dream Machine** — stylized 5s/9s (540→1080p with multipliers).  
- **WAN / Hunyuan / Minimax** — open/budget tracks for volume drafts.

**Budget you can see**  
Inline **Cost Pin** updates as you change duration, resolution, aspect ratio, and audio (when available).

**Formats (pre‑priced bundles)**  
- **Quick Draft** — 5s • 720p • 16:9/9:16  
- **Social Vertical** — 6s • 720p • 9:16  
- **Standard** — 8s • 720p • 16:9  
- **Hero** — 8s • 1080p • 16:9 *(9:16 may fall back to 720p when required)*

**Utilities**  
- **Reframe (Ray‑2)** — preserve subject while switching 16:9↔9:16.  
- **Upscale (SeedVR2 / Topaz)** — temporal‑consistent upscale to 4K.

**SEO footer blurb (~120 words)**  
MaxVideoAI is the **engine‑agnostic AI video switchboard** for creators and teams. Generate **text‑to‑video** and **image‑to‑video** clips with Veo 3, Kling 2.5, Pika 2.2, Luma, WAN, Hunyuan and more—**all in one place**. Compare models, optimize costs live, and promote your best drafts to publish‑ready quality. Built on **fal.ai** APIs with a metered Stripe checkout, MaxVideoAI lets you **pay per render**, not per month. Upscale and reframe in one click. Ship vertical (9:16) and horizontal (16:9) simultaneously with budget guardrails.

---

### 3.2 Pricing page (copy & rules)

**H1:** *Pricing that tracks your render, not your time.*  
**Sub:** *Real‑time cost by engine, duration, resolution, and audio. No minimums.*

**Formats (cards):**  
- **Quick Draft** — 5s • 720p • 16:9/9:16 → from **$0.45–$0.99** depending on engine.  
- **Social Vertical** — 6s • 720p • 9:16 → from **$0.55–$1.10**.  
- **Standard** — 8s • 720p • 16:9 → from **$0.56–$2.32**.  
- **Hero** — 8s • 1080p • 16:9 → from **$0.70–$3.99**.  

**Engine notes (show as explainers in UI):**  
- **Veo 3 / Veo 3 Fast** — per‑second rates; **audio on/off** changes usage.  
- **Kling 2.5** — **$0.35 for first 5s**, then **+$0.07/s**.  
- **Pika 2.2** — linear per‑second estimate derived from 5s examples (720p vs 1080p).  
- **Luma DM** — multipliers: 720p = ×2, 1080p = ×4; 9s = ×2.  
- **WAN 2.1** — per‑clip at 480p/720p; frames above default may add a small multiplier.  
- **WAN 2.2** — per‑second (video seconds @ 16 fps).  
- **Utilities** — per‑second or per‑megapixel depending on tool.

**Billing microcopy:**  
“Prices refresh from fal.ai endpoints at runtime. You are charged **only on successful** generations. Disabling audio on compatible engines reduces usage.”

---

### 3.3 Dashboard (UX)

**Top bar:** Brand → Formats menu (Quick Draft / Social Vertical / Standard / Hero) → Credits · Budget Cap · Checkout.  

**Panel 1 — Engine & Version**  
- **Engine (select):** Veo / Kling / Pika / Luma / WAN / Hunyuan / Minimax / Utilities.  
- **Version (pills)** *(auto‑populated from config)* — e.g., `Pika 2.2 (T2V)`, `Pika 2.2 (I2V)`, `Veo 3`, `Veo 3 Fast`, `Kling 2.5 Pro (T2V/I2V)`, etc.

**Panel 2 — Prompt & Inputs (model‑aware)**  
- **Prompt** (textarea).  
- **Reference** (image/video) only for I2V/V2V.  
- **Duration** — constrained by engine (e.g., Veo 3: 4/6/8; Luma: 5s/9s).  
- **Aspect ratio** — constrained by engine (e.g., Pika supports more ratios).  
- **Resolution** — constrained by engine.  
- **Audio** — checkbox when the engine supports it (e.g., Veo). Tooltip: “Turn off audio to save credits.”

**Right rail — Cost Pin**  
- Displays **engine · version · duration · res · audio** → **$ live**.  
- Microcopy: “Prices come from fal.ai; you only pay on success.”

**Post‑render upsell**  
- `Reframe to 9:16 (Ray‑2)` and `Upscale to 4K (SeedVR2 / Topaz)`.

---

## 4) SEO package

**Primary Title (≤60c):** *AI Video Generator Switchboard — Compare Veo 3, Kling 2.5, Pika 2.2*  
**Meta Description (≤155c):** *Generate AI videos across Veo 3, Kling 2.5, Pika 2.2, Luma and more. Live pricing, side‑by‑side compares, and pay‑per‑render checkout on fal.ai.*

**H1 (Home):** *Generate stellar AI videos. Compare engines. Pay only for what you render.*

**H2s:**  
- One control room for every video model.  
- Draft fast, promote to quality.  
- Built on fal.ai.  
- Budget you can see.

**FAQ (for page + JSON‑LD):**  
- **Do you charge failed renders?** No—billing triggers only on success.  
- **Can I disable audio to save credits?** Yes, on engines that support it (e.g., Veo).  
- **Do you support vertical 1080p?** Some engines do; when not available we default to 720p for portrait.

**FAQ JSON‑LD** (paste into `<Head>` on Home or a shared SEO component):
```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [{
    "@type": "Question",
    "name": "Do you charge failed renders?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "No—billing triggers only on successful generations. Prices are fetched from fal.ai in real time."
    }
  },{
    "@type": "Question",
    "name": "Can I disable audio to save credits?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Yes. On supported engines like Veo 3, turning audio off reduces usage."
    }
  },{
    "@type": "Question",
    "name": "Do you support 1080p vertical?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Some engines support 9:16 at 1080p. When not available, we default to 720p for portrait."
    }
  }]
}
```

---

## 5) Model configuration (machine‑readable)

Create `config/models.config.json` with this content. The app reads it to render the Engine → Version selector and to guard inputs per model.

```json
{
  "formats": [
    { "id": "quick-draft", "label": "Quick Draft", "durationSec": 5, "resolution": "720p", "aspectRatio": "16:9_or_9:16" },
    { "id": "social-vertical", "label": "Social Vertical", "durationSec": 6, "resolution": "720p", "aspectRatio": "9:16" },
    { "id": "standard", "label": "Standard", "durationSec": 8, "resolution": "720p", "aspectRatio": "16:9" },
    { "id": "hero", "label": "Hero", "durationSec": 8, "resolution": "1080p", "aspectRatio": "16:9" }
  ],
  "engines": [
    {
      "id": "veo",
      "label": "Veo",
      "versions": [
        {
          "id": "veo3_t2v",
          "label": "Veo 3 (Text to Video)",
          "falSlug": "fal-ai/veo3",
          "tasks": ["t2v"],
          "inputs": {
            "durationSec": [4, 6, 8],
            "resolution": ["720p", "1080p"],
            "aspectRatio": ["16:9", "9:16", "1:1"],
            "audioEnabled": [true, false]
          }
        },
        {
          "id": "veo3_fast_t2v",
          "label": "Veo 3 Fast (Text to Video)",
          "falSlug": "fal-ai/veo3/fast",
          "tasks": ["t2v"],
          "inputs": {
            "durationSec": [4, 6, 8],
            "resolution": ["720p", "1080p"],
            "aspectRatio": ["16:9", "9:16", "1:1"],
            "audioEnabled": [true, false]
          }
        }
      ]
    },
    {
      "id": "kling",
      "label": "Kling",
      "versions": [
        {
          "id": "kling_25_pro_t2v",
          "label": "Kling 2.5 Turbo Pro (Text to Video)",
          "falSlug": "fal-ai/kling-video/v2.5-turbo/pro/text-to-video",
          "tasks": ["t2v"],
          "inputs": { "durationSec": [5,6,7,8,9,10], "resolution": ["720p"], "aspectRatio": ["16:9","9:16"] }
        },
        {
          "id": "kling_25_pro_i2v",
          "label": "Kling 2.5 Turbo Pro (Image to Video)",
          "falSlug": "fal-ai/kling-video/v2.5-turbo/pro/image-to-video",
          "tasks": ["i2v"],
          "inputs": { "durationSec": [5,6,7,8,9,10], "resolution": ["720p"], "aspectRatio": ["16:9","9:16"] }
        }
      ]
    },
    {
      "id": "pika",
      "label": "Pika",
      "versions": [
        {
          "id": "pika_22_t2v",
          "label": "Pika 2.2 (Text to Video)",
          "falSlug": "fal-ai/pika/v2.2/text-to-video",
          "tasks": ["t2v"],
          "inputs": { "durationSec": [3,4,5,6,7,8,9,10], "resolution": ["720p","1080p"], "aspectRatio": ["16:9","9:16","1:1","4:5","5:4","3:2","2:3"] }
        },
        {
          "id": "pika_22_i2v",
          "label": "Pika 2.2 (Image to Video)",
          "falSlug": "fal-ai/pika/v2.2/image-to-video",
          "tasks": ["i2v"],
          "inputs": { "durationSec": [3,4,5,6,7,8,9,10], "resolution": ["720p","1080p"], "aspectRatio": ["16:9","9:16","1:1","4:5","5:4","3:2","2:3"] }
        }
      ]
    },
    {
      "id": "luma",
      "label": "Luma",
      "versions": [
        {
          "id": "luma_dm_t2v",
          "label": "Dream Machine v1.5 (Text to Video)",
          "falSlug": "fal-ai/luma-dream-machine",
          "tasks": ["t2v"],
          "inputs": { "duration": ["5s","9s"], "resolution": ["540p","720p","1080p"], "aspectRatio": ["16:9","9:16","4:3","3:4","21:9","9:21"], "loop": [true,false] }
        },
        {
          "id": "ray2_reframe_v2v",
          "label": "Ray‑2 Reframe (Video to Video)",
          "falSlug": "fal-ai/luma-dream-machine/ray-2/reframe",
          "tasks": ["v2v"],
          "inputs": { "aspectRatio": ["1:1","16:9","9:16","4:3","3:4","21:9","9:21"] }
        }
      ]
    },
    {
      "id": "wan",
      "label": "WAN",
      "versions": [
        {
          "id": "wan_21_t2v",
          "label": "WAN 2.1 (Text to Video)",
          "falSlug": "fal-ai/wan-t2v",
          "tasks": ["t2v"],
          "inputs": { "frames": [81,90,100], "fps": [12,16,24], "resolution": ["480p","580p","720p"], "aspectRatio": ["16:9","9:16"] }
        },
        {
          "id": "wan_22_a14b_v2v",
          "label": "WAN 2.2 A14B (Video to Video)",
          "falSlug": "fal-ai/wan/v2.2-a14b/video-to-video",
          "tasks": ["v2v"],
          "inputs": { "frames": [96,128,160], "fps": [12,16,24], "resolution": ["480p","580p","720p"], "aspectRatio": ["16:9","9:16"] }
        },
        {
          "id": "wan_22_a14b_i2v_turbo",
          "label": "WAN 2.2 A14B Turbo (Image to Video)",
          "falSlug": "fal-ai/wan/v2.2-a14b/image-to-video/turbo",
          "tasks": ["i2v"],
          "inputs": { "frames": [96,128,160], "fps": [12,16,24], "resolution": ["480p","580p","720p"], "aspectRatio": ["16:9","9:16"] }
        }
      ]
    },
    {
      "id": "hunyuan",
      "label": "Hunyuan",
      "versions": [
        {
          "id": "hunyuan_t2v",
          "label": "Hunyuan Video (Text to Video)",
          "falSlug": "fal-ai/hunyuan-video",
          "tasks": ["t2v"],
          "inputs": { "numFrames": [85,129], "resolution": ["480p","580p","720p"], "aspectRatio": ["16:9","9:16"] }
        }
      ]
    },
    {
      "id": "minimax",
      "label": "MiniMax",
      "versions": [
        {
          "id": "hailuo_02_std_i2v",
          "label": "Hailuo‑02 Standard (Image to Video)",
          "falSlug": "fal-ai/minimax/hailuo-02/standard/image-to-video",
          "tasks": ["i2v"],
          "inputs": { "durationSec": [4,5,6], "resolution": ["512p","768p"], "aspectRatio": ["16:9","9:16"] }
        },
        {
          "id": "hailuo_02_pro_i2v",
          "label": "Hailuo‑02 Pro (Image to Video)",
          "falSlug": "fal-ai/minimax/hailuo-02/pro/image-to-video",
          "tasks": ["i2v"],
          "inputs": { "durationSec": [4,5,6], "resolution": ["720p"], "aspectRatio": ["16:9","9:16"] }
        }
      ]
    },
    {
      "id": "utilities",
      "label": "Utilities",
      "versions": [
        {
          "id": "seedvr2_upscale",
          "label": "SeedVR2 Upscale (Video to Video)",
          "falSlug": "fal-ai/seedvr/upscale/video",
          "tasks": ["v2v"],
          "inputs": {}
        },
        {
          "id": "topaz_upscale",
          "label": "Topaz Video Upscale (Video to Video)",
          "falSlug": "fal-ai/topaz/upscale/video",
          "tasks": ["v2v"],
          "inputs": {}
        }
      ]
    }
  ]
}
```

---

## 6) Live pricing engine

Create `lib/pricing.ts` and use it in the UI for the Cost Pin and the Pricing page. Rules are **engine‑aware** and can be **overridden** from Supabase/ENV without redeploy.

```ts
// lib/pricing.ts
export type Resolution = "480p" | "512p" | "540p" | "580p" | "720p" | "768p" | "1080p";
export type Aspect = "16:9" | "9:16" | "1:1" | "4:3" | "3:4" | "21:9" | "9:21";
export type EngineId =
  | "fal-ai/veo3"
  | "fal-ai/veo3/fast"
  | "fal-ai/kling-video/v2.5-turbo/pro/text-to-video"
  | "fal-ai/kling-video/v2.5-turbo/pro/image-to-video"
  | "fal-ai/pika/v2.2/text-to-video"
  | "fal-ai/pika/v2.2/image-to-video"
  | "fal-ai/luma-dream-machine"
  | "fal-ai/luma-dream-machine/ray-2/reframe"
  | "fal-ai/wan-t2v"
  | "fal-ai/wan/v2.2-a14b/video-to-video"
  | "fal-ai/wan/v2.2-a14b/image-to-video/turbo"
  | "fal-ai/hunyuan-video"
  | "fal-ai/minimax/hailuo-02/standard/image-to-video"
  | "fal-ai/minimax/hailuo-02/pro/image-to-video"
  | "fal-ai/seedvr/upscale/video"
  | "fal-ai/topaz/upscale/video";

export type EstimateInput = {
  engine: EngineId;
  durationSec?: number;
  resolution?: Resolution;
  aspectRatio?: Aspect;
  audioEnabled?: boolean;
  frames?: number;
  fps?: number;
  megapixels?: number;
};

export type Estimate = {
  costUsd: number | null;
  currency: "USD";
  breakdown: string[];
  assumptions: string[];
};

type PerSecond = { type: "per_second"; audioAware?: boolean; rates: Record<string, number> };
type KlingTier = { type: "kling_tier"; base5s: number; extraPerSecond: number; minSeconds: number };
type FlatPerClip = { type: "flat_per_clip"; rates: Record<string, number> };
type PerVideoSecond = { type: "per_video_second"; rates: Record<string, number>; note?: string };
type PerMegapixel = { type: "per_megapixel"; usdPerMP: number };
type Multipliers = { type: "multipliers"; baseUsd540p5s: number | null; resMult: Record<string, number>; durMult: Record<string, number> };

type PricingRule =
  | PerSecond
  | KlingTier
  | FlatPerClip
  | PerVideoSecond
  | PerMegapixel
  | Multipliers;

const RATES: Record<EngineId, PricingRule> = {
  "fal-ai/veo3": { type: "per_second", audioAware: true, rates: { audio_on: 0.40, audio_off: 0.20 } },
  "fal-ai/veo3/fast": { type: "per_second", audioAware: true, rates: { audio_on: 0.15, audio_off: 0.10 } },
  "fal-ai/kling-video/v2.5-turbo/pro/text-to-video": { type: "kling_tier", base5s: 0.35, extraPerSecond: 0.07, minSeconds: 5 },
  "fal-ai/kling-video/v2.5-turbo/pro/image-to-video": { type: "kling_tier", base5s: 0.35, extraPerSecond: 0.07, minSeconds: 5 },
  "fal-ai/pika/v2.2/text-to-video": { type: "per_second", rates: { "720p": 0.04, "1080p": 0.09 } },
  "fal-ai/pika/v2.2/image-to-video": { type: "per_second", rates: { "720p": 0.04, "1080p": 0.09 } },
  "fal-ai/luma-dream-machine": {
    type: "multipliers",
    baseUsd540p5s: null,
    resMult: { "540p": 1, "720p": 2, "1080p": 4 },
    durMult: { "5s": 1, "9s": 2 }
  },
  "fal-ai/luma-dream-machine/ray-2/reframe": { type: "per_second", rates: { default: NaN } },
  "fal-ai/wan-t2v": { type: "flat_per_clip", rates: { "480p": 0.20, "720p": 0.40 } },
  "fal-ai/wan/v2.2-a14b/video-to-video": { type: "per_video_second", rates: { "480p": 0.04, "580p": 0.06, "720p": 0.08 }, note: "video seconds at 16 fps" },
  "fal-ai/wan/v2.2-a14b/image-to-video/turbo": { type: "flat_per_clip", rates: { "480p": 0.05, "580p": 0.075, "720p": 0.10 } },
  "fal-ai/hunyuan-video": { type: "flat_per_clip", rates: { default: 0.40 } },
  "fal-ai/minimax/hailuo-02/standard/image-to-video": { type: "per_second", rates: { "512p": 0.017, "768p": 0.045 } },
  "fal-ai/minimax/hailuo-02/pro/image-to-video": { type: "per_second", rates: { "720p": 0.08 } },
  "fal-ai/seedvr/upscale/video": { type: "per_megapixel", usdPerMP: 0.015 },
  "fal-ai/topaz/upscale/video": { type: "per_second", rates: { default: NaN } }
};

let PRICING_OVERRIDES: Partial<Record<EngineId, Partial<PricingRule>>> = {};
export const setPricingOverrides = (json: string | null) => {
  if (!json) return;
  try { PRICING_OVERRIDES = JSON.parse(json); } catch { /* ignore */ }
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function estimateCost(input: EstimateInput): Estimate {
  const { engine, durationSec, resolution, audioEnabled, frames, megapixels } = input;
  const base = RATES[engine];
  const rule = applyOverrides(engine, base);
  const assumptions: string[] = [];
  const breakdown: string[] = [];

  if (!rule) return { costUsd: null, currency: "USD", breakdown: [], assumptions: ["No pricing rule found"] };

  switch (rule.type) {
    case "per_second": {
      if (Number.isNaN(rule.rates["default"])) return nullish("Price not published; set override");
      let rate: number | undefined;
      if (rule.audioAware) {
        const key = audioEnabled ? "audio_on" : "audio_off";
        rate = rule.rates[key];
        breakdown.push(`Per-second rate (${key.replace("_"," ")}): $${rate!.toFixed(2)}/s`);
      } else {
        rate = resolution ? (rule.rates[resolution] ?? rule.rates["default"]) : (rule.rates["default"] ?? undefined);
        breakdown.push(`Per-second rate: $${rate!.toFixed(2)}/s${resolution ? ` @ ${resolution}` : ""}`);
      }
      if (!rate || !durationSec) return nullish("Missing rate or duration");
      const cost = rate * durationSec;
      breakdown.push(`Duration: ${durationSec}s → $${round2(cost)}`);
      if (engine.startsWith("fal-ai/pika/")) assumptions.push("Linearized from 5s example price on fal.ai.");
      return { costUsd: round2(cost), currency: "USD", breakdown, assumptions };
    }
    case "kling_tier": {
      if (!durationSec) return nullish("Missing duration");
      const secsOver = Math.max(0, durationSec - rule.minSeconds);
      const cost = rule.base5s + secsOver * rule.extraPerSecond;
      breakdown.push(`Base ${rule.minSeconds}s: $${rule.base5s.toFixed(2)} + ${secsOver}s × $${rule.extraPerSecond.toFixed(2)}/s`);
      return { costUsd: round2(cost), currency: "USD", breakdown, assumptions };
    }
    case "flat_per_clip": {
      let rate: number | undefined;
      if (resolution && rule.rates[resolution] != null) rate = rule.rates[resolution];
      else if (rule.rates["default"] != null) rate = rule.rates["default"];
      if (engine === "fal-ai/wan-t2v" && frames && frames > 81) {
        breakdown.push(`Frames > default (81) → ×1.25`);
        const base = (rate ?? 0) * 1.25;
        return { costUsd: round2(base), currency: "USD", breakdown, assumptions };
      }
      return { costUsd: rate ?? null, currency: "USD", breakdown, assumptions };
    }
    case "per_video_second": {
      if (!durationSec) return nullish("Missing duration");
      const r = resolution ? rule.rates[resolution] : undefined;
      if (!r) return nullish("Missing rate for resolution");
      const cost = r * durationSec;
      breakdown.push(`Per-video-second rate @ ${resolution}: $${r.toFixed(2)}/s (video seconds @16fps)`);
      return { costUsd: round2(cost), currency: "USD", breakdown, assumptions };
    }
    case "per_megapixel": {
      if (typeof megapixels !== "number") return nullish("Missing megapixels for upscale");
      const cost = rule.usdPerMP * megapixels;
      breakdown.push(`${megapixels} MP × $${rule.usdPerMP}/MP`);
      return { costUsd: round2(cost), currency: "USD", breakdown, assumptions };
    }
    case "multipliers": {
      if (rule.baseUsd540p5s == null) return nullish("Base price not set (use override for Luma DM)");
      const resKey = (resolution ?? "540p") as string;
      const durKey = (durationSec === 9 ? "9s" : "5s") as "5s" | "9s";
      const resM = rule.resMult[resKey] ?? 1;
      const durM = rule.durMult[durKey] ?? 1;
      const cost = rule.baseUsd540p5s * resM * durM;
      breakdown.push(`Base 540p/5s: $${rule.baseUsd540p5s} × res ${resKey} ${resM} × dur ${durKey} ${durM}`);
      return { costUsd: round2(cost), currency: "USD", breakdown, assumptions };
    }
  }

  function nullish(reason: string): Estimate {
    assumptions.push(reason);
    return { costUsd: null, currency: "USD", breakdown, assumptions };
  }
}

function applyOverrides(engine: EngineId, base: PricingRule): PricingRule {
  const ov = PRICING_OVERRIDES[engine];
  if (!ov) return base;
  return { ...(base as any), ...(ov as any) };
}

// Helper: estimate megapixels for video upscales (rough order-of-magnitude)
export function estimateMegapixels(width: number, height: number, seconds: number, fps = 24, scaleFactor = 4): number {
  const frames = seconds * fps;
  const w = width * scaleFactor;
  const h = height * scaleFactor;
  return (frames * (w * h)) / 1_000_000;
}
```

---

## 7) Cost Pin UI (minimal React)

Create `components/CostPin.tsx` to display estimates and assumptions.

```tsx
// components/CostPin.tsx
"use client";
import { useMemo } from "react";
import { estimateCost, setPricingOverrides, type EstimateInput } from "@/lib/pricing";

type Props = { input: EstimateInput; overridesJSON?: string | null };

export default function CostPin({ input, overridesJSON }: Props) {
  if (overridesJSON) setPricingOverrides(overridesJSON);
  const estimate = useMemo(() => estimateCost(input), [input, overridesJSON]);

  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 12, background: "white" }}>
      <div style={{ fontWeight: 600 }}>Estimated cost</div>
      <div style={{ fontSize: 24, lineHeight: "32px", marginTop: 4 }}>
        {estimate.costUsd == null ? "—" : `$${estimate.costUsd.toFixed(2)}`}
      </div>
      {estimate.breakdown.length > 0 && (
        <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280" }}>
          {estimate.breakdown.map((b, i) => <div key={i}>{b}</div>)}
        </div>
      )}
      {estimate.assumptions.length > 0 && (
        <div style={{ marginTop: 8, fontSize: 12, color: "#9ca3af" }}>
          {estimate.assumptions.map((a, i) => <div key={i}>Assumption: {a}</div>)}
        </div>
      )}
    </div>
  );
}
```

---

## 8) Data & billing

### 8.1 Supabase tables (DDL sketch)

```sql
-- Jobs
create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  engine text not null,       -- e.g. "fal-ai/veo3"
  version text not null,      -- e.g. "veo3_t2v"
  inputs jsonb not null,
  cost_estimate jsonb,        -- output of pricing.estimate
  status text not null default 'queued', -- queued|running|succeeded|failed|cancelled
  result_url text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Usage events (for Stripe metered)
create table if not exists usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  job_id uuid references jobs(id),
  meter text not null,        -- "video_seconds_rendered" or "video_clips_rendered"
  quantity numeric not null,  -- seconds or clips
  engine text not null,
  created_at timestamptz not null default now()
);

-- Cached pricing (optional; refresh from fal endpoints)
create table if not exists model_prices_cache (
  slug text primary key,      -- "fal-ai/veo3"
  json jsonb not null,
  fetched_at timestamptz not null default now(),
  ttl_seconds integer not null default 3600
);
```

### 8.2 Stripe metered usage

- Meters: `video_seconds_rendered` and `video_clips_rendered`.  
- Raise usage **only after** fal webhook confirms a **successful** render.  
- Quantities:  
  - Per‑second engines (Veo, Kling, Pika, WAN 2.2, Minimax): **seconds rendered**.  
  - Per‑clip engines (WAN 2.1, Hunyuan, WAN 2.2 Turbo, some utilities): **clips = 1 per job**.

---

## 9) ENV & config

- `FAL_API_KEY`, `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.  
- `PRICING_OVERRIDES` (JSON string) to adjust rates without redeploy (e.g., set Luma base or utilities).  
- Optional CRON (Vercel) to refresh `model_prices_cache` from fal endpoints and store the raw JSON for audit.

---

## 10) Acceptance criteria

- [ ] Homepage shows the new hero/sub/CTAs, “How it works”, curated model list, Formats, and Utilities.  
- [ ] Dashboard renders Engine→Version from `config/models.config.json`; invalid inputs are blocked per model rules.  
- [ ] Cost Pin updates price **before** render; totals match Stripe usage within expected rounding.  
- [ ] Pricing page renders the four Formats and engine explainers; switching duration/res/audio changes the estimate.  
- [ ] SEO meta + FAQ JSON‑LD are present on Home.  
- [ ] Stripe usage is recorded **only on success**; Supabase `jobs` and `usage_events` are populated.  
- [ ] Utilities upsell appears on successful renders with working actions.

---

## 11) Implementation checklist

- [ ] Add `config/models.config.json`.  
- [ ] Add `lib/pricing.ts` and wire Cost Pin into Dashboard & Pricing page.  
- [ ] Build Engine→Version selector; map inputs based on config.  
- [ ] Implement Promote (carry seed/params into Veo 3 or Veo 3 Fast).  
- [ ] Wire fal Queue/Webhooks; handle retries; store logs.  
- [ ] Create Supabase tables; insert on job creation and completion.  
- [ ] Emit Stripe metered usage on success.  
- [ ] Add SEO titles/meta and FAQ JSON‑LD.  
- [ ] QA across 16:9 and 9:16, 720p/1080p, with/without audio.

---

## 12) Future (optional)

- Self‑host open‑source engines for **freemium** (3 free 720p clips/month with watermark).  
- “Model Health Bar” (avg latency, success rate, $/s) and routing suggestions (e.g., fallback to Veo 3 Fast if queues surge).  
- Templates/Presets library with one‑click swaps across engines.

---

**End of brief.** Put this file at `docs/MAXVIDEOAI_SPEC_EN.md` (or `/` as `MAXVIDEOAI_SPEC_EN.md`) in your repo so Codex can ingest and follow the instructions.
