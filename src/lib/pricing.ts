import modelsConfigJson from "@/config/models.config.json";
import { models } from "@/data/models";

export type Resolution = "480p" | "512p" | "540p" | "580p" | "720p" | "768p" | "1080p";
export type Aspect = "16:9" | "9:16" | "1:1" | "4:3" | "3:4" | "21:9" | "9:21" | "4:5" | "5:4" | "3:2" | "2:3";

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
  engine: string;
  durationSec?: number;
  durationSeconds?: number;
  resolution?: Resolution | string;
  aspectRatio?: Aspect | string;
  audioEnabled?: boolean;
  frames?: number;
  fps?: number;
  megapixels?: number;
  quantity?: number;
};

export type Estimate = {
  costUsd: number | null;
  currency: "USD";
  breakdown: string[];
  assumptions: string[];
};

type FormatConfig = {
  id: string;
  label: string;
  durationSec: number;
  resolution: string;
  aspectRatio: string;
};

export type EngineTask = "t2v" | "i2v" | "v2v";

type EngineVersionConfig = {
  id: string;
  label: string;
  falSlug: string;
  tasks: EngineTask[];
  inputs: Record<string, unknown>;
};

type EngineConfig = {
  id: string;
  label: string;
  versions: EngineVersionConfig[];
};

type ModelsConfig = {
  formats: FormatConfig[];
  engines: EngineConfig[];
};

const modelsConfig = modelsConfigJson as ModelsConfig;

const FAL_SLUG_TO_ENGINE_KEY = new Map<string, string>();
const ENGINE_KEY_TO_SPEC_SLUG = new Map<string, string>();

const VERSION_ID_FALLBACK_ALIAS: Record<string, string> = {
  veo3_t2v: "veo3",
  veo3_fast_t2v: "veo3-fast",
  kling_25_pro_t2v: "kling-pro-t2v",
  kling_25_pro_i2v: "kling-pro",
  pika_22_t2v: "pika-v2-2",
  pika_22_i2v: "pika-v2-2-i2v",
  luma_dm_t2v: "luma-dream",
  ray2_reframe_v2v: "luma-ray2-reframe",
  wan_21_t2v: "wan-2-1-t2v",
  wan_22_a14b_v2v: "wan-2-2-v2v",
  wan_22_a14b_i2v_turbo: "wan-2-2-i2v-turbo",
  hunyuan_t2v: "hunyuan-video",
  hailuo_02_std_i2v: "hailuo-02-standard",
  hailuo_02_pro_i2v: "hailuo-02-pro",
  seedvr2_upscale: "seedvr2-upscale",
  topaz_upscale: "topaz-upscale",
};

Object.values(models).forEach((spec) => {
  if (spec.provider !== "fal" || !spec.falSlug) {
    return;
  }
  const key = spec.id.split(":")[1] ?? spec.id;
  ENGINE_KEY_TO_SPEC_SLUG.set(key, spec.falSlug);
  const variants = new Set<string>();
  variants.add(spec.falSlug);
  const parts = spec.falSlug.split("/");
  while (parts.length > 2) {
    parts.pop();
    variants.add(parts.join("/"));
  }
  variants.forEach((variant) => {
    if (!FAL_SLUG_TO_ENGINE_KEY.has(variant)) {
      FAL_SLUG_TO_ENGINE_KEY.set(variant, key);
    }
  });
});

type PerSecond = { type: "per_second"; audioAware?: boolean; rates: Record<string, number> };
type KlingTier = { type: "kling_tier"; base5s: number; extraPerSecond: number; minSeconds: number };
type FlatPerClip = { type: "flat_per_clip"; rates: Record<string, number> };
type PerVideoSecond = { type: "per_video_second"; rates: Record<string, number>; note?: string };
type PerMegapixel = { type: "per_megapixel"; usdPerMP: number };
type Multipliers = { type: "multipliers"; baseUsd540p5s: number | null; resMult: Record<string, number>; durMult: Record<string, number> };

