/** Only anonymous GET /api/examples; no database, auth, media downloads or writes to production. */
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { PUBLIC_MARKETING_EXAMPLE_CANONICAL_SLUGS } from '../config/model-families';
import type { PublicExampleCard, PublicExamplesSnapshot } from '../server/local-public-examples-data';

const endpoint = 'https://maxvideoai.com/api/examples' as const;
const destination = resolve(__dirname, '../.local-review/public-examples.json');
const snapshot: PublicExamplesSnapshot = { version: 1, source: endpoint, capturedAt: new Date().toISOString(), cards: {}, feeds: {} };
function publicMedia(value: unknown): string | undefined {
  if (value == null || value === '') return undefined;
  if (typeof value !== 'string') throw new Error('Invalid media URL');
  if (/^\/(assets|og|hero)\//.test(value)) return value;
  let url: URL;
  try { url = new URL(value); } catch { throw new Error(`Invalid public media URL: ${value.slice(0, 120)}`); }
  if (url.protocol !== 'https:' || url.hostname !== 'media.maxvideoai.com' || url.search || url.username || url.password) throw new Error('Expected a stable public CDN URL');
  return value;
}
function projectCard(raw: Record<string, unknown>): PublicExampleCard {
  if (typeof raw.id !== 'string' || typeof raw.engineIconId !== 'string' || typeof raw.engineLabel !== 'string' || typeof raw.prompt !== 'string' || typeof raw.durationSec !== 'number' || typeof raw.hasAudio !== 'boolean') throw new Error('Incomplete public card');
  return { id: raw.id, engineIconId: raw.engineIconId, engineLabel: raw.engineLabel, prompt: raw.prompt,
    promptFull: typeof raw.promptFull === 'string' ? raw.promptFull : undefined,
    rawPosterUrl: publicMedia(raw.rawPosterUrl), videoUrl: publicMedia(raw.videoUrl), previewVideoUrl: publicMedia(raw.previewVideoUrl),
    aspectRatio: typeof raw.aspectRatio === 'string' ? raw.aspectRatio : undefined,
    durationSec: raw.durationSec, hasAudio: raw.hasAudio, priceLabel: typeof raw.priceLabel === 'string' ? raw.priceLabel : null };
}
async function main() {
for (const family of ['', ...PUBLIC_MARKETING_EXAMPLE_CANONICAL_SLUGS]) {
  const feed = { playlist: [] as string[], 'date-desc': [] as string[] };
  for (const sort of ['playlist', 'date-desc'] as const) {
    let offset = 0;
    for (let page = 0; page < 50; page++) {
      const url = new URL(endpoint);
      url.search = new URLSearchParams({ engine: family, sort, limit: '120', offset: String(offset), locale: 'en' }).toString();
      const response = await fetch(url, { redirect: 'error', credentials: 'omit', signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error(`Public feed failed: ${family || 'hub'} ${response.status}`);
      const data = await response.json();
      if (!data.ok || !Array.isArray(data.cards)) throw new Error('Invalid public feed');
      for (const raw of data.cards) {
        const card = projectCard(raw);
        snapshot.cards[card.id] = card;
        if (!feed[sort].includes(card.id)) feed[sort].push(card.id);
      }
      if (!data.hasMore && data.cards.length < 120) break;
      if (!data.cards.length || page === 49) throw new Error('Public feed pagination did not terminate');
      offset += data.cards.length;
    }
  }
  const missing = feed.playlist.filter(id => !feed['date-desc'].includes(id));
  if (missing.length) console.warn(`${family || 'hub'}: ${missing.length} examples absent from the public date feed; preserved at the end.`);
  feed['date-desc'].push(...missing);
  snapshot.feeds[family] = feed;
  console.log(`${family || 'hub'}: ${feed.playlist.length} public examples`);
}
await mkdir(dirname(destination), { recursive: true });
await writeFile(`${destination}.tmp`, JSON.stringify(snapshot, null, 2) + '\n');
await rename(`${destination}.tmp`, destination);
console.log(`Saved ${Object.keys(snapshot.cards).length} unique public examples. Restart the local preview to refresh its snapshot.`);

}
main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
