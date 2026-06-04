import type { EnvLike, FetchLike } from '@/server/infra-costs-types';

export const GIB = 1024 ** 3;

export async function fetchJson(url: URL, token: string, fetchFn: FetchLike): Promise<unknown> {
  const response = await fetchFn(url, {
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Neon API ${url.pathname} failed with ${response.status}: ${await limitedResponseText(response)}`);
  }

  return response.json();
}

export async function limitedResponseText(response: Response): Promise<string> {
  const text = await response.text().catch(() => '');
  return text.slice(0, 500);
}

export function normalizeApiBaseUrl(value: string, fallback: string): string {
  const normalized = value.trim().replace(/\/$/, '');
  if (!normalized) return fallback;
  if (normalized.endsWith('/api/v2')) return normalized.slice(0, -'/api/v2'.length);
  return normalized;
}

export function readEnv(env: EnvLike, ...names: string[]): string | undefined {
  for (const name of names) {
    const value = env[name]?.trim();
    if (value) return value;
  }
  return undefined;
}

export function readCsvEnv(env: EnvLike, ...names: string[]): string[] {
  const value = readEnv(env, ...names);
  if (!value) return [];
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function readNumberEnv(env: EnvLike, names: string[], fallback: number): number {
  for (const name of names) {
    const raw = env[name]?.trim();
    if (!raw) continue;
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  return fallback;
}

export function readPositiveInteger(env: EnvLike, names: string[], fallback: number): number {
  const parsed = Math.round(readNumberEnv(env, names, fallback));
  return parsed > 0 ? parsed : fallback;
}

export function readArray(value: unknown): unknown[] | null {
  return Array.isArray(value) ? value : null;
}

export function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function readNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function normalizeDateKey(value: string): string {
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return value.slice(0, 10) || 'unknown';
}

export function sumObjectValues(value: object): number {
  return Object.values(value).reduce((sum, entry) => sum + (typeof entry === 'number' ? entry : 0), 0);
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function roundUsage(value: number): number {
  return Math.round(value * 100) / 100;
}
