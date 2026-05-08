import type { FalEngineEntry } from '@/config/falEngines';
import type { AppLocale } from '@/i18n/locales';
import { getLocalizedHeroChipLabels } from '@/lib/ltx-localization';
import { applyDisplayedPriceMarginCents } from '@/lib/pricing-display';
import type { EngineCaps, Mode } from '@/types/engines';
import {
  AUTO_SPEC_LABELS,
  BEST_USE_CASE_ICON_KEYS,
  BEST_USE_CASE_ICON_RULES,
  COMPARE_COPY_BY_LOCALE,
  DEFAULT_CHIPS_BY_ICON,
  HERO_LIMITS_LINES,
  IMAGE_SPEC_ROW_DEFS,
  PRICE_AUDIO_LABELS,
  SECTION_LABELS,
  SPEC_ROW_LABEL_OVERRIDES,
  SPEC_STATUS_LABELS,
  SPEC_TITLE_BASE,
  SPECS_DECISION_NOTES,
  VIDEO_SPEC_ROW_DEFS,
} from './model-page-specs-constants';
import type {
  BestUseCaseIconKey,
  BestUseCaseItem,
  HeroSpecChip,
  HeroSpecIconKey,
  KeySpecKey,
  KeySpecValues,
  SpecSection,
} from './model-page-specs-types';

export {
  BEST_USE_CASE_ICON_MAP,
  FULL_BLEED_CONTENT,
  FULL_BLEED_SECTION,
  GENERIC_TRUST_LINE,
  HERO_AUTOPLAY_DELAY_MS,
  HERO_BG,
  HERO_SPEC_ICON_MAP,
  PRICE_AUDIO_LABELS,
  SECTION_BG_A,
  SECTION_BG_B,
  SECTION_PAD,
  SECTION_SCROLL_MARGIN,
  TIPS_CARD_LABELS,
} from './model-page-specs-constants';

export type {
  BestUseCaseIconKey,
  BestUseCaseItem,
  HeroSpecChip,
  HeroSpecIconKey,
  KeySpecKey,
  KeySpecRow,
  KeySpecValues,
  LocalizedFaqEntry,
  PromptingTab,
  PromptingTabId,
  QuickStartBlock,
  RelatedItem,
  SoraCopy,
  SpecSection,
} from './model-page-specs-types';

export function resolveKeySpecValue(
  specs: Record<string, unknown> | undefined,
  key: string,
  fallback: string
): string {
  if (!specs || !(key in specs)) return fallback;
  const value = (specs as Record<string, unknown>)[key];
  if (Array.isArray(value)) {
    return value.length ? value.join(' / ') : fallback;
  }
  if (value == null) return fallback;
  const normalized = String(value).trim();
  if (/^(yes|true)$/i.test(normalized)) return 'Supported';
  if (/^(no|false)$/i.test(normalized)) return 'Not supported';
  return normalized;
}

export function resolveStatus(value?: boolean | null) {
  if (value === true) return 'Supported';
  if (value === false) return 'Not supported';
  return 'Data pending';
}

export function resolveModeSupported(engineCaps: EngineCaps | undefined, mode: Mode | 'v2v') {
  const modes = engineCaps?.modes ?? [];
  if (!modes.length) return 'Data pending';
  return modes.includes(mode as Mode) ? 'Supported' : 'Not supported';
}

export function resolveVideoToVideoSupport(engineCaps: EngineCaps | undefined) {
  const modes = engineCaps?.modes ?? [];
  if (!modes.length) return 'Data pending';
  if (modes.includes('v2v') && modes.includes('reframe')) return 'Supported (modify / reframe workflows)';
  if (modes.some((mode) => String(mode) === 'v2v')) return 'Supported';
  if (modes.includes('reframe')) return 'Supported (reframe workflow)';
  if (modes.includes('extend') || modes.includes('retake')) {
    return 'Supported (extend / retake workflows)';
  }
  return 'Not supported';
}

