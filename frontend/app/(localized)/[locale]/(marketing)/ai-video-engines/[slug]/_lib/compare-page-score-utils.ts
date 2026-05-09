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

export function pickCapabilityDifference(
  left: EngineCatalogEntry,
  right: EngineCatalogEntry,
  label: string,
  leftStatus: string,
  rightStatus: string,
  templates: { value: string; pending: string },
  validatingLabel: string
): string | null {
  const leftNormalized = leftStatus.toLowerCase();
  const rightNormalized = rightStatus.toLowerCase();
  const leftPending = leftNormalized.includes('pending') || leftNormalized.includes('validated');
  const rightPending = rightNormalized.includes('pending') || rightNormalized.includes('validated');
  if (!leftPending && !rightPending && leftStatus !== rightStatus) {
    return formatTemplate(templates.value, {
      label,
      left: formatEngineName(left),
      right: formatEngineName(right),
      leftValue: formatCapabilityValue(leftStatus),
      rightValue: formatCapabilityValue(rightStatus),
    });
  }
  if (leftPending || rightPending) {
    return formatTemplate(templates.pending, {
      label,
      status: leftStatus === rightStatus ? formatCapabilityValue(leftStatus) : validatingLabel,
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
    return 'Modes clés : les deux modèles couvrent les mêmes routes principales; la vraie différence se joue sur la résolution, le coût et le niveau de finition.';
  }
  if (locale === 'es') {
    return 'Modos clave: ambos motores cubren las mismas rutas principales; la diferencia real está en la resolución, el costo y el nivel de acabado.';
  }
  return 'Core modes: both engines cover the same main routes; the real difference is resolution, cost, and delivery polish.';
}

export function pickFirstCapabilityDifference(
  left: EngineCatalogEntry,
  right: EngineCatalogEntry,
  candidates: Array<{ label: string; leftStatus: string; rightStatus: string }>,
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
      validatingLabel
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
  templates: { value: string; pending: string },
  validatingLabel: string
): string {
  const leftPending = leftValue.toLowerCase().includes('pending') || leftValue.toLowerCase().includes('validated');
  const rightPending = rightValue.toLowerCase().includes('pending') || rightValue.toLowerCase().includes('validated');
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
