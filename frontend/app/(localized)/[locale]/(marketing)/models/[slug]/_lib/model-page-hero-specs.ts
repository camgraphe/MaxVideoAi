import type { AppLocale } from '@/i18n/locales';
import { getLocalizedHeroChipLabels } from '@/lib/ltx-localization';
import { HERO_LIMITS_LINES } from './model-page-specs-constants';
import type {
  HeroSpecChip,
  HeroSpecIconKey,
  KeySpecValues,
} from './model-page-specs-types';
import {
  isPending,
  isSupported,
} from './model-page-spec-status';

export function normalizeMaxResolution(value: string) {
  if (value.includes('/') || value.includes(',')) return value;
  const matchP = value.match(/(\d{3,4}p)/i);
  if (matchP) return matchP[1];
  const matchK = value.match(/(\d+)\s?k/i);
  if (matchK) return `${matchK[1]}K`;
  return value;
}

export function formatHeroLimitChip(label: string | undefined, value: string) {
  return label ? `${label}: ${value}` : value;
}

export function resolveHeroLimitsLine(locale: AppLocale) {
  return HERO_LIMITS_LINES[locale] ?? HERO_LIMITS_LINES.en;
}

export function buildAutoHeroSpecChips(values: KeySpecValues | null, locale: AppLocale): HeroSpecChip[] {
  if (!values) return [];
  const chips: HeroSpecChip[] = [];
  const labels = getLocalizedHeroChipLabels(locale);
  const add = (label: string | null, icon: HeroSpecIconKey | null) => {
    if (!label) return;
    chips.push({ label, icon });
  };

  const resolution = values.maxResolution && !isPending(values.maxResolution)
    ? normalizeMaxResolution(values.maxResolution)
    : null;
  const duration = values.maxDuration && !isPending(values.maxDuration) ? values.maxDuration.replace(' max', '') : null;
  const aspect = values.aspectRatios && !isPending(values.aspectRatios) ? values.aspectRatios : null;

  if (isSupported(values.textToImage)) add(labels.textToImage, 'textToVideo');
  if (isSupported(values.imageToImage)) add(labels.imageToImage, 'imageToVideo');
  if (isSupported(values.textToVideo)) add(labels.textToVideo, 'textToVideo');
  if (isSupported(values.imageToVideo)) add(labels.imageToVideo, 'imageToVideo');
  if (resolution) add(formatHeroLimitChip(labels.maxResolution, resolution), 'resolution');
  if (duration) add(formatHeroLimitChip(labels.maxDuration, duration), 'duration');
  if (aspect) add(aspect, 'aspectRatio');
  if (isSupported(values.audioOutput) || isSupported(values.nativeAudioGeneration)) add(labels.audio, 'audio');

  return chips.slice(0, 6);
}

export function normalizeHeroTitle(rawTitle: string, providerName: string | null): string {
  const trimmed = rawTitle.trim();
  const splitMatch = trimmed.split(/\s[–—-]\s/);
  const base = splitMatch[0] ?? trimmed;
  const cleanProvider = providerName?.trim();
  if (cleanProvider && base.toLowerCase().startsWith(cleanProvider.toLowerCase() + ' ')) {
    return base.slice(cleanProvider.length + 1).trim();
  }
  if (base.toLowerCase().startsWith('openai ')) {
    return base.slice('openai '.length).trim();
  }
  return base.trim();
}

export function buildEyebrow(providerName: string | null): string | null {
  if (!providerName) return null;
  const normalized = providerName
    .replace(/by\s+.+$/i, '')
    .replace(/\s+DeepMind$/i, '')
    .trim();
  return normalized ? `${normalized} model` : null;
}

export function joinUseCaseList(items: string[], maxItems = 3): string | null {
  const cleaned = items.map((item) => item.replace(/\.$/, '').trim()).filter(Boolean);
  if (!cleaned.length) return null;
  const slice = cleaned.slice(0, maxItems);
  if (slice.length === 1) return slice[0];
  if (slice.length === 2) return `${slice[0]} and ${slice[1]}`;
  return `${slice.slice(0, -1).join(', ')}, and ${slice[slice.length - 1]}`;
}

export function buildSupportLine(items: string[]): string | null {
  const list = joinUseCaseList(items);
  if (!list) return null;
  return `Best for ${list}.`;
}

export function normalizeHeroSubtitle(text: string, locale: AppLocale): string {
  if (!text) return text;
  if (locale !== 'en') return text;
  let output = text;
  output = output.replace(/\b(in|inside|via|on)\s+MaxVideoAI\b/gi, '');
  output = output.replace(/\bMaxVideoAI\b/gi, '');
  let aiCount = 0;
  output = output.replace(/\bAI\b/gi, (match) => {
    aiCount += 1;
    return aiCount === 1 ? match : '';
  });
  output = output.replace(/([.?!])\s*,\s*/g, '$1 ');
  output = output.replace(/,\s*([.?!])/g, '$1');
  output = output.replace(/\s{2,}/g, ' ').replace(/\s+([,.;:!?])/g, '$1').trim();
  output = output.replace(/([.?!]\s+)([a-z])/g, (_, boundary: string, letter: string) => `${boundary}${letter.toUpperCase()}`);
  return output;
}