export function resolveFirstLastSupport(engineCaps: EngineCaps | undefined) {
  const modes = engineCaps?.modes ?? [];
  if (modes.includes('fl2v')) return 'Supported';
  if (engineCaps?.keyframes != null) return resolveStatus(engineCaps.keyframes);
  return modes.length ? 'Not supported' : 'Data pending';
}

export function resolveReferenceImageSupport(engineCaps: EngineCaps | undefined) {
  const modes = engineCaps?.modes ?? [];
  if (!modes.length) return 'Data pending';
  if (modes.includes('ref2v') || modes.includes('r2v')) return 'Supported (multi reference stills)';
  if (modes.includes('i2v')) return 'Supported (single start image)';
  return 'Not supported';
}

export function resolveReferenceVideoSupport(engineCaps: EngineCaps | undefined) {
  const modes = engineCaps?.modes ?? [];
  if (!modes.length) return 'Data pending';
  if (modes.includes('v2v') || modes.includes('reframe')) {
    return 'Supported (source clip for modify / reframe)';
  }
  if (modes.includes('r2v')) return 'Supported';
  if (modes.includes('extend') || modes.includes('retake')) {
    return 'Supported (source clip for extend / retake)';
  }
  return 'Not supported';
}

export function formatMaxResolution(engineCaps: EngineCaps | undefined) {
  const resolutions = engineCaps?.resolutions ?? [];
  if (!resolutions.length) return 'Data pending';
  if (resolutions.some((value) => /4k/i.test(String(value)))) return '4K';
  if (resolutions.some((value) => /2k/i.test(String(value)))) return '2K';
  const numeric = resolutions
    .map((value) => {
      const raw = String(value).toLowerCase();
      if (raw.includes('square_hd') || raw.includes('portrait_hd') || raw.includes('landscape_hd')) {
        return 720;
      }
      const matchK = raw.match(/(\d+)\s*k/);
      if (matchK) return Number(matchK[1]) * 1000;
      const matchP = raw.match(/(\d+)\s*p/);
      return matchP ? Number(matchP[1]) : null;
    })
    .filter((value): value is number => value != null);
  if (!numeric.length) return resolutions.join(' / ');
  const max = Math.max(...numeric);
  return `${max}p`;
}

export function formatDuration(engineCaps: EngineCaps | undefined) {
  const max = engineCaps?.maxDurationSec;
  return typeof max === 'number' ? `${max}s max` : 'Data pending';
}

export function formatAspectRatios(engineCaps: EngineCaps | undefined) {
  const ratios = engineCaps?.aspectRatios ?? [];
  return ratios.length ? ratios.join(' / ') : 'Data pending';
}

export function formatFps(engineCaps: EngineCaps | undefined) {
  const fps = engineCaps?.fps ?? [];
  return fps.length ? fps.join(' / ') : 'Data pending';
}

export function formatImageResolutions(engineCaps: EngineCaps | undefined) {
  const resolutions = engineCaps?.resolutions ?? [];
  return resolutions.length ? resolutions.join(' / ') : 'Data pending';
}

export function formatOutputFormats(entry: FalEngineEntry) {
  const engineCaps = entry.engine;
  const fields = [...(engineCaps?.inputSchema?.required ?? []), ...(engineCaps?.inputSchema?.optional ?? [])];
  const outputFormatField = fields.find((field) => field.id === 'output_format');
  const outputFormatValues =
    outputFormatField && 'values' in outputFormatField && Array.isArray(outputFormatField.values)
      ? outputFormatField.values
      : [];
  if (outputFormatValues.length) {
    return outputFormatValues.join(' / ');
  }
  const rendersVideo =
    entry.type === 'video' ||
    (engineCaps?.modes ?? []).some((mode) =>
      ['t2v', 'i2v', 'v2v', 'ref2v', 'r2v', 'fl2v', 'extend', 'reframe', 'retake'].includes(mode)
    );
  return rendersVideo ? 'MP4' : 'Data pending';
}

