import { sql } from '@vercel/postgres';

type SitemapRow = {
  slug: string | null;
  updated_at: Date | string | null;
};

function ensurePostgresUrl(): boolean {
  if (process.env.POSTGRES_URL) {
    return true;
  }
  const resolved =
    process.env.POSTGRES_PRISMA_URL ??
    process.env.POSTGRES_URL_NON_POOLING ??
    process.env.DATABASE_URL ??
    null;
  if (resolved) {
    process.env.POSTGRES_URL = resolved;
    return true;
  }
  return false;
}

async function safeQuery<Row>(label: string, query: () => Promise<{ rows: Row[] }>): Promise<Row[]> {
  if (!ensurePostgresUrl()) {
    console.warn(`[sitemap] skipped ${label} query – no Postgres URL configured`);
    return [];
  }
  try {
    const { rows } = await query();
    return rows;
  } catch (error) {
    console.warn(`[sitemap] failed to load ${label}`, error);
    return [];
  }
}

export async function fetchModelSlugs(): Promise<SitemapRow[]> {
  return safeQuery('models', () =>
    sql<SitemapRow>`SELECT slug, updated_at FROM models WHERE slug IS NOT NULL`
  );
}

export async function fetchWorkflowSlugs(): Promise<SitemapRow[]> {
  return safeQuery('workflows', () =>
    sql<SitemapRow>`SELECT slug, updated_at FROM workflows WHERE slug IS NOT NULL`
  );
}

export async function fetchExampleSlugs(): Promise<SitemapRow[]> {
  return safeQuery('examples', () =>
    sql<SitemapRow>`SELECT slug, updated_at FROM examples WHERE slug IS NOT NULL`
  );
}

export type { SitemapRow };
