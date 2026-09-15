import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { canUseLocalPublicExamples, publicCardToVideo, selectLocalModelExamples, selectLocalPublicExamples, type PublicExamplesSnapshot } from './local-public-examples-data';
import type { ExampleSort } from './videos-examples';

export function isLocalPublicExamplesEnabled() { return canUseLocalPublicExamples(process.env); }
let cached: PublicExamplesSnapshot | undefined;
function readSnapshot(): PublicExamplesSnapshot {
  if (!isLocalPublicExamplesEnabled()) throw new Error('Public example snapshot is restricted to isolated local development.');
  if (!cached) {
    const data = JSON.parse(readFileSync(resolve(process.cwd(), '.local-review/public-examples.json'), 'utf8')) as PublicExamplesSnapshot;
    if (data.version !== 1 || data.source !== 'https://maxvideoai.com/api/examples' || !data.cards || !data.feeds) throw new Error('Invalid public example snapshot.');
    cached = data;
  }
  return cached;
}
export function listLocalPublicExamples(family: string, sort: ExampleSort, limit: number, offset: number) {
  return selectLocalPublicExamples(readSnapshot(), family, sort, limit, offset);
}
export function getLocalPublicExample(id: string) {
  const card = readSnapshot().cards[id];
  return card ? publicCardToVideo(card) : null;
}

// The public API snapshot has model identities, but no per-model playlist membership.
// Use exact identity matching for local visual review, never substitute a sibling model.
export function listLocalModelExamples(modelSlug: string, limit = 200) {
  return selectLocalModelExamples(readSnapshot(), modelSlug, limit);
}