export function getPricePerSecondCents(engineCaps: EngineCaps | undefined): number | null {
  const perSecond = engineCaps?.pricingDetails?.perSecondCents;
  const byResolution = perSecond?.byResolution ? Object.values(perSecond.byResolution) : [];
  const cents = perSecond?.default ?? (byResolution.length ? Math.min(...byResolution) : null);
  if (typeof cents === 'number') {
    return applyDisplayedPriceMarginCents(cents);
  }
  const base = engineCaps?.pricing?.base;
  if (typeof base === 'number') {
    return applyDisplayedPriceMarginCents(Math.round(base * 100));
  }
  return null;
}

export function getPricePerImageCents(engineCaps: EngineCaps | undefined): number | null {
  const flat = engineCaps?.pricingDetails?.flatCents;
  const byResolution = flat?.byResolution ? Object.values(flat.byResolution) : [];
  const cents = flat?.default ?? (byResolution.length ? Math.min(...byResolution) : null);
  if (typeof cents === 'number') {
    return applyDisplayedPriceMarginCents(cents);
  }
  const base = engineCaps?.pricing?.base;
  if (typeof base === 'number') {
    return applyDisplayedPriceMarginCents(Math.round(base * 100));
  }
  return null;
}

export function formatPricePerSecond(engineCaps: EngineCaps | undefined): string {
  const cents = getPricePerSecondCents(engineCaps);
  if (typeof cents === 'number') {
    return `$${(cents / 100).toFixed(2)}/s`;
  }
  return 'Data pending';
}

export function formatPricePerImage(engineCaps: EngineCaps | undefined): string {
  const cents = getPricePerImageCents(engineCaps);
  if (typeof cents === 'number') {
    return `$${(cents / 100).toFixed(2)}/image`;
  }
  return 'Data pending';
}

export function buildSpecValues(
  entry: FalEngineEntry,
  specs: Record<string, unknown> | undefined,
  pricingOverrides?: { pricePerSecond?: string | null; pricePerImage?: string | null }
): KeySpecValues {
  const engineCaps = entry.engine;
  const isImage = entry.type === 'image' || engineCaps.modes?.some((mode) => mode.endsWith('i'));
  return {
    pricePerImage: resolveKeySpecValue(
      specs,
      'pricePerImage',
      pricingOverrides?.pricePerImage ?? formatPricePerImage(engineCaps)
    ),
    pricePerSecond: resolveKeySpecValue(
      specs,
      'pricePerSecond',
      pricingOverrides?.pricePerSecond ?? formatPricePerSecond(engineCaps)
    ),
    releaseDate: resolveKeySpecValue(specs, 'releaseDate', 'Data pending'),
    textToImage: resolveKeySpecValue(specs, 'textToImage', resolveModeSupported(engineCaps, 't2i')),
    imageToImage: resolveKeySpecValue(specs, 'imageToImage', resolveModeSupported(engineCaps, 'i2i')),
    textToVideo: resolveKeySpecValue(specs, 'textToVideo', resolveModeSupported(engineCaps, 't2v')),
    imageToVideo: resolveKeySpecValue(specs, 'imageToVideo', resolveModeSupported(engineCaps, 'i2v')),
    videoToVideo: resolveKeySpecValue(specs, 'videoToVideo', resolveVideoToVideoSupport(engineCaps)),
    firstLastFrame: resolveKeySpecValue(specs, 'firstLastFrame', resolveFirstLastSupport(engineCaps)),
    referenceImageStyle: resolveKeySpecValue(specs, 'referenceImageStyle', resolveReferenceImageSupport(engineCaps)),
    referenceVideo: resolveKeySpecValue(specs, 'referenceVideo', resolveReferenceVideoSupport(engineCaps)),
    maxResolution: resolveKeySpecValue(
      specs,
      'maxResolution',
      isImage ? formatImageResolutions(engineCaps) : formatMaxResolution(engineCaps)
    ),
    maxDuration: resolveKeySpecValue(specs, 'maxDuration', formatDuration(engineCaps)),
    aspectRatios: resolveKeySpecValue(specs, 'aspectRatios', formatAspectRatios(engineCaps)),
    fpsOptions: resolveKeySpecValue(specs, 'fpsOptions', formatFps(engineCaps)),
    outputFormats: resolveKeySpecValue(specs, 'outputFormats', formatOutputFormats(entry)),
    audioOutput: resolveKeySpecValue(specs, 'audioOutput', resolveStatus(engineCaps?.audio)),
    nativeAudioGeneration: resolveKeySpecValue(specs, 'nativeAudioGeneration', resolveStatus(engineCaps?.audio)),
    lipSync: resolveKeySpecValue(specs, 'lipSync', 'Data pending'),
    cameraMotionControls: resolveKeySpecValue(
      specs,
      'cameraMotionControls',
      resolveStatus(engineCaps?.motionControls)
    ),
    watermark: resolveKeySpecValue(specs, 'watermark', 'No (MaxVideoAI)'),
  };
}

