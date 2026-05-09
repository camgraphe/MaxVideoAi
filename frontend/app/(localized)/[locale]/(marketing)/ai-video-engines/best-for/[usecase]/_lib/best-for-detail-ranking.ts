import path from 'node:path';
import { promises as fs } from 'node:fs';
import type { AppLocale } from '@/i18n/locales';
import {
  ENGINE_BY_SLUG,
  ENGINE_CATALOG,
  type BestForDetailCopy,
  type BestForEntry,
  type EngineScore,
  type EngineScoresFile,
  type RankedPick,
} from './best-for-detail-config';

export async function loadEngineScores(): Promise<Map<string, EngineScore>> {
  const candidates = [
    path.join(process.cwd(), 'data', 'benchmarks', 'engine-scores.v1.json'),
    path.join(process.cwd(), '..', 'data', 'benchmarks', 'engine-scores.v1.json'),
  ];
  for (const candidate of candidates) {
    try {
      const raw = await fs.readFile(candidate, 'utf8');
      const data = JSON.parse(raw) as EngineScoresFile;
      const map = new Map<string, EngineScore>();
      (data.scores ?? []).forEach((entry) => {
        const key = entry.modelSlug ?? entry.engineId;
        if (key) {
          map.set(key, entry);
        }
      });
      return map;
    } catch {
      // keep trying
    }
  }
  return new Map();
}

const USECASE_WEIGHTS: Record<string, Partial<Record<keyof EngineScore, number>>> = {
  'ugc-ads': { motion: 0.3, fidelity: 0.25, consistency: 0.2, lipsyncQuality: 0.15, textRendering: 0.1 },
  'product-videos': { fidelity: 0.35, consistency: 0.25, anatomy: 0.2, motion: 0.1, textRendering: 0.1 },
  'lipsync-dialogue': { lipsyncQuality: 0.4, consistency: 0.2, fidelity: 0.2, motion: 0.1, anatomy: 0.1 },
  'cinematic-realism': { fidelity: 0.35, motion: 0.25, consistency: 0.2, anatomy: 0.1, textRendering: 0.1 },
  'fast-drafts': { motion: 0.3, consistency: 0.25, fidelity: 0.2, textRendering: 0.15, anatomy: 0.1 },
  'vertical-shorts': { motion: 0.3, consistency: 0.25, fidelity: 0.2, textRendering: 0.15, anatomy: 0.1 },
  'image-to-video': { consistency: 0.3, fidelity: 0.3, motion: 0.2, anatomy: 0.1, textRendering: 0.1 },
  'stylized-anime': { consistency: 0.3, motion: 0.25, fidelity: 0.2, textRendering: 0.15, anatomy: 0.1 },
  'character-reference': { consistency: 0.4, anatomy: 0.2, fidelity: 0.2, motion: 0.1, textRendering: 0.1 },
  'reference-to-video': { consistency: 0.35, fidelity: 0.3, motion: 0.2, anatomy: 0.1, textRendering: 0.05 },
  'multi-shot-video': { sequencingQuality: 0.35, consistency: 0.25, motion: 0.2, fidelity: 0.15, anatomy: 0.05 },
  '4k-video': { fidelity: 0.45, consistency: 0.25, motion: 0.15, anatomy: 0.1, textRendering: 0.05 },
  ads: { fidelity: 0.3, consistency: 0.25, textRendering: 0.2, motion: 0.15, anatomy: 0.1 },
};

function scoreEngineForUsecase(score: EngineScore, weights: Partial<Record<keyof EngineScore, number>>) {
  let total = 0;
  let weightSum = 0;
  Object.entries(weights).forEach(([key, weight]) => {
    const value = score[key as keyof EngineScore];
    if (typeof value === 'number' && typeof weight === 'number') {
      total += value * weight;
      weightSum += weight;
    }
  });
  if (weightSum === 0) return 0;
  return total / weightSum;
}

export function resolveTopPicks(entry: BestForEntry, scores: Map<string, EngineScore>): string[] {
  if (entry.topPicks?.length) return entry.topPicks;
  const weights = USECASE_WEIGHTS[entry.slug] ?? {};
  const ranked = ENGINE_CATALOG.map((engine) => {
    const score = scores.get(engine.modelSlug) ?? (engine.engineId ? scores.get(engine.engineId) : null) ?? null;
    const value = score ? scoreEngineForUsecase(score, weights) : 0;
    return { slug: engine.modelSlug, value };
  })
    .sort((a, b) => b.value - a.value)
    .slice(0, 3)
    .map((entry) => entry.slug);
  return ranked.length ? ranked : ENGINE_CATALOG.slice(0, 3).map((engine) => engine.modelSlug);
}

export function buildRankedPick({
  usecaseSlug,
  modelSlug,
  rank,
  scores,
  criteria,
  copy,
  locale,
}: {
  usecaseSlug: string;
  modelSlug: string;
  rank: number;
  scores: Map<string, EngineScore>;
  criteria: string[];
  copy: BestForDetailCopy;
  locale: AppLocale;
}): RankedPick {
  const engine = ENGINE_BY_SLUG.get(modelSlug);
  const score = getFitScore(usecaseSlug, scores.get(modelSlug) ?? (engine?.engineId ? scores.get(engine.engineId) : undefined));
  const criterion = criteria[(rank - 1) % criteria.length] ?? criteria[0] ?? copy.fit;
  const fallbackScore = Math.max(6.8, 8.6 - rank * 0.22);
  return {
    slug: modelSlug,
    engine,
    rank,
    criterion,
    score: score ?? fallbackScore,
    accent: getEngineAccent(modelSlug),
    reason: buildPickReason(locale, usecaseSlug, criterion, rank),
    bullets: buildPickBullets(locale, criteria, rank),
  };
}

