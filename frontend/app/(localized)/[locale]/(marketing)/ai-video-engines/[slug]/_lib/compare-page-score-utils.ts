import { localizeSpecDetailValue } from './compare-page-spec-values';
import type { AppLocale } from '@/i18n/locales';
import { formatEngineName } from './compare-page-engine-formatting';
import { formatTemplate } from './compare-page-text';
import type { EngineCatalogEntry, EngineScore } from './compare-page-types';

export function parseFirstNumber(value: string) {
  const match = value.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const num = Number(match[1]);
  return Number.isNaN(num) ? null : num;
}

export function parseMaxDurationNumber(value: string) {
  const scopedValue = value
    .replace(/\([^)]*(?:source|intake)[^)]*\)/gi, ' ')
    .split(/[;,]/)
    .filter((segment) => !/\b(?:source|intake)\b/i.test(segment))
    .join(' ');
  const values = Array.from(scopedValue.matchAll(/(\d+(?:\.\d+)?)\s*(?:s|sec(?:ond)?s?)\b/gi))
    .map((match) => Number(match[1]))
    .filter((num) => !Number.isNaN(num));
  return values.length ? Math.max(...values) : parseFirstNumber(value);
}

export function parseResolutionValue(value: string) {
  const normalized = value.toLowerCase();
  if (normalized.includes('4k')) return 2160;
  const matches = normalized.match(/(\d{3,4})/g) ?? [];
  const numbers = matches.map((entry) => Number(entry)).filter((entry) => !Number.isNaN(entry));
  return numbers.length ? Math.max(...numbers) : null;
}

export function computeOverall(score?: EngineScore | null) {
  if (!score) return null;
  const values = [score.fidelity, score.motion, score.consistency].filter(
    (value): value is number => typeof value === 'number'
  );
  if (!values.length) return null;
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.round(avg * 10) / 10;
}

export function computePairScores(leftValue: number | null, rightValue: number | null, preferLower = false) {
  if (typeof leftValue !== 'number' || typeof rightValue !== 'number') {
    return { leftScore: null, rightScore: null };
  }
  if (leftValue === rightValue) {
    return { leftScore: 7.5, rightScore: 7.5 };
  }
  const min = Math.min(leftValue, rightValue);
  const max = Math.max(leftValue, rightValue);
  const range = max - min || 1;
  const leftRaw = preferLower ? (max - leftValue) / range : (leftValue - min) / range;
  const rightRaw = preferLower ? (max - rightValue) / range : (rightValue - min) / range;
  const leftScore = Math.round(leftRaw * 10 * 10) / 10;
  const rightScore = Math.round(rightRaw * 10 * 10) / 10;
  return { leftScore, rightScore };
}

/** Status is compared independently of optional prose describing the capability. */
export function compareCapabilityStatus(value: string): 'yes' | 'no' | 'pending' | 'detail' {
  const normalized = value.trim().toLowerCase();
  if (!normalized || /pending|being validated|en (?:cours de )?validation|en validación/.test(normalized)) return 'pending';
  if (/not supported|not exposed|not available|non disponible|no disponible/.test(normalized)) return 'no';
  if (/^(supported|supporté|pris en charge|compatible|yes|true)\b/.test(normalized)) return 'yes';
  return 'detail';
}

export function pickCapabilityDifference(
  left: EngineCatalogEntry,
  right: EngineCatalogEntry,
  label: string,
  leftStatus: string,
  rightStatus: string,
  templates: { value: string; pending: string },
  validatingLabel: string,
  locale: AppLocale = 'en',
  includeDetails = false
): string | null {
  const leftState = compareCapabilityStatus(leftStatus);
  const rightState = compareCapabilityStatus(rightStatus);
  const leftPending = leftState === 'pending';
  const rightPending = rightState === 'pending';
  const sameStatus = leftState === rightState;
  const different = includeDetails ? leftStatus.trim().toLowerCase() !== rightStatus.trim().toLowerCase()
    : !sameStatus && leftState !== 'detail' && rightState !== 'detail';
  const labels = { pending: validatingLabel, supported: locale === 'fr' ? 'pris en charge' : locale === 'es' ? 'compatible' : 'supported',
    notSupported: locale === 'fr' ? 'non pris en charge' : locale === 'es' ? 'no compatible' : 'not supported' };
  if (!leftPending && !rightPending && different) {
    return formatTemplate(templates.value, {
      label,
      left: formatEngineName(left),
      right: formatEngineName(right),
      leftValue: localizeSpecDetailValue(leftStatus, locale, labels),
      rightValue: localizeSpecDetailValue(rightStatus, locale, labels),
    });
  }
  if (leftPending || rightPending) {
    return formatTemplate(templates.value, {
      label, left: formatEngineName(left), right: formatEngineName(right),
      leftValue: localizeSpecDetailValue(leftStatus, locale, labels),
      rightValue: localizeSpecDetailValue(rightStatus, locale, labels),
    });
  }
  return null;
}

export function formatCapabilityValue(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return value;
  return `${trimmed.charAt(0).toLocaleLowerCase()}${trimmed.slice(1)}`.replace(/\b4k\b/gi, '4K');
}

export function getFallbackCapabilityDifference(locale: AppLocale) {
  if (locale === 'fr') {
    return 'Pour votre projet, comparez les limites des références, les réglages et le devis à paramètres équivalents.';
  }
  if (locale === 'es') {
    return 'Para tu proyecto, compara los límites de referencias, los controles y el precio con los mismos ajustes.';
  }
  return 'For your project, compare reference limits, controls and the quote for the same settings.';
}

export function pickFirstCapabilityDifference(
  left: EngineCatalogEntry,
  right: EngineCatalogEntry,
  candidates: Array<{ label: string; leftStatus: string; rightStatus: string; includeDetails?: boolean }>,
  templates: { value: string; pending: string },
  validatingLabel: string,
  locale: AppLocale
) {
  for (const candidate of candidates) {
    const diff = pickCapabilityDifference(
      left,
      right,
      candidate.label,
      candidate.leftStatus,
      candidate.rightStatus,
      templates,
      validatingLabel,
      locale,
      candidate.includeDetails
    );
    if (diff) return diff;
  }
  return getFallbackCapabilityDifference(locale);
}

export function pickOutputDifference(
  leftLabel: string,
  rightLabel: string,
  leftValue: string,
  rightValue: string,
  label: string,
  templates: { value: string; pending: string; shared?: string },
  validatingLabel: string
): string {
  const leftPending = compareCapabilityStatus(leftValue) === 'pending';
  const rightPending = compareCapabilityStatus(rightValue) === 'pending';
  if (!leftPending && !rightPending && leftValue.trim().toLowerCase() === rightValue.trim().toLowerCase()) {
    return formatTemplate(templates.shared ?? '{label}: {left} and {right} both support {value}.', { label, left: leftLabel, right: rightLabel, value: leftValue });
  }
  if (!leftPending && !rightPending && leftValue !== rightValue) {
    return formatTemplate(templates.value, {
      label,
      left: leftLabel,
      right: rightLabel,
      leftValue,
      rightValue,
    });
  }
  return formatTemplate(templates.pending, {
    label,
    status: validatingLabel,
  });
}
