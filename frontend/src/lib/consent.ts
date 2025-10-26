export type ConsentCategory = 'analytics' | 'ads';

export type ConsentRecord = {
  version: string;
  timestamp: number;
  categories: Record<ConsentCategory, boolean>;
  source: 'banner' | 'preferences';
};

export const CONSENT_COOKIE_NAME = 'mv-consent';

const DEFAULT_CATEGORIES: Record<ConsentCategory, boolean> = {
  analytics: false,
  ads: false,
};

export function createDefaultConsent(version: string, source: ConsentRecord['source']): ConsentRecord {
  return {
    version,
    timestamp: Date.now(),
    categories: { ...DEFAULT_CATEGORIES },
    source,
  };
}

export function serializeConsent(record: ConsentRecord): string {
  return JSON.stringify(record);
}

export function parseConsent(value: string | null | undefined): ConsentRecord | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as ConsentRecord;
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      typeof parsed.version !== 'string' ||
      typeof parsed.timestamp !== 'number' ||
      !parsed.categories ||
      typeof parsed.categories !== 'object'
    ) {
      return null;
    }
    const categories: Record<ConsentCategory, boolean> = { ...DEFAULT_CATEGORIES };
    (Object.keys(categories) as ConsentCategory[]).forEach((key) => {
      categories[key] = Boolean((parsed.categories as Record<string, unknown>)[key]);
    });
    return {
      version: parsed.version,
      timestamp: parsed.timestamp,
      categories,
      source: parsed.source === 'preferences' ? 'preferences' : 'banner',
    };
  } catch {
    return null;
  }
}

export function mergeConsent(base: ConsentRecord, updates: Partial<ConsentRecord>): ConsentRecord {
  return {
    version: updates.version ?? base.version,
    timestamp: updates.timestamp ?? Date.now(),
    source: updates.source ?? base.source,
    categories: {
      ...base.categories,
      ...(updates.categories ?? {}),
    },
  };
}

export function hasConsentFor(record: ConsentRecord | null, categories: ConsentCategory | ConsentCategory[]): boolean {
  if (!record) return false;
  const list = Array.isArray(categories) ? categories : [categories];
  return list.every((category) => Boolean(record.categories[category]));
}
