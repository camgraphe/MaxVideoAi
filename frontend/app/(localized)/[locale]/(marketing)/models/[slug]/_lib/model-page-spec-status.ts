import { localizeCapabilityDetail } from '@/lib/marketing/spec-capability-copy';
import type { AppLocale } from '@/i18n/locales';
import { SPEC_STATUS_LABELS } from './model-page-specs-constants';

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
  const capability = localizeCapabilityDetail(normalized, locale);
  if (capability !== null) return capability;
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
  if (lower === 'not exposed in current maxvideoai route') {
    return locale === 'fr'
      ? 'Non disponible dans MaxVideoAI actuellement'
      : locale === 'es'
        ? 'No disponible actualmente en MaxVideoAI'
        : normalized;
  }
  if (lower === 'multi reference stills') {
    return locale === 'fr'
      ? 'plusieurs images de référence'
      : locale === 'es'
        ? 'varias imágenes de referencia'
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
      ? 'clip source à modifier ou recadrer'
      : locale === 'es'
        ? 'clip de origen para modificar o reencuadrar'
        : normalized;
  }
  if (lower === 'start + end image in i2v') {
    return locale === 'fr'
      ? 'image de départ + image de fin en image → vidéo'
      : locale === 'es'
        ? 'imagen inicial + imagen final en imagen → video'
        : normalized;
  }
  if (lower === '1 start image + optional end image in i2v') {
    return locale === 'fr'
      ? '1 image de départ + image de fin optionnelle en image → vidéo'
      : locale === 'es'
        ? '1 imagen inicial + imagen final opcional en imagen → video'
        : normalized;
  }
  if (lower === 'ref2v: up to 9 image references; i2v: 1 start image') {
    return locale === 'fr'
      ? 'Ref2V : jusqu’à 9 images de référence ; I2V : 1 image de départ'
      : locale === 'es'
        ? 'Ref2V: hasta 9 imágenes de referencia; I2V: 1 imagen inicial'
        : normalized;
  }
  if (lower === 'ref2v: up to 3 video references') {
    return locale === 'fr'
      ? 'Ref2V : jusqu’à 3 vidéos de référence'
      : locale === 'es'
        ? 'Ref2V: hasta 3 videos de referencia'
        : normalized;
  }
  if (lower === 'i2v start + optional end frame') {
    return locale === 'fr'
      ? 'image de départ I2V + image finale optionnelle'
      : locale === 'es'
        ? 'imagen inicial I2V + frame final opcional'
        : normalized;
  }
  if (lower === 'best effort with short dialogue') {
    return locale === 'fr'
      ? 'synchronisation approximative avec dialogue court'
      : locale === 'es'
        ? 'sincronización aproximada con diálogo corto'
        : normalized;
  }
  if (lower === 'reframe workflow') {
    return locale === 'fr' ? 'recadrage' : locale === 'es' ? 'reencuadre' : normalized;
  }
  if (lower === 'modify / reframe workflows') {
    return locale === 'fr'
      ? 'modification et recadrage'
      : locale === 'es'
        ? 'modificación y reencuadre'
        : normalized;
  }
  if (lower === 'extend / retake workflows') {
    return locale === 'fr'
      ? 'extension et reprise'
      : locale === 'es'
        ? 'extensión y nueva toma'
        : normalized;
  }
  if (lower === 'no (maxvideoai)') {
    return locale === 'fr' ? 'Non (MaxVideoAI)' : locale === 'es' ? 'No (MaxVideoAI)' : normalized;
  }
  if (locale !== 'en') {
    const month = normalized.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{4})$/);
    if (month) {
      const index = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].indexOf(month[1]);
      return new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(Number(month[2]), index, 1)));
    }
  }
  return value;
}
