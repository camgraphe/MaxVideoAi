import { pricingConfig } from "@/config/pricing";
import { getModelSpec } from "@/data/models";
import { getFalApiBase, getFalCredentials } from "@/lib/env";
const MARKUP = Number(process.env.FAL_PRICE_MARKUP ?? 1.3);
const CACHE_TTL = Number(process.env.FAL_PRICE_CACHE_TTL_MS ?? 5 * 60 * 1000);

interface CachedRate {
  value: number;
  expiresAt: number;
}

const cache = new Map<string, CachedRate>();
const FAL_BASE = getFalApiBase();

async function fetchFalPipelinePricing(falSlug: string): Promise<number | null> {
  const key = getFalCredentials();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.FAL_TIMEOUT_MS ?? 120000));
  try {
    const endpoint = new URL(`/api/v1/pipelines/${falSlug}`, FAL_BASE);
    const response = await fetch(endpoint, {
      headers: {
        Authorization: `Key ${key}`,
        Accept: "application/json",
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      console.warn(`[fal-pricing] Failed to load pricing for ${falSlug}: ${response.status}`);
      return null;
    }
    const data = (await response.json()) as {
      pricing?: { usd?: { per_second?: number }; per_second?: number };
    };
    const value = data.pricing?.usd?.per_second ?? data.pricing?.per_second ?? null;
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      console.warn(`[fal-pricing] Pricing request for ${falSlug} timed out.`);
      return null;
    }
    console.error(`[fal-pricing] Unexpected error while loading pricing for ${falSlug}`, error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function applyMarkup(perSecondUsd: number): number {
  return Math.round(perSecondUsd * MARKUP * 100000) / 100000;
}

function getFallbackPrice(engine: string): number | null {
  const fallback = pricingConfig.fal?.[engine as keyof typeof pricingConfig.fal];
  if (!fallback) return null;
  return fallback.per_second;
}

export async function getFalRate(engine: string): Promise<number> {
  const cached = cache.get(engine);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const spec = getModelSpec("fal", engine);
  const slug = spec?.falSlug;
  let basePrice = null;
  if (slug) {
    basePrice = await fetchFalPipelinePricing(slug);
  }

  if (basePrice === null) {
    const fallback = getFallbackPrice(engine);
    if (fallback === null) {
      throw new Error(`No pricing information available for FAL engine '${engine}'.`);
    }
    basePrice = fallback;
  }

  const markedUp = applyMarkup(basePrice);
  cache.set(engine, { value: markedUp, expiresAt: now + CACHE_TTL });
  return markedUp;
}

export async function getFalRates(): Promise<Record<string, number>> {
  const engines = Object.keys(pricingConfig.fal ?? {});
  const entries = await Promise.all(
    engines.map(async (engine) => {
      try {
        const price = await getFalRate(engine);
        return [engine, price] as const;
      } catch (error) {
        console.warn(`[fal-pricing] Falling back for engine ${engine}`, error);
        const fallback = getFallbackPrice(engine) ?? 0;
        return [engine, applyMarkup(fallback)] as const;
      }
    }),
  );
  return Object.fromEntries(entries);
}

export function getCachedFalRates(): Record<string, number> {
  const result: Record<string, number> = {};
  for (const engine of Object.keys(pricingConfig.fal ?? {})) {
    const cached = cache.get(engine);
    if (cached) {
      result[engine] = cached.value;
    }
  }
  return result;
}
