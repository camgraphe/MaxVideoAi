import { cache } from 'react';
import { isDatabaseConfigured, query } from '@/lib/db';

export type LegalDocumentKey = 'terms' | 'privacy' | 'cookies';

export type LegalDocument = {
  key: LegalDocumentKey;
  version: string;
  title: string;
  url: string;
  publishedAt: Date | null;
};

const LEGAL_KEYS: LegalDocumentKey[] = ['terms', 'privacy', 'cookies'];

export function isLegalDocumentKey(value: string): value is LegalDocumentKey {
  return (LEGAL_KEYS as ReadonlyArray<string>).includes(value);
}

async function loadLegalDocument(key: LegalDocumentKey): Promise<LegalDocument | null> {
  if (!isDatabaseConfigured()) return null;
  try {
    const rows = await query<{ key: string; version: string; title: string; url: string; published_at: Date | null }>(
      `select key, version, title, url, published_at from legal_documents where key = $1 limit 1`,
      [key]
    );
    const row = rows[0];
    if (!row || !isLegalDocumentKey(row.key)) {
      return null;
    }
    return {
      key: row.key,
      version: row.version,
      title: row.title,
      url: row.url,
      publishedAt: row.published_at ?? null,
    };
  } catch (error) {
    console.warn('[legal] failed to fetch document', {
      key,
      error: error instanceof Error ? error.message : error,
    });
    return null;
  }
}

const fetchLegalDocument = cache(loadLegalDocument);

export async function getLegalDocument(key: LegalDocumentKey): Promise<LegalDocument | null> {
  return fetchLegalDocument(key);
}

export async function getLegalDocuments(keys: LegalDocumentKey[]): Promise<Record<LegalDocumentKey, LegalDocument | null>> {
  const entries = await Promise.all(keys.map(async (key) => [key, await fetchLegalDocument(key)] as const));
  return Object.fromEntries(entries) as Record<LegalDocumentKey, LegalDocument | null>;
}

export function formatLegalDate(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en', { year: 'numeric', month: 'long', day: 'numeric' }).format(date);
}

export async function getLegalDocumentUncached(key: LegalDocumentKey): Promise<LegalDocument | null> {
  return loadLegalDocument(key);
}

export async function listLegalDocuments(): Promise<LegalDocument[]> {
  if (!isDatabaseConfigured()) return [];
  try {
    const rows = await query<{ key: string; version: string; title: string; url: string; published_at: Date | null }>(
      `select key, version, title, url, published_at from legal_documents order by key`
    );
    return rows
      .filter((row): row is { key: LegalDocumentKey; version: string; title: string; url: string; published_at: Date | null } =>
        isLegalDocumentKey(row.key)
      )
      .map((row) => ({
        key: row.key,
        version: row.version,
        title: row.title,
        url: row.url,
        publishedAt: row.published_at ?? null,
      }));
  } catch (error) {
    console.warn('[legal] failed to list documents', error instanceof Error ? error.message : error);
    return [];
  }
}
