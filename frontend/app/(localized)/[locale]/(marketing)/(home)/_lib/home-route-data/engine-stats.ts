import { listFalEngines } from '@/config/falEngines';
import { localeRegions, type AppLocale } from '@/i18n/locales';
import type { LocalizedLinkHref } from '@/i18n/navigation';
import type { ProofStat } from '@/components/marketing/home/HomeRedesignSections';
import type { Mode } from '@/types/engines';
import { HOME_ROUTE_MAP, SUCCESSFUL_GENERATION_PROOF_MINIMUM } from './constants';
import type { EngineStats, RedesignContent } from './types';

function countMode(engines: ReturnType<typeof listFalEngines>, mode: Mode) {
  return engines.filter((entry) => entry.engine.modes.includes(mode)).length;
}

export function computeEngineStats(): EngineStats {
  const engines = listFalEngines();
  return {
    total: engines.length,
    providers: new Set(engines.map((entry) => entry.provider)).size,
    textToVideo: countMode(engines, 't2v'),
    imageToVideo: countMode(engines, 'i2v'),
    videoToVideo: countMode(engines, 'v2v'),
    audio: engines.filter((entry) => entry.engine.audio).length,
    fourK: engines.filter((entry) =>
      (entry.engine.resolutions ?? []).some((resolution) => String(resolution).toLowerCase().includes('4k'))
    ).length,
    extend: engines.filter((entry) => entry.engine.extend || entry.engine.modes.includes('extend')).length,
    retake: countMode(engines, 'retake'),
    audioToVideo: countMode(engines, 'a2v'),
  };
}

function resolveProofValue(id: string, stats: EngineStats): string {
  switch (id) {
    case 'engines':
      return String(stats.total);
    case 'providers':
      return String(stats.providers);
    case 'textToVideo':
      return String(stats.textToVideo);
    case 'imageToVideo':
      return String(stats.imageToVideo);
    case 'videoToVideo':
      return String(stats.videoToVideo);
    case 'audio':
      return String(stats.audio);
    case 'fourK':
      return stats.fourK > 0 ? '4K' : '1080p+';
    default:
      return '';
  }
}

function formatProofNumber(locale: AppLocale, value: number): string {
  return new Intl.NumberFormat(localeRegions[locale] ?? 'en-US', {
    maximumFractionDigits: 0,
  }).format(value);
}

export function buildProofStats(
  content: RedesignContent,
  stats: EngineStats,
  locale: AppLocale,
  successfulGenerationCount: number | null
): ProofStat[] {
  const hrefByProofId: Partial<Record<string, LocalizedLinkHref>> = {
    engines: HOME_ROUTE_MAP.models,
    providers: HOME_ROUTE_MAP.models,
    textToVideo: HOME_ROUTE_MAP.models,
    imageToVideo: HOME_ROUTE_MAP.models,
    videoToVideo: HOME_ROUTE_MAP.models,
    audio: HOME_ROUTE_MAP.models,
    fourK: HOME_ROUTE_MAP.models,
    successfulGenerations: HOME_ROUTE_MAP.examples,
  };

  return content.proof.items.flatMap((item) => {
    if (item.id === 'successfulGenerations') {
      if (successfulGenerationCount == null || successfulGenerationCount < SUCCESSFUL_GENERATION_PROOF_MINIMUM) return [];
      return [
        {
          id: item.id,
          value: formatProofNumber(locale, successfulGenerationCount),
          label: item.label,
          href: hrefByProofId[item.id],
        },
      ];
    }

    return [
      {
        id: item.id,
        value: resolveProofValue(item.id, stats),
        label: item.label,
        href: hrefByProofId[item.id],
      },
    ];
  });
}