type PricingRule = PerSecond | KlingTier | FlatPerClip | PerVideoSecond | PerMegapixel | Multipliers;

const RATES: Record<EngineId, PricingRule> = {
  "fal-ai/veo3": { type: "per_second", audioAware: true, rates: { audio_on: 0.4, audio_off: 0.2 } },
  "fal-ai/veo3/fast": { type: "per_second", audioAware: true, rates: { audio_on: 0.15, audio_off: 0.1 } },
  "fal-ai/kling-video/v2.5-turbo/pro/text-to-video": {
    type: "kling_tier",
    base5s: 0.35,
    extraPerSecond: 0.07,
    minSeconds: 5,
  },
  "fal-ai/kling-video/v2.5-turbo/pro/image-to-video": {
    type: "kling_tier",
    base5s: 0.35,
    extraPerSecond: 0.07,
    minSeconds: 5,
  },
  "fal-ai/pika/v2.2/text-to-video": { type: "per_second", rates: { "720p": 0.04, "1080p": 0.09 } },
  "fal-ai/pika/v2.2/image-to-video": { type: "per_second", rates: { "720p": 0.04, "1080p": 0.09 } },
  "fal-ai/luma-dream-machine": {
    type: "multipliers",
    baseUsd540p5s: null,
    resMult: { "540p": 1, "720p": 2, "1080p": 4 },
    durMult: { "5s": 1, "9s": 2 },
  },
  "fal-ai/luma-dream-machine/ray-2/reframe": { type: "per_second", rates: { default: NaN } },
  "fal-ai/wan-t2v": { type: "flat_per_clip", rates: { "480p": 0.2, "720p": 0.4 } },
  "fal-ai/wan/v2.2-a14b/video-to-video": {
    type: "per_video_second",
    rates: { "480p": 0.04, "580p": 0.06, "720p": 0.08 },
    note: "video seconds at 16 fps",
  },
  "fal-ai/wan/v2.2-a14b/image-to-video/turbo": {
    type: "flat_per_clip",
    rates: { "480p": 0.05, "580p": 0.075, "720p": 0.1 },
  },
  "fal-ai/hunyuan-video": { type: "flat_per_clip", rates: { default: 0.4 } },
  "fal-ai/minimax/hailuo-02/standard/image-to-video": {
    type: "per_second",
    rates: { "512p": 0.017, "768p": 0.045 },
  },
  "fal-ai/minimax/hailuo-02/pro/image-to-video": {
    type: "per_second",
    rates: { "720p": 0.08 },
  },
  "fal-ai/seedvr/upscale/video": { type: "per_megapixel", usdPerMP: 0.015 },
  "fal-ai/topaz/upscale/video": { type: "per_second", rates: { default: NaN } },
};

let PRICING_OVERRIDES: Partial<Record<EngineId, Partial<PricingRule>>> = {};

export const setPricingOverrides = (json: string | null) => {
  if (!json) return;
  try {
    PRICING_OVERRIDES = JSON.parse(json) as Partial<Record<EngineId, Partial<PricingRule>>>;
  } catch {
    // Ignore override parsing errors in runtime contexts
  }
};

const round2 = (n: number) => Math.round(n * 100) / 100;

interface EngineVersionMeta {
  engine: EngineConfig;
  version: EngineVersionConfig;
  slug: EngineId;
  publicId: string;
}

const ENGINE_LOOKUP = new Map<string, EngineId>();
const ENGINE_META_BY_SLUG = new Map<EngineId, EngineVersionMeta>();

const registerLookup = (key: string | undefined, slug: EngineId) => {
  if (!key) return;
  if (!ENGINE_LOOKUP.has(key)) {
    ENGINE_LOOKUP.set(key, slug);
  }
};

