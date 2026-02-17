import type { AppLocale } from '@/i18n/locales';

export type ImageAltKind = 'renderThumb' | 'compareThumb' | 'engineLogo' | 'uiShot';

type SupportedLocale = AppLocale;

type GetImageAltInput = {
  kind: ImageAltKind;
  locale?: string | null;
  engine?: string | null;
  compareEngine?: string | null;
  label?: string | null;
  prompt?: string | null;
};

type AltListItem = {
  id: string;
  alt: string;
  tag?: string | null;
  index?: number | null;
  locale?: string | null;
};

const LOCALE_FALLBACK_LABEL: Record<SupportedLocale, string> = {
  en: 'render preview',
  fr: 'apercu du rendu',
  es: 'vista previa del render',
};

const LOCALE_EXAMPLE_WORD: Record<SupportedLocale, string> = {
  en: 'Example',
  fr: 'Exemple',
  es: 'Ejemplo',
};

const TAG_LABELS: Record<SupportedLocale, Record<'cinematic' | 'product' | 'drone' | 'portrait', string>> = {
  en: {
    cinematic: 'cinematic',
    product: 'product',
    drone: 'drone',
    portrait: 'portrait',
  },
  fr: {
    cinematic: 'cinematique',
    product: 'produit',
    drone: 'drone',
    portrait: 'portrait',
  },
  es: {
    cinematic: 'cinematico',
    product: 'producto',
    drone: 'drone',
    portrait: 'retrato',
  },
};

function toLocale(locale?: string | null): SupportedLocale {
  return locale === 'fr' || locale === 'es' ? locale : 'en';
}

