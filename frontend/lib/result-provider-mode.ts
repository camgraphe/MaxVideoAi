import { ENV } from '@/lib/env';
import type { ResultProvider } from '@/types/video-groups';

export function normalizeResultProvider(input?: string | null): ResultProvider | null {
  if (!input) return null;
  const value = input.trim().toLowerCase();
  if (value === 'fal' || value === 'fold') return 'fal';
  if (value === 'test' || value === 'mock' || value === 'demo') return 'test';
  return null;
}

export function defaultResultProvider(): ResultProvider {
  const envValue =
    process.env.NEXT_PUBLIC_DEFAULT_RESULT_PROVIDER ??
    process.env.NEXT_PUBLIC_RESULT_PROVIDER ??
    ENV.RESULT_PROVIDER ??
    null;
  return normalizeResultProvider(envValue) ?? (ENV.FAL_API_KEY ? 'fal' : 'test');
}

export function resolveResultProvider(searchParams?: URLSearchParams | null): ResultProvider {
  const override = searchParams ? normalizeResultProvider(searchParams.get('result_provider')) : null;
  if (override) return override;
  if (typeof window !== 'undefined') {
    const stored = normalizeResultProvider(window.sessionStorage.getItem('mvai.resultProvider'));
    if (stored) return stored;
  }
  return defaultResultProvider();
}

export function persistResultProvider(provider: ResultProvider): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem('mvai.resultProvider', provider);
  } catch {
    // storage may be unavailable, ignore
  }
}