const findAliasForSlug = (slug: string): string | undefined => {
  const direct = FAL_SLUG_TO_ENGINE_KEY.get(slug);
  if (direct) return direct;

  for (const [engineKey, specSlug] of ENGINE_KEY_TO_SPEC_SLUG.entries()) {
    if (specSlug.startsWith(slug) || slug.startsWith(specSlug)) {
      return engineKey;
    }
  }

  return undefined;
};

const collectEngineMetadata = () => {
  for (const engine of modelsConfig.engines) {
    for (const version of engine.versions) {
      const slug = version.falSlug as EngineId;

      const aliasFromSlug = findAliasForSlug(version.falSlug);
      const fallbackAlias = VERSION_ID_FALLBACK_ALIAS[version.id];
      const publicId = fallbackAlias ?? aliasFromSlug ?? version.id ?? slug;
      const meta: EngineVersionMeta = { engine, version, slug, publicId };
      ENGINE_META_BY_SLUG.set(slug, meta);
      registerLookup(slug, slug);
      registerLookup(version.id, slug);
      registerLookup(publicId, slug);

      if (publicId.includes("_")) {
        registerLookup(publicId.replace(/_/g, "-"), slug);
      }
      if (publicId.includes("-")) {
        registerLookup(publicId.replace(/-/g, "_"), slug);
      }

      const specSlug = ENGINE_KEY_TO_SPEC_SLUG.get(publicId);
      if (specSlug) {
        registerLookup(specSlug, slug);
      }
    }
  }
};

collectEngineMetadata();

const resolveEngineIdInternal = (engine: string): EngineId | undefined => {
  if (!engine) return undefined;
  if (ENGINE_LOOKUP.has(engine)) {
    return ENGINE_LOOKUP.get(engine);
  }

  const parts = engine.split("/");
  while (parts.length > 2) {
    parts.pop();
    const candidate = parts.join("/");
    if (ENGINE_LOOKUP.has(candidate)) {
      return ENGINE_LOOKUP.get(candidate);
    }
  }

  return undefined;
};

export const resolveEngineId = (engine: string): EngineId | undefined => resolveEngineIdInternal(engine);

function applyOverrides(engine: EngineId, base: PricingRule): PricingRule {
  const override = PRICING_OVERRIDES[engine];
  if (!override) return base;
  return { ...(base as Record<string, unknown>), ...(override as Record<string, unknown>) } as PricingRule;
}

function nullEstimate(reason: string, assumptions: string[]): Estimate {
  assumptions.push(reason);
  return { costUsd: null, currency: "USD", breakdown: [], assumptions };
}

function finalizeEstimate(
  baseCost: number | null,
  breakdown: string[],
  assumptions: string[],
  quantity: number,
): Estimate {
  if (baseCost == null) {
    return { costUsd: null, currency: "USD", breakdown: [], assumptions };
  }

  let total = baseCost;
  if (quantity > 1) {
    const multiplied = round2(baseCost * quantity);
    breakdown.push(`Quantity ×${quantity} → $${multiplied.toFixed(2)}`);
    total = multiplied;
  }

  return { costUsd: round2(total), currency: "USD", breakdown, assumptions };
}