export function isPending(value: string) {
  return value.trim().toLowerCase() === 'data pending';
}

export function isUnsupported(value: string) {
  const normalized = value.trim().toLowerCase();
  return normalized === 'not supported' || normalized === 'unsupported';
}

export function isSupported(value: string) {
  return value.trim().toLowerCase() === 'supported';
}

export function resolveSpecStatusLabels(locale: AppLocale) {
  return SPEC_STATUS_LABELS[locale] ?? SPEC_STATUS_LABELS.en;
}

export function localizeSpecStatus(value: string, locale: AppLocale): string {
  const labels = resolveSpecStatusLabels(locale);
  const normalized = value.trim();
  const lower = normalized.toLowerCase();
  if (isSupported(normalized)) return labels.supported;
  if (isUnsupported(normalized)) return labels.notSupported;
  if (isPending(normalized)) return labels.pending;
  if (lower.startsWith('supported (') && normalized.endsWith(')')) {
    const detail = normalized.slice(normalized.indexOf('(') + 1, -1);
    return `${labels.supported} (${localizeSpecStatus(detail, locale)})`;
  }
  if (lower.startsWith('not supported (') && normalized.endsWith(')')) {
    const detail = normalized.slice(normalized.indexOf('(') + 1, -1);
    return `${labels.notSupported} (${localizeSpecStatus(detail, locale)})`;
  }
  if (lower === 'prompt-based only') {
    return locale === 'fr' ? 'Via prompt uniquement' : locale === 'es' ? 'Solo mediante prompt' : normalized;
  }
  if (lower === 'single start image') {
    return locale === 'fr' ? 'une seule image de départ' : locale === 'es' ? 'una sola imagen inicial' : normalized;
  }
  if (lower === 'multi reference stills') {
    return locale === 'fr'
      ? 'plusieurs stills de référence'
      : locale === 'es'
        ? 'varios stills de referencia'
        : normalized;
  }
  if (lower === 'source clip for extend / retake') {
    return locale === 'fr'
      ? 'clip source pour extension / retake'
      : locale === 'es'
        ? 'clip fuente para extensión / retake'
        : normalized;
  }
  if (lower === 'source clip for modify / reframe') {
    return locale === 'fr'
      ? 'clip source pour modify / reframe'
      : locale === 'es'
        ? 'clip fuente para modify / reframe'
        : normalized;
  }
  if (lower === 'start + end image in i2v') {
    return locale === 'fr'
      ? 'image de départ + image de fin en image → vidéo'
      : locale === 'es'
        ? 'imagen inicial + imagen final en imagen → video'
        : normalized;
  }
  if (lower === 'reframe workflow') {
    return locale === 'fr' ? 'workflow reframe' : locale === 'es' ? 'workflow reframe' : normalized;
  }
  if (lower === 'modify / reframe workflows') {
    return locale === 'fr'
      ? 'workflows modify / reframe'
      : locale === 'es'
        ? 'workflows modify / reframe'
        : normalized;
  }
  if (lower === 'extend / retake workflows') {
    return locale === 'fr'
      ? 'workflows extension / retake'
      : locale === 'es'
        ? 'workflows de extensión / retake'
        : normalized;
  }
  if (lower === 'no (maxvideoai)') {
    return locale === 'fr' ? 'Non (MaxVideoAI)' : locale === 'es' ? 'No (MaxVideoAI)' : normalized;
  }
  return value;
}

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
