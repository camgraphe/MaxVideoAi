import { resolveDictionary } from '@/lib/i18n/server';

type TranslateFn = <T = unknown>(path: string, fallback?: T) => T | undefined;

function resolvePath<T>(source: Record<string, unknown>, path: string): T | undefined {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, source) as T | undefined;
}

export async function getI18nServer(): Promise<TranslateFn> {
  const { dictionary, fallback } = await resolveDictionary();

  const translate: TranslateFn = (path, defaultValue) => {
    const primary = resolvePath(dictionary as unknown as Record<string, unknown>, path);
    if (primary !== undefined) {
      return primary as typeof defaultValue;
    }
    const fallbackValue = resolvePath(fallback as unknown as Record<string, unknown>, path);
    if (fallbackValue !== undefined) {
      return fallbackValue as typeof defaultValue;
    }
    return defaultValue as typeof defaultValue;
  };

  return translate;
}
