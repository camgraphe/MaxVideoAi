import { VIDEO_SEO_EDITORIAL_ENTRIES } from '@/config/video-seo-editorial';
import { query, type QueryExecutor } from '@/lib/db';
import type { MarketingPlacement } from '@/lib/marketing-media';
import sources from '@/config/public-video-sources.json';
import type { MarketingRow } from './store';

const TABLES = ['playlists', 'playlist_items', 'homepage_sections', 'playlist_curations', 'video_seo_pages'];
export async function marketingPlacementTables(db: QueryExecutor): Promise<Set<string>> {
  const found = await db.query<{ name: string }>(
    `SELECT name FROM unnest($1::text[]) AS name WHERE to_regclass('public.'||name) IS NOT NULL`,
    [TABLES],
  );
  return new Set(found.map((row) => row.name));
}
/** Conservative inventory: an explicit saved placement still counts when temporarily hidden. */
export async function listMarketingPlacements(
  row: MarketingRow,
  db: QueryExecutor = { query },
  tables?: Set<string>,
): Promise<MarketingPlacement[]> {
  // Never-ready files do not own the original's existing public placements.
  if (row.state !== 'ready' && !row.tombstone) return [];
  const available = tables ?? (await marketingPlacementTables(db));
  const result: MarketingPlacement[] = [];
  if (row.publication.visibility === 'public')
    result.push({
      kind: 'public',
      label: 'Public video / catalog',
      href: `/video/${encodeURIComponent(row.video_id)}`,
    });
  if (available.has('playlist_items') && available.has('playlists')) {
    const playlists = await db.query<{ name: string; slug: string }>(
      `SELECT DISTINCT p.name,p.slug FROM playlists p JOIN playlist_items pi ON pi.playlist_id=p.id WHERE pi.video_id=$1`,
      [row.video_id],
    );
    result.push(
      ...playlists.map((p) => ({ kind: 'playlist' as const, label: p.name || p.slug, href: '/admin/playlists' })),
    );
  }
  if (available.has('playlist_curations')) {
    const curations = await db.query<{ name: string }>(
      `SELECT c.playlist_id::text AS name FROM playlist_curations c WHERE to_jsonb(c)->'ordered_ids' @> $1::jsonb OR to_jsonb(c)->'opening_ids' @> $1::jsonb`,
      [JSON.stringify([row.video_id])],
    );
    result.push(
      ...curations.map(() => ({
        kind: 'playlist' as const,
        label: 'Saved gallery selection',
        href: '/admin/playlists',
      })),
    );
  }
  if (available.has('homepage_sections')) {
    const sections = await db.query<{ key: string }>('SELECT key FROM homepage_sections WHERE video_id=$1', [
      row.video_id,
    ]);
    result.push(
      ...sections.map((section) => ({
        kind: 'homepage' as const,
        label: `Homepage: ${section.key}`,
        href: '/admin/home',
      })),
    );
  }
  let editorialStatus: string | undefined = VIDEO_SEO_EDITORIAL_ENTRIES.find(
    (entry) => entry.id === row.video_id,
  )?.seoStatus;
  if (available.has('video_seo_pages')) {
    const pages = await db.query<{ seo_status: string }>(`SELECT seo_status FROM video_seo_pages WHERE video_id=$1`, [
      row.video_id,
    ]);
    if (pages.length) editorialStatus = pages[0].seo_status;
  }
  if (editorialStatus && editorialStatus !== 'disabled')
    result.push({
      kind: 'watch',
      label: 'Video publishing record',
      href: `/admin/video-seo?videoId=${encodeURIComponent(row.video_id)}`,
    });
  const originals = new Set(row.files.flatMap((file) => [file.sourceUrl, file.url]));
  const original = row.source_record?.job?.video_url;
  if (typeof original === 'string') originals.add(original);
  for (const source of sources.sources)
    if (originals.has(source.url))
      result.push({ kind: 'authored', label: `Authored demo: ${source.assetId} (source retained)` });
  return result;
}
