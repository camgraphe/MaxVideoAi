import type { AppLocale } from '@/i18n/locales';
import {
  AUTO_SPEC_LABELS,
  BEST_USE_CASE_ICON_KEYS,
  BEST_USE_CASE_ICON_RULES,
  COMPARE_COPY_BY_LOCALE,
  DEFAULT_CHIPS_BY_ICON,
  IMAGE_SPEC_ROW_DEFS,
  PRICE_AUDIO_LABELS,
  SECTION_LABELS,
  SPEC_ROW_LABEL_OVERRIDES,
  SPEC_TITLE_BASE,
  SPECS_DECISION_NOTES,
  VIDEO_SPEC_ROW_DEFS,
} from './model-page-specs-constants';
import type {
  BestUseCaseIconKey,
  BestUseCaseItem,
  KeySpecKey,
  KeySpecValues,
  SpecSection,
} from './model-page-specs-types';
import { localizeSpecStatus } from './model-page-spec-status';

export function buildDefaultSpecTitle(locale: AppLocale): string {
  return SPEC_TITLE_BASE[locale] ?? SPEC_TITLE_BASE.en;
}

export function normalizeSpecTitle(
  rawTitle: string | null,
  locale: AppLocale
): string {
  const cleanRaw = rawTitle?.trim();
  if (cleanRaw) return cleanRaw;
  return buildDefaultSpecTitle(locale);
}

export function normalizeSpecNote(_rawNote: string | null, locale: AppLocale): string | null {
  return SPECS_DECISION_NOTES[locale] ?? SPECS_DECISION_NOTES.en;
}

export function resolveSectionLabels(locale: AppLocale) {
  return SECTION_LABELS[locale] ?? SECTION_LABELS.en;
}

export function resolveSpecRowLabel(locale: AppLocale, key: KeySpecKey, isImageEngine: boolean): string {
  const overrides =
    (SPEC_ROW_LABEL_OVERRIDES[locale] ?? SPEC_ROW_LABEL_OVERRIDES.en)[isImageEngine ? 'image' : 'video'];
  const override = overrides[key];
  if (override) return override;
  const base = isImageEngine ? IMAGE_SPEC_ROW_DEFS : VIDEO_SPEC_ROW_DEFS;
  return base.find((row) => row.key === key)?.label ?? key;
}

export function resolveSpecRowDefs(locale: AppLocale, isImageEngine: boolean) {
  const base = isImageEngine ? IMAGE_SPEC_ROW_DEFS : VIDEO_SPEC_ROW_DEFS;
  return base.map((row) => ({
    ...row,
    label: resolveSpecRowLabel(locale, row.key, isImageEngine),
  }));
}

export function resolveAudioPricingLabels(locale: AppLocale) {
  return PRICE_AUDIO_LABELS[locale] ?? PRICE_AUDIO_LABELS.en;
}

export function resolveCompareCopy(locale: AppLocale, heroTitle: string, supportsAudio: boolean) {
  const copy = COMPARE_COPY_BY_LOCALE[locale] ?? COMPARE_COPY_BY_LOCALE.en;
  return {
    title: copy.title(heroTitle),
    introPrefix: copy.introPrefix(heroTitle),
    introStrong: copy.introStrong(supportsAudio),
    introSuffix: copy.introSuffix,
    subline: copy.subline,
    ctaCompare: (other: string) => copy.ctaCompare(heroTitle, other),
    ctaExplore: (other: string) => copy.ctaExplore(other),
    cardDescription: (other: string) => copy.cardDescription(heroTitle, other, supportsAudio),
  };
}

export function inferBestUseCaseIcon(title: string): BestUseCaseIconKey {
  const normalized = title.toLowerCase();
  for (const rule of BEST_USE_CASE_ICON_RULES) {
    if (rule.test.test(normalized)) return rule.icon;
  }
  return 'cinematic';
}

export function normalizeChips(rawChips: unknown, icon: BestUseCaseIconKey, locale?: AppLocale): string[] {
  const chips =
    Array.isArray(rawChips)
      ? rawChips.map((chip) => (typeof chip === 'string' ? chip.trim() : '')).filter(Boolean)
      : [];
  if (chips.length) return chips.slice(0, 2);
  if (locale === 'en') return DEFAULT_CHIPS_BY_ICON[icon].slice(0, 2);
  return [];
}

export function normalizeBestUseCaseItems(value: unknown, locale?: AppLocale): BestUseCaseItem[] {
  if (!Array.isArray(value)) return [];
  const items: BestUseCaseItem[] = [];
  for (const entry of value) {
    if (typeof entry === 'string') {
      const title = entry.trim();
      if (!title) continue;
      const icon = inferBestUseCaseIcon(title);
      items.push({
        title,
        icon,
        chips: normalizeChips(null, icon, locale),
      });
      continue;
    }
    if (!entry || typeof entry !== 'object') continue;
    const obj = entry as Record<string, unknown>;
    const title =
      typeof obj.title === 'string'
        ? obj.title.trim()
        : typeof obj.label === 'string'
          ? obj.label.trim()
          : '';
    if (!title) continue;
    const rawIcon = typeof obj.icon === 'string' ? obj.icon.trim() : '';
    const href = typeof obj.href === 'string' && obj.href.trim() ? obj.href.trim() : null;
    const icon =
      (rawIcon && BEST_USE_CASE_ICON_KEYS.includes(rawIcon as BestUseCaseIconKey)
        ? rawIcon
        : inferBestUseCaseIcon(title)) as BestUseCaseIconKey;
    const chips = normalizeChips(obj.chips, icon, locale);
    items.push({
      title,
      icon,
      chips,
      href,
    });
  }
  return items;
}

export function normalizeSecondaryCta(label: string | null): string | null {
  if (!label) return null;
  return label.replace(/\(1080p\)/gi, '(higher resolution)').replace(/\b1080p\b/gi, 'higher resolution').trim();
}

export function buildAutoSpecSections(values: KeySpecValues | null, locale: AppLocale): SpecSection[] {
  if (!values) return [];
  const labels = AUTO_SPEC_LABELS[locale] ?? AUTO_SPEC_LABELS.en;
  const inputs: string[] = [];
  const audio: string[] = [];

  inputs.push(`${labels.textToVideo}: ${localizeSpecStatus(values.textToVideo, locale)}`);
  inputs.push(`${labels.imageToVideo}: ${localizeSpecStatus(values.imageToVideo, locale)}`);
  inputs.push(`${labels.videoToVideo}: ${localizeSpecStatus(values.videoToVideo, locale)}`);
  inputs.push(`${labels.referenceImageStyle}: ${localizeSpecStatus(values.referenceImageStyle, locale)}`);
  inputs.push(`${labels.referenceVideo}: ${localizeSpecStatus(values.referenceVideo, locale)}`);

  audio.push(`${labels.audioOutput}: ${localizeSpecStatus(values.audioOutput, locale)}`);
  audio.push(`${labels.nativeAudio}: ${localizeSpecStatus(values.nativeAudioGeneration, locale)}`);
  audio.push(`${labels.lipSync}: ${localizeSpecStatus(values.lipSync, locale)}`);

  return [
    { title: labels.inputsTitle, items: inputs },
    { title: labels.audioTitle, items: audio },
  ];
}
