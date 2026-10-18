import type { EngineCatalogEntry } from './compare-page-types';

export type EngineAccent = {
  barClass: string;
  badgeClass: string;
  buttonClass: string;
  columnTintClass: string;
};

export type OverallTone = 'left' | 'right' | 'tie' | 'none';

export function formatEngineName(entry: EngineCatalogEntry): string {
  return entry.marketingName || entry.modelSlug.replace(/-/g, ' ');
}

export function formatEngineShortName(entry: EngineCatalogEntry): string {
  const fullName = formatEngineName(entry);
  const words = fullName.split(' ').filter(Boolean);
  if (words.length <= 1) return fullName;
  const providerHint = (entry.provider || entry.brandId || '').toLowerCase();
  if (providerHint && words[0]?.toLowerCase() === providerHint.split(' ')[0]) {
    return words.slice(1).join(' ');
  }
  if (['openai', 'google', 'bytedance', 'minimax', 'kling', 'runway', 'pika'].includes(words[0]?.toLowerCase())) {
    return words.slice(1).join(' ');
  }
  return fullName;
}

export function formatEngineMetaName(entry: EngineCatalogEntry): string {
  let name = formatEngineName(entry);
  name = name.replace(/^(openai|google|minimax)\s+/i, '');
  name = name.replace(/\bVideo\s+(\d+(?:\.\d+)?)/i, '$1');
  if (!/\bOmni\b/i.test(name)) {
    name = name.replace(/\b(\d+)\.0\b/g, '$1');
  }
  name = name.replace(/\s+text\s*&\s*image\s+to\s+video$/i, '');
  name = name.replace(/\s+text\s+to\s+video$/i, '');
  name = name.replace(/\s+image\s+to\s+video$/i, '');
  name = name.replace(/\s+First\/Last Frame$/i, ' First/Last');
  name = name.replace(/\s+standard$/i, '');
  name = name.replace(/\s+text$/i, '');
  return name.trim();
}

export function formatSpeedChip(entry: EngineCatalogEntry) {
  const avg = entry.engine?.avgDurationMs ?? null;
  if (avg == null) return 'Data pending';
  if (avg > 30 * 60 * 1000) return 'Data pending';
  return `${Math.round(avg / 1000)}s avg`;
}

export function getEngineAccent(entry: EngineCatalogEntry): EngineAccent {
  const brand = entry.brandId?.toLowerCase() ?? '';
  if (brand.includes('openai')) {
    return {
      barClass: 'bg-emerald-500',
      badgeClass: 'bg-emerald-500 text-white',
      buttonClass: 'bg-emerald-500 text-white hover:bg-emerald-600',
      columnTintClass: 'bg-emerald-500/5',
    };
  }
  if (brand.includes('google')) {
    return {
      barClass: 'bg-orange-500',
      badgeClass: 'bg-orange-500 text-white',
      buttonClass: 'bg-orange-500 text-white hover:bg-orange-600',
      columnTintClass: 'bg-orange-500/5',
    };
  }
  return {
    barClass: 'bg-brand',
    badgeClass: 'bg-brand text-on-brand',
    buttonClass: 'bg-brand text-on-brand hover:bg-brandHover',
    columnTintClass: 'bg-brand/5',
  };
}
