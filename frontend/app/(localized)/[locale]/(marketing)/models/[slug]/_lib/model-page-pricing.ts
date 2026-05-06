import { localeRegions, type AppLocale } from '@/i18n/locales';
import { computePricingSnapshot } from '@/lib/pricing';
import { computeMarketingPricePoints, computeMarketingPriceRange, type MarketingPricePoint } from '@/lib/pricing-marketing';
import { formatResolutionLabel } from '@/lib/resolution-labels';
import type { EngineCaps } from '@/types/engines';

type PriceSpecRow = {
  id: 'pricePerSecond' | 'pricePerImage';
  key: 'pricePerSecond' | 'pricePerImage';
  label: string;
  value: string;
  valueLines?: string[];
};

type AudioPriceLabels = {
  on: string;
  off: string;
};

function formatPerSecond(locale: AppLocale, currency: string, amount: number) {
  const region = localeRegions[locale] ?? 'en-US';
  return new Intl.NumberFormat(region, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatCurrency(locale: AppLocale, currency: string, amount: number) {
  const region = localeRegions[locale] ?? 'en-US';
  return new Intl.NumberFormat(region, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatMarketingImagePricePoint(point: MarketingPricePoint, engineId: string, locale: AppLocale) {
  const amount = formatCurrency(locale, point.currency, point.cents / 100);
  const resolution = formatResolutionLabel(engineId, point.resolution);
  const quality = point.quality ? ` ${point.quality}` : '';
  return `${resolution}${quality} ${amount}/image`;
}

function formatPerSecondLabel(locale: AppLocale, currency: string, perSecond: number): string {
  return `${formatPerSecond(locale, currency, perSecond)}/s`;
}

function parseDurationValue(raw: number | string | null | undefined): number | null {
  if (raw == null) return null;
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
    return Math.round(raw);
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const numeric = Number(trimmed.replace(/[^0-9.]/g, ''));
    if (!Number.isFinite(numeric) || numeric <= 0) return null;
    return Math.round(numeric);
  }
  return null;
}

function selectQuickDurations(engine: EngineCaps): number[] {
  const durationField = engine.inputSchema?.optional?.find((field) =>
    field.id === 'duration_seconds' || field.id === 'duration'
  );
  const values = new Set<number>();

  if (Array.isArray(durationField?.values)) {
    durationField.values.forEach((value) => {
      const parsed = parseDurationValue(value);
      if (parsed) values.add(parsed);
    });
  }

  if (!values.size) {
    const minRaw = typeof durationField?.min === 'number' ? durationField.min : 1;
    const maxRaw = typeof durationField?.max === 'number' ? durationField.max : engine.maxDurationSec ?? minRaw;
    const min = Math.max(1, Math.round(minRaw));
    const max = Math.max(min, Math.round(maxRaw));
    const mid = Math.round((min + max) / 2);
    values.add(min);
    values.add(mid);
    values.add(max);
  }

  const sorted = Array.from(values).filter((value) => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
  if (sorted.length <= 3) return sorted;

  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const mid = sorted[Math.floor(sorted.length / 2)];
  return Array.from(new Set([min, mid, max]));
}

function resolveDefaultResolution(engine: EngineCaps): string | null {
  const resolutionField = engine.inputSchema?.optional?.find((field) => field.id === 'resolution');
  const defaultValue = typeof resolutionField?.default === 'string' ? resolutionField.default : null;
  const allowedValues = Array.isArray(resolutionField?.values) ? resolutionField.values : [];
  if (defaultValue && (!allowedValues.length || allowedValues.includes(defaultValue))) {
    return defaultValue;
  }
  const fallback = (engine.resolutions ?? []).find((value) => value && value !== 'auto');
  return fallback ?? null;
}

function resolvePricingResolutions(engineCaps: EngineCaps): string[] {
  const resolutions = (engineCaps.resolutions ?? []).filter((value) => value && value !== 'auto');
  if (resolutions.length) return Array.from(new Set(resolutions));
  const fallback = resolveDefaultResolution(engineCaps);
  return fallback ? [fallback] : [];
}

async function computePerSecondValue(
  engineCaps: EngineCaps,
  locale: AppLocale,
  resolution: string,
  addons?: Record<string, boolean>
): Promise<{ label: string; perSecond: number } | null> {
  const durationSec = selectQuickDurations(engineCaps)[0] ?? 5;
  try {
    const snapshot = await computePricingSnapshot({
      engine: engineCaps,
      durationSec,
      resolution,
      membershipTier: 'member',
      ...(addons ? { addons } : {}),
    });
    const seconds = typeof snapshot.base.seconds === 'number' ? snapshot.base.seconds : durationSec;
    if (!seconds) return null;
    const perSecond = snapshot.totalCents / seconds / 100;
    const currency = snapshot.currency ?? 'USD';
    return { label: formatPerSecondLabel(locale, currency, perSecond), perSecond };
  } catch {
    return null;
  }
}

export async function buildPricePerSecondLabel(engine: EngineCaps, locale: AppLocale): Promise<string | null> {
  const resolution = resolveDefaultResolution(engine);
  if (!resolution) return null;
  const durationOptions = selectQuickDurations(engine);
  const durationSec = durationOptions[0] ?? 5;
  try {
    const snapshot = await computePricingSnapshot({
      engine,
      durationSec,
      resolution,
      membershipTier: 'member',
    });
    const seconds = typeof snapshot.base.seconds === 'number' ? snapshot.base.seconds : durationSec;
    if (!seconds) return null;
    const perSecond = snapshot.totalCents / seconds / 100;
    return `${formatPerSecond(locale, snapshot.currency ?? 'USD', perSecond)}/s`;
  } catch {
    return null;
  }
}

export async function buildPricePerImageLabel(engine: EngineCaps, locale: AppLocale): Promise<string | null> {
  try {
    const range = await computeMarketingPriceRange(engine, { memberTier: 'member', limit: null });
    if (!range) return null;
    return `${formatCurrency(locale, range.currency, range.min.cents / 100)}/image`;
  } catch {
    return null;
  }
}

export async function buildPricePerSecondRows(
  engineCaps: EngineCaps,
  locale: AppLocale,
  rowLabel: string,
  audioLabels: AudioPriceLabels
): Promise<PriceSpecRow[]> {
  const resolutions = resolvePricingResolutions(engineCaps);
  if (!resolutions.length) return [];

  const hasAudioOff = Boolean(engineCaps.pricingDetails?.addons?.audio_off);
  const rows: PriceSpecRow[] = [];
  const displayOn = new Map<string, string>();
  const displayOff = new Map<string, string>();

  for (const resolution of resolutions) {
    const onValue = await computePerSecondValue(engineCaps, locale, resolution);
    if (onValue) {
      displayOn.set(resolution, onValue.label);
    }
    if (hasAudioOff) {
      const offValue = await computePerSecondValue(engineCaps, locale, resolution, { audio_off: true });
      if (offValue) {
        displayOff.set(resolution, offValue.label);
      }
    }
  }

  if (!displayOn.size) return [];

  const onValues = Array.from(displayOn.values());
  const onSame = new Set(onValues).size === 1;
  const offValues = Array.from(displayOff.values());
  const offSame = offValues.length ? new Set(offValues).size === 1 : false;

  if (hasAudioOff && displayOff.size === displayOn.size) {
    const audioDiffers = Array.from(displayOn.entries()).some(([resolution, value]) => displayOff.get(resolution) !== value);
    if (audioDiffers && onSame && offSame) {
      const onLabel = onValues[0];
      const offLabel = offValues[0];
      rows.push({
        id: 'pricePerSecond',
        key: 'pricePerSecond',
        label: rowLabel,
        value: `${audioLabels.on} ${onLabel} · ${audioLabels.off} ${offLabel}`,
      });
      return rows;
    }

    if (audioDiffers) {
      const lines = resolutions
        .map((resolution) => {
          const onLabel = displayOn.get(resolution);
          const offLabel = displayOff.get(resolution);
          if (!onLabel || !offLabel) return null;
          const displayResolution = formatResolutionLabel(engineCaps.id, resolution);
          return `${displayResolution}: ${audioLabels.on} ${onLabel} · ${audioLabels.off} ${offLabel}`;
        })
        .filter((line): line is string => Boolean(line));
      if (lines.length) {
        rows.push({
          id: 'pricePerSecond',
          key: 'pricePerSecond',
          label: rowLabel,
          value: lines[0],
          valueLines: lines,
        });
        return rows;
      }
    }
  }

  if (onSame) {
    rows.push({
      id: 'pricePerSecond',
      key: 'pricePerSecond',
      label: rowLabel,
      value: onValues[0],
    });
    return rows;
  }

  const lines = resolutions
    .map((resolution) => {
      const label = displayOn.get(resolution);
      const displayResolution = formatResolutionLabel(engineCaps.id, resolution);
      return label ? `${displayResolution} ${label}` : null;
    })
    .filter((line): line is string => Boolean(line));

  if (lines.length) {
    rows.push({
      id: 'pricePerSecond',
      key: 'pricePerSecond',
      label: rowLabel,
      value: lines[0],
      valueLines: lines,
    });
  }

  return rows;
}

export async function buildPricePerImageRows(
  engineCaps: EngineCaps,
  locale: AppLocale,
  rowLabel: string
): Promise<PriceSpecRow[]> {
  const points = await computeMarketingPricePoints(engineCaps, { memberTier: 'member', limit: null });

  if (!points.length) return [];
  const values = points.map((point) => `${formatCurrency(locale, point.currency, point.cents / 100)}/image`);
  const same = new Set(values).size === 1;
  if (same) {
    return [
      {
        id: 'pricePerImage',
        key: 'pricePerImage',
        label: rowLabel,
        value: values[0],
      },
    ];
  }

  const lines = points.map((point) => formatMarketingImagePricePoint(point, engineCaps.id, locale));

  if (!lines.length) return [];
  return [
    {
      id: 'pricePerImage',
      key: 'pricePerImage',
      label: rowLabel,
      value: lines[0],
      valueLines: lines,
    },
  ];
}