function cleanToken(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .replace(/\bundefined\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function clampText(value: string, maxLength = 140): string {
  if (value.length <= maxLength) return value;
  const sliced = value.slice(0, Math.max(1, maxLength - 3)).replace(/[,\s:;.!?-]+$/g, '').trim();
  return sliced.length ? `${sliced}...` : value.slice(0, maxLength);
}

export function sanitizeAltText(value: string, maxLength = 140): string {
  const compact = value
    .replace(/\bundefined\b/gi, ' ')
    .replace(/[\u2013\u2014]+/g, ' - ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim();
  return clampText(compact, maxLength);
}

function stripPromptNoise(value: string): string {
  return value
    .replace(/\b(?:\d{1,2}:\d{1,2}|[1-8]k|[0-9]{3,4}p)\b/gi, ' ')
    .replace(/\b(?:fps|seed|ar|aspect|duration|audio|camera[_ -]?fixed|steps?)\s*[:=]?\s*[-\w.]+/gi, ' ')
    .replace(/\b(?:text-to-video|image-to-video|reference-to-video)\b/gi, ' ')
    .replace(/[|\u2022]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function deriveShortPromptLabel(prompt: string | null | undefined, locale?: string | null): string {
  const resolvedLocale = toLocale(locale);
  const raw = cleanToken(prompt);
  if (!raw) return LOCALE_FALLBACK_LABEL[resolvedLocale];

  const firstLine = raw.split(/\n+/).find((part) => part.trim().length > 0)?.trim() ?? raw;
  const firstSentence = firstLine.split(/[.!?](?:\s|$)/)[0] ?? firstLine;
  const cleaned = stripPromptNoise(firstSentence);
  if (!cleaned) return LOCALE_FALLBACK_LABEL[resolvedLocale];
  return clampText(cleaned, 60);
}

export function inferRenderTag(prompt: string | null | undefined, locale?: string | null): string | null {
  const resolvedLocale = toLocale(locale);
  const normalized = cleanToken(prompt).toLowerCase();
  if (!normalized) return null;
  if (/(drone|aerial|bird'?s[- ]eye)/.test(normalized)) return TAG_LABELS[resolvedLocale].drone;
  if (/(product|unbox|tabletop|packshot|demo)/.test(normalized)) return TAG_LABELS[resolvedLocale].product;
  if (/(portrait|selfie|talking head|headshot|close-up)/.test(normalized)) return TAG_LABELS[resolvedLocale].portrait;
  if (/(cinematic|film|movie|director)/.test(normalized)) return TAG_LABELS[resolvedLocale].cinematic;
  return null;
}

export function getImageAlt({
  kind,
  locale,
  engine,
  compareEngine,
  label,
  prompt,
}: GetImageAltInput): string {
  const resolvedLocale = toLocale(locale);
  const engineLabel = cleanToken(engine) || 'AI engine';
  const compareLabel = cleanToken(compareEngine) || 'AI engine';
  const shortLabel = cleanToken(label) || deriveShortPromptLabel(prompt, resolvedLocale);

  const templateByLocale: Record<SupportedLocale, string> =
    kind === 'renderThumb'
      ? {
          en: `${engineLabel} AI video example: ${shortLabel}`,
          fr: `Exemple video IA ${engineLabel}: ${shortLabel}`,
          es: `Ejemplo de video IA de ${engineLabel}: ${shortLabel}`,
        }
      : kind === 'compareThumb'
        ? {
            en: `Comparison: ${engineLabel} vs ${compareLabel} - ${shortLabel}`,
            fr: `Comparaison: ${engineLabel} vs ${compareLabel} - ${shortLabel}`,
            es: `Comparacion: ${engineLabel} vs ${compareLabel} - ${shortLabel}`,
          }
        : kind === 'engineLogo'
          ? {
              en: `${engineLabel} logo`,
              fr: `Logo ${engineLabel}`,
              es: `Logo de ${engineLabel}`,
            }
          : {
              en: `MaxVideoAI interface: ${shortLabel}`,
              fr: `Interface MaxVideoAI: ${shortLabel}`,
              es: `Interfaz de MaxVideoAI: ${shortLabel}`,
            };

  const fallbackByLocale: Record<SupportedLocale, string> = {
    en: 'AI video preview',
    fr: 'Apercu video IA',
    es: 'Vista previa de video IA',
  };

  const raw = templateByLocale[resolvedLocale] || fallbackByLocale[resolvedLocale];
  const sanitized = sanitizeAltText(raw, 140);
  return sanitized || fallbackByLocale[resolvedLocale];
}

function normalizeAltKey(alt: string): string {
  return sanitizeAltText(alt, 140).toLowerCase();
}

function withSuffix(alt: string, suffix: string): string {
  return sanitizeAltText(`${alt} (${suffix})`, 140);
}

export function dedupeAltsInList(items: AltListItem[]): Map<string, string> {
  const result = new Map<string, string>();
  const ordered = [...items].sort((a, b) => {
    const aIndex = typeof a.index === 'number' ? a.index : Number.MAX_SAFE_INTEGER;
    const bIndex = typeof b.index === 'number' ? b.index : Number.MAX_SAFE_INTEGER;
    return aIndex - bIndex;
  });

  const groups = new Map<string, AltListItem[]>();
  for (const item of ordered) {
    const baseAlt = sanitizeAltText(item.alt, 140);
    const key = normalizeAltKey(baseAlt);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)?.push({ ...item, alt: baseAlt });
  }

  for (const [, group] of groups.entries()) {
    if (group.length === 1) {
      result.set(group[0].id, group[0].alt);
      continue;
    }

    const locale = toLocale(group[0].locale);
    const usedTagSuffixes = new Set<string>();

    group.forEach((item, idx) => {
      if (idx === 0) {
        result.set(item.id, item.alt);
        return;
      }

      const cleanTag = cleanToken(item.tag);
      if (cleanTag && !usedTagSuffixes.has(cleanTag.toLowerCase())) {
        usedTagSuffixes.add(cleanTag.toLowerCase());
        result.set(item.id, withSuffix(item.alt, cleanTag));
        return;
      }

      const fallback = `${LOCALE_EXAMPLE_WORD[locale]} ${idx + 1}`;
      result.set(item.id, withSuffix(item.alt, fallback));
    });
  }

  return result;
}