function buildPickReason(locale: AppLocale, usecaseSlug: string, criterion: string, rank: number) {
  const prefixes: Record<AppLocale, string[]> = {
    en: ['Best balance of', 'Strong option for', 'Useful when you need'],
    fr: ['Meilleur équilibre pour', 'Option forte pour', 'Utile si vous cherchez'],
    es: ['Mejor equilibrio para', 'Opción fuerte para', 'Útil si necesitas'],
  };
  const suffixes: Record<string, Record<AppLocale, string>> = {
    'cinematic-realism': {
      en: 'cinematic camera direction',
      fr: 'une direction caméra cinématique',
      es: 'dirección de cámara cinematográfica',
    },
    'character-reference': {
      en: 'stable identity across shots',
      fr: 'une identité stable entre les plans',
      es: 'identidad estable entre planos',
    },
    'reference-to-video': {
      en: 'controlled reference workflows',
      fr: 'des workflows de référence contrôlés',
      es: 'workflows de referencia controlados',
    },
    'multi-shot-video': {
      en: 'planned sequences',
      fr: 'des séquences planifiées',
      es: 'secuencias planificadas',
    },
    '4k-video': {
      en: 'final delivery detail',
      fr: 'le niveau de détail final',
      es: 'detalle para entrega final',
    },
    ads: {
      en: 'campaign-ready output',
      fr: 'un rendu prêt pour campagne',
      es: 'salidas listas para campaña',
    },
    'ugc-ads': {
      en: 'creator-style social clips',
      fr: 'des clips sociaux style créateur',
      es: 'clips sociales estilo creador',
    },
    'product-videos': {
      en: 'clean product storytelling',
      fr: 'un storytelling produit propre',
      es: 'storytelling de producto limpio',
    },
    'lipsync-dialogue': {
      en: 'speaking character control',
      fr: 'le contrôle de personnages parlants',
      es: 'control de personajes con diálogo',
    },
    'fast-drafts': {
      en: 'fast iteration loops',
      fr: 'des boucles d’itération rapides',
      es: 'ciclos rápidos de iteración',
    },
    'stylized-anime': {
      en: 'stylized motion',
      fr: 'du mouvement stylisé',
      es: 'movimiento estilizado',
    },
    'image-to-video': {
      en: 'motion from approved images',
      fr: 'l’animation depuis images validées',
      es: 'movimiento desde imágenes aprobadas',
    },
  };
  const prefix = prefixes[locale]?.[Math.min(rank - 1, 2)] ?? prefixes.en[Math.min(rank - 1, 2)];
  const suffix = suffixes[usecaseSlug]?.[locale] ?? suffixes[usecaseSlug]?.en ?? (locale === 'fr' ? 'ce cas d’usage' : locale === 'es' ? 'este objetivo' : 'this use case');
  const connector = locale === 'en' ? 'for' : locale === 'es' ? 'en' : 'sur';
  return `${prefix} ${criterion.toLowerCase()} ${connector} ${suffix}.`;
}

function buildPickBullets(locale: AppLocale, criteria: string[], rank: number) {
  const primary = criteria[(rank - 1) % criteria.length] ?? criteria[0] ?? 'Use-case fit';
  const secondary = criteria[rank % criteria.length] ?? criteria[1] ?? 'Reliable output';
  const tertiary = criteria[(rank + 1) % criteria.length] ?? criteria[2] ?? 'Efficient review loop';
  const labels: Record<AppLocale, [string, string, string]> = {
    en: ['Strong', 'Good', 'Practical'],
    fr: ['Fort sur', 'Bon sur', 'Pratique pour'],
    es: ['Fuerte en', 'Bueno en', 'Práctico para'],
  };
  const [first, second, third] = labels[locale] ?? labels.en;
  return [`${first} ${primary.toLowerCase()}`, `${second} ${secondary.toLowerCase()}`, `${third} ${tertiary.toLowerCase()}`];
}

function getFitScore(slug: string, score?: EngineScore) {
  if (!score) return undefined;
  const weights = USECASE_WEIGHTS[slug] ?? {};
  const value = scoreEngineForUsecase(score, weights);
  return value > 0 ? value : undefined;
}

function getEngineAccent(slug: string) {
  if (slug.includes('kling')) return '#7c3aed';
  if (slug.includes('seedance')) return '#0ea5e9';
  if (slug.includes('veo')) return '#22c55e';
  if (slug.includes('sora')) return '#111827';
  if (slug.includes('ltx')) return '#f59e0b';
  if (slug.includes('pika')) return '#ec4899';
  if (slug.includes('minimax')) return '#f97316';
  if (slug.includes('wan')) return '#6366f1';
  return '#6366f1';
}
