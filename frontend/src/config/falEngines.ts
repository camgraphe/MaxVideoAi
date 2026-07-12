import { getPartnerByBrandId } from '../lib/brand-partners';
import { getRuntimeModelById, toLegacyModelSurfaces } from '../../config/model-runtime';
import { RAW_FAL_ENGINE_REGISTRY } from './fal-engines/registry';
import type { FalEngineEntry, RawFalEngineEntry } from './fal-engines/types';

export type {
  EngineLogoPolicy,
  EngineUiCaps,
  EngineUiDurationCaps,
  FalEngineEntry,
  FalEngineFaqEntry,
  FalEngineMedia,
  FalEngineModeConfig,
  FalEnginePricingHint,
  FalEnginePromptHint,
  FalEngineSeoMeta,
} from './fal-engines/types';

function materializeFalEngineEntry(entry: RawFalEngineEntry): FalEngineEntry {
  const partnerBrand = getPartnerByBrandId(entry.brandId);
  const model = getRuntimeModelById(entry.id);
  if (!model) throw new Error(`Missing model registry entry for engine "${entry.id}"`);
  return {
    ...entry,
    modelSlug: model.slug,
    family: model.family ?? undefined,
    category: model.category,
    logoPolicy: partnerBrand?.policy.logoAllowed ? 'logoAllowed' : entry.logoPolicy,
    surfaces: toLegacyModelSurfaces(model),
  };
}

export const FAL_ENGINE_REGISTRY: readonly FalEngineEntry[] = RAW_FAL_ENGINE_REGISTRY.map(materializeFalEngineEntry);

export function listFalEngines(): FalEngineEntry[] {
  return FAL_ENGINE_REGISTRY.slice();
}

export function getEngineAliases(entry: FalEngineEntry): string[] {
  const aliases = new Set<string>();
  const add = (value: unknown) => {
    if (typeof value === 'string' && value.trim().length) {
      aliases.add(value.trim());
    }
  };
  add(entry.id);
  add(entry.engine.id);
  add(entry.defaultFalModelId);
  if (entry.engine?.providerMeta && typeof entry.engine.providerMeta.modelSlug === 'string') {
    add(entry.engine.providerMeta.modelSlug);
  }
  entry.modes.forEach((mode) => {
    add(mode.falModelId);
  });
  return Array.from(aliases);
}

export function listImageEngineAliases(): string[] {
  const aliasSet = new Set<string>();
  listFalEngines()
    .filter((engine) => (engine.category ?? 'video') === 'image')
    .forEach((entry) => {
      getEngineAliases(entry).forEach((alias) => aliasSet.add(alias));
    });
  return Array.from(aliasSet);
}

export function getFalEngineById(id: string): FalEngineEntry | undefined {
  return FAL_ENGINE_REGISTRY.find((entry) => entry.id === id);
}

const LEGACY_MODEL_SLUG_ALIASES: Record<string, string> = {
  'openai-sora-2': 'sora-2',
  'openai-sora-2-pro': 'sora-2-pro',
  'google-veo-3': 'veo-3-1',
  'veo-3': 'veo-3-1',
  veo3: 'veo-3-1',
  'veo3.1': 'veo-3-1',
  'google-omni-flash': 'gemini-omni-flash',
  'omni-flash': 'gemini-omni-flash',
  'gemini-omni': 'gemini-omni-flash',
  'gemini-omni-flash-preview': 'gemini-omni-flash',
  'google-veo-3-fast': 'veo-3-1-fast',
  'veo-3-fast': 'veo-3-1-fast',
  veo3fast: 'veo-3-1-fast',
  'veo3-fast': 'veo-3-1-fast',
  'google-veo-3-1-fast': 'veo-3-1-fast',
  'veo-3-1-first-last': 'veo-3-1',
  'veo-3-1-first-last-fast': 'veo-3-1-fast',
  'veo-3-lite': 'veo-3-1-lite',
  veo3lite: 'veo-3-1-lite',
  'veo3-lite': 'veo-3-1-lite',
  'veo3.1-lite': 'veo-3-1-lite',
  'seedance-2-fast': 'seedance-2-0-fast',
  'seedance-2.0-fast': 'seedance-2-0-fast',
  'seedance-v2-fast': 'seedance-2-0-fast',
  'seedance-v2.0-fast': 'seedance-2-0-fast',
  'seedance-fast': 'seedance-2-0-fast',
  happyhorse: 'happy-horse-1-1',
  'happy-horse': 'happy-horse-1-1',
  'happyhorse-1-1': 'happy-horse-1-1',
  'happy-horse-1.1': 'happy-horse-1-1',
  'alibaba-happy-horse': 'happy-horse-1-1',
  'happyhorse-1-0': 'happy-horse-1-0',
  'happy-horse-1.0': 'happy-horse-1-0',
  'ltx-2-3': 'ltx-2-3-pro',
  'pika-2-2': 'pika-text-to-video',
  'pika-image-to-video': 'pika-text-to-video',
  'minimax-video-01': 'minimax-hailuo-02-text',
  'minimax-video-1': 'minimax-hailuo-02-text',
  'minimax-hailuo-02': 'minimax-hailuo-02-text',
  'minimax-hailuo-02-pro': 'minimax-hailuo-02-text',
  'minimax-hailuo-02-image': 'minimax-hailuo-02-text',
  'hailuo-2-pro': 'minimax-hailuo-02-text',
  'kling-25-turbo-pro': 'kling-2-5-turbo',
  'kling-2-5-turbo-pro': 'kling-2-5-turbo',
};

export function canonicalizeFalModelSlug(slug: string): string {
  const normalized = slug.trim().toLowerCase();
  return LEGACY_MODEL_SLUG_ALIASES[normalized] ?? normalized;
}

export function getFalEngineBySlug(slug: string): FalEngineEntry | undefined {
  const normalized = slug.trim().toLowerCase();
  const canonicalSlug = canonicalizeFalModelSlug(slug);

  const directMatch = FAL_ENGINE_REGISTRY.find((entry) => entry.modelSlug.toLowerCase() === canonicalSlug);
  if (directMatch) {
    return directMatch;
  }

  return FAL_ENGINE_REGISTRY.find((entry) => {
    const aliases = getEngineAliases(entry).map((alias) => alias.trim().toLowerCase());
    return aliases.includes(normalized);
  });
}