export function estimateCost(rawInput: EstimateInput): Estimate {
  const assumptions: string[] = [];
  const breakdown: string[] = [];

  const engineId = resolveEngineIdInternal(rawInput.engine);
  if (!engineId) {
    return {
      costUsd: null,
      currency: "USD",
      breakdown: [],
      assumptions: [`No pricing rule found for engine "${rawInput.engine}"`],
    };
  }

  const baseRule = RATES[engineId];
  if (!baseRule) {
    return {
      costUsd: null,
      currency: "USD",
      breakdown: [],
      assumptions: [`Missing base pricing rule for ${engineId}`],
    };
  }

  const rule = applyOverrides(engineId, baseRule);
  const durationSec = rawInput.durationSec ?? rawInput.durationSeconds;
  const resolution = rawInput.resolution as string | undefined;
  const quantity = Math.max(1, rawInput.quantity ?? 1);

  switch (rule.type) {
    case "per_second": {
      let rate: number | undefined;
      if (rule.audioAware) {
        const key = rawInput.audioEnabled ? "audio_on" : "audio_off";
        rate = rule.rates[key];
        if (rate !== undefined) {
          breakdown.push(`Per-second rate (${key.replace("_", " ")}): $${rate.toFixed(2)}/s`);
        }
      } else {
        const resolutionKey = resolution ?? "default";
        rate = rule.rates[resolutionKey] ?? rule.rates.default;
        if (rate !== undefined) {
          breakdown.push(`Per-second rate${resolution ? ` @ ${resolution}` : ""}: $${rate.toFixed(2)}/s`);
        }
      }
      if (rate === undefined || durationSec === undefined) {
        return nullEstimate("Missing rate or duration", assumptions);
      }
      const cost = round2(rate * durationSec);
      breakdown.push(`Duration: ${durationSec}s → $${cost.toFixed(2)}`);
      if (engineId.startsWith("fal-ai/pika/")) {
        assumptions.push("Linearised from 5s example price on fal.ai.");
      }
      return finalizeEstimate(cost, breakdown, assumptions, quantity);
    }
    case "kling_tier": {
      if (durationSec === undefined) {
        return nullEstimate("Missing duration", assumptions);
      }
      const secsOver = Math.max(0, durationSec - rule.minSeconds);
      const cost = round2(rule.base5s + secsOver * rule.extraPerSecond);
      breakdown.push(
        `Base ${rule.minSeconds}s: $${rule.base5s.toFixed(2)} + ${secsOver}s × $${rule.extraPerSecond.toFixed(2)}/s`,
      );
      return finalizeEstimate(cost, breakdown, assumptions, quantity);
    }
    case "flat_per_clip": {
      let rate: number | undefined;
      if (resolution && rule.rates[resolution] != null) {
        rate = rule.rates[resolution];
      } else if (rule.rates.default != null) {
        rate = rule.rates.default;
      }

      if (engineId === "fal-ai/wan-t2v" && rawInput.frames && rawInput.frames > 81) {
        breakdown.push("Frames > default (81) → ×1.25");
        const base = rate ?? 0;
        const adjusted = round2(base * 1.25);
        return finalizeEstimate(adjusted, breakdown, assumptions, quantity);
      }

      if (rate === undefined) {
        return nullEstimate("Missing flat rate", assumptions);
      }

      breakdown.push(`Per-clip rate${resolution ? ` @ ${resolution}` : ""}: $${rate.toFixed(2)}`);
      return finalizeEstimate(rate, breakdown, assumptions, quantity);
    }
    case "per_video_second": {
      if (durationSec === undefined || !resolution) {
        return nullEstimate("Missing duration or resolution", assumptions);
      }
      const r = rule.rates[resolution];
      if (r === undefined) {
        return nullEstimate("Missing rate for resolution", assumptions);
      }
      const cost = round2(r * durationSec);
      breakdown.push(`Per-video-second rate @ ${resolution}: $${r.toFixed(2)}/s (${rule.note ?? "video seconds"})`);
      return finalizeEstimate(cost, breakdown, assumptions, quantity);
    }
    case "per_megapixel": {
      if (typeof rawInput.megapixels !== "number") {
        return nullEstimate("Missing megapixels for upscale", assumptions);
      }
      const cost = round2(rule.usdPerMP * rawInput.megapixels);
      breakdown.push(`${rawInput.megapixels} MP × $${rule.usdPerMP.toFixed(3)}/MP = $${cost.toFixed(2)}`);
      return finalizeEstimate(cost, breakdown, assumptions, quantity);
    }
    case "multipliers": {
      if (rule.baseUsd540p5s == null) {
        return nullEstimate("Base price not set (use override for Luma DM)", assumptions);
      }
      const resKey = (resolution ?? "540p").toLowerCase();
      const durKey = durationSec === 9 ? "9s" : "5s";
      const resMultiplier = rule.resMult[resKey] ?? 1;
      const durMultiplier = rule.durMult[durKey] ?? 1;
      const cost = round2(rule.baseUsd540p5s * resMultiplier * durMultiplier);
      breakdown.push(
        `Base 540p/5s: $${rule.baseUsd540p5s.toFixed(2)} × res ${resKey} ×${resMultiplier} × dur ${durKey} ×${durMultiplier}`,
      );
      return finalizeEstimate(cost, breakdown, assumptions, quantity);
    }
    default:
      return nullEstimate("Unsupported pricing mode", assumptions);
  }
}

