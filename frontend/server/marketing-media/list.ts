import { query } from '@/lib/db';
import { listMarketingPlacements, marketingPlacementTables } from './placements';
import { marketingItem, type MarketingRow } from './store';

export async function listMarketingMedia(offset = 0) {
  const safeOffset = Number.isSafeInteger(offset) && offset >= 0 ? Math.min(offset, 10000) : 0;
  const rows = await query<MarketingRow>(
    `SELECT * FROM marketing_media WHERE state<>'deleted' ORDER BY created_at DESC,video_id DESC LIMIT 21 OFFSET $1`,
    [safeOffset],
  );
  const tables = await marketingPlacementTables({ query });
  const items = [];
  for (const row of rows.slice(0, 20))
    items.push({ ...marketingItem(row), placements: await listMarketingPlacements(row, { query }, tables) });
  return { items, nextOffset: rows.length > 20 ? safeOffset + 20 : null };
}
