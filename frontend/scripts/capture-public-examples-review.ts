import { mkdir, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { getExampleFamilyIds } from '../lib/model-families';
import { isDiscoverableExampleEngine } from '../lib/examples/discovery';
import type { PublicExampleCard, PublicExamplesSnapshot } from '../server/local-public-examples-data';

const origin = 'https://maxvideoai.com';
const limit = 120;
const sorts = ['playlist', 'date-desc'] as const;

type PublicPage = { ok: boolean; cards: PublicExampleCard[]; total: number; offset: number; hasMore: boolean };

async function captureFeed(family: string, sort: typeof sorts[number]) {
  const ids: string[] = [];
  const cards: Record<string, PublicExampleCard> = {};
  let offset = 0;
  for (;;) {
    const params = new URLSearchParams({ sort, limit: String(limit), offset: String(offset) });
    if (family) params.set('engine', family);
    const response = await fetch(`${origin}/api/examples?${params}`, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`Public feed ${family || 'all'}/${sort}: HTTP ${response.status}`);
    const page = await response.json() as PublicPage;
    if (!page.ok || !Array.isArray(page.cards) || page.offset !== offset || !Number.isFinite(page.total)) {
      throw new Error(`Invalid public feed ${family || 'all'}/${sort}`);
    }
    for (const card of page.cards) {
      if (!card.id || !card.engineIconId || cards[card.id]) throw new Error(`Invalid/duplicate card in ${family || 'all'}/${sort}`);
      cards[card.id] = card;
      ids.push(card.id);
    }
    if (!page.hasMore) {
      if (ids.length !== page.total) throw new Error(`Incomplete public feed ${family || 'all'}/${sort}: ${ids.length}/${page.total}`);
      return { family, sort, ids, cards };
    }
    if (!page.cards.length) throw new Error(`Public feed ${family || 'all'}/${sort} did not advance`);
    offset += page.cards.length;
  }
}

async function main() {
  const snapshot: PublicExamplesSnapshot = { version: 1, source: `${origin}/api/examples`, capturedAt: new Date().toISOString(), cards: {}, feeds: {} };
  // Family feeds have their own publication/curation. Never derive them from a
  // limited hub sample, or promote their historical videos into the current hub.
  const families = ['', ...getExampleFamilyIds()];
  for (let i = 0; i < families.length; i += 3) {
    const results = await Promise.all(families.slice(i, i + 3).flatMap(family => sorts.map(sort => captureFeed(family, sort))));
    for (const result of results) {
      Object.assign(snapshot.cards, result.cards);
      snapshot.feeds[result.family] ??= { playlist: [], 'date-desc': [] };
      snapshot.feeds[result.family][result.sort] = result.ids;
      console.log(`${result.family || 'all'}/${result.sort}: ${result.ids.length}`);
    }
  }
  // The deployed hub API still exposes an old truncated window. For local review
  // reproduce the new default catalog: hub ordering first, then independent public
  // family feeds, current discovery policy applied, unique real media only.
  // This fixture does not reveal production admin selections or private jobs.
  for (const sort of sorts) {
    snapshot.feeds[''][sort] = [...new Set(families.flatMap(family => snapshot.feeds[family][sort]))]
      .filter(id => isDiscoverableExampleEngine(snapshot.cards[id].engineIconId));
  }
  const directory = resolve(process.cwd(), '.local-review');
  const output = resolve(directory, 'public-examples.json');
  await mkdir(directory, { recursive: true });
  const temporary = `${output}.tmp`;
  await writeFile(temporary, JSON.stringify(snapshot, null, 2));
  await rename(temporary, output);
  console.log(`Captured ${Object.keys(snapshot.cards).length} public videos from ${families.length} independent feeds: ${output}`);
}
main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