export function estimateToCents(estimate: Estimate | null | undefined): number | null {
  if (!estimate || estimate.costUsd == null) {
    return null;
  }
  return Math.round(estimate.costUsd * 100);
}

export function listEngines(provider: "fal" = "fal") {
  if (provider !== "fal") {
    return [] as Array<{ id: string; label: string; versions: Array<{ id: string; label: string }> }>;
  }

  return modelsConfig.engines
    .map((engine) => {
      const versionMap = new Map<string, { id: string; label: string }>();

      engine.versions.forEach((version) => {
        const slug = resolveEngineIdInternal(version.falSlug);
        if (!slug) return;
      const meta = ENGINE_META_BY_SLUG.get(slug);
      if (!meta) return;
      if (!versionMap.has(meta.publicId)) {
        versionMap.set(meta.publicId, { id: meta.publicId, label: version.label });
      }
    });

    const versions = Array.from(versionMap.values());

      return { id: engine.id, label: engine.label, versions };
    })
    .filter((family) => family.versions.length > 0);
}

export function getUsageMeterForEngine(engine: string): "video_seconds_rendered" | "video_clips_rendered" {
  const engineId = resolveEngineIdInternal(engine);
  if (!engineId) {
    return "video_seconds_rendered";
  }
  const rule = applyOverrides(engineId, RATES[engineId]);
  switch (rule.type) {
    case "per_second":
    case "kling_tier":
    case "per_video_second":
      return "video_seconds_rendered";
    default:
      return "video_clips_rendered";
  }
}

export function getPricingRule(engine: string): PricingRule | undefined {
  const engineId = resolveEngineIdInternal(engine);
  if (!engineId) return undefined;
  const base = RATES[engineId];
  if (!base) return undefined;
  return applyOverrides(engineId, base);
}

export function getBaseRateForEngine(engine: string): number | null {
  const rule = getPricingRule(engine);
  if (!rule) return null;

  switch (rule.type) {
    case "per_second":
      if (rule.audioAware) {
        return rule.rates.audio_on ?? rule.rates.audio_off ?? null;
      }
      return rule.rates.default ?? Object.values(rule.rates)[0] ?? null;
    case "kling_tier":
      return rule.base5s;
    case "flat_per_clip":
      return rule.rates.default ?? Object.values(rule.rates)[0] ?? null;
    case "per_video_second":
      return Object.values(rule.rates)[0] ?? null;
    case "per_megapixel":
      return rule.usdPerMP;
    case "multipliers":
      return rule.baseUsd540p5s;
    default:
      return null;
  }
}

export function estimateMegapixels(
  width: number,
  height: number,
  seconds: number,
  fps = 24,
  scaleFactor = 4,
): number {
  const frames = seconds * fps;
  const scaledWidth = width * scaleFactor;
  const scaledHeight = height * scaleFactor;
  return (frames * scaledWidth * scaledHeight) / 1_000_000;
}

const overridesFromEnv = process.env.PRICING_OVERRIDES;
if (overridesFromEnv) {
  setPricingOverrides(overridesFromEnv);
}
