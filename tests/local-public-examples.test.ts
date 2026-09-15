import assert from 'node:assert/strict';
import test from 'node:test';
import { canUseLocalPublicExamples, publicCardToVideo, selectLocalModelExamples, selectLocalPublicExamples, type PublicExamplesSnapshot } from '../frontend/server/local-public-examples-data';

const card = { id: 'public-a', engineIconId: 'veo-3-1', engineLabel: 'Veo 3.1', prompt: 'Public excerpt', promptFull: 'Public full prompt', durationSec: 8, hasAudio: true, priceLabel: '$1.13', videoUrl: 'https://media.maxvideoai.com/a.mp4' };
const snapshot: PublicExamplesSnapshot = { version: 1, source: 'https://maxvideoai.com/api/examples', capturedAt: '2026-09-14T00:00:00Z', cards: { a: card, b: { ...card, id: 'public-b', durationSec: 4 } }, feeds: { veo: { playlist: ['a', 'b'], 'date-desc': ['b', 'a'] } } };

test('snapshot is opt-in and unavailable in production, preview, tests or alongside a database', () => {
  const local = { NODE_ENV: 'development', MAXVIDEOAI_PUBLIC_EXAMPLES_SNAPSHOT: '1' } as NodeJS.ProcessEnv;
  assert.equal(canUseLocalPublicExamples(local), true);
  for (const env of [ {}, { ...local, NODE_ENV: 'production' }, { ...local, NODE_ENV: 'test' }, { ...local, VERCEL: '1' }, { ...local, DATABASE_URL: 'postgres://example' }, { ...local, MAXVIDEOAI_PUBLIC_EXAMPLES_SNAPSHOT: undefined } ]) assert.equal(canUseLocalPublicExamples(env as NodeJS.ProcessEnv), false);
});
test('public card retains original media, prompt and exact price without inventing ownership, settings or dates', () => {
  const video = publicCardToVideo(card);
  assert.equal(video.finalPriceCents, 113);
  assert.equal(video.prompt, card.promptFull);
  assert.equal(video.videoUrl, card.videoUrl);
  assert.equal(video.userId, null);
  assert.equal(video.createdAt, '');
  assert.equal(video.settingsSnapshot, undefined);
  assert.equal(publicCardToVideo({ ...card, priceLabel: null }).finalPriceCents, null);
  assert.equal(publicCardToVideo({ ...card, priceLabel: '€1.13' }).currency, null);
});
test('family boundaries, captured orders, sorting and pagination remain independent', () => {
  assert.deepEqual(selectLocalPublicExamples(snapshot, 'kling', 'playlist', 10, 0).items, []);
  const first = selectLocalPublicExamples(snapshot, 'veo', 'playlist', 1, 0);
  const next = selectLocalPublicExamples(snapshot, 'veo', 'playlist', 1, 1);
  assert.equal(first.items[0].id, 'public-a'); assert.equal(first.total, 2); assert.equal(first.hasMore, true);
  assert.equal(next.items[0].id, 'public-b'); assert.equal(next.hasMore, false);
  assert.equal(selectLocalPublicExamples(snapshot, 'veo', 'date-desc', 1, 0).items[0].id, 'public-b');
  assert.equal(selectLocalPublicExamples(snapshot, 'veo', 'date-asc', 1, 0).items[0].id, 'public-a');
  assert.equal(selectLocalPublicExamples(snapshot, 'veo', 'duration-asc', 1, 0).items[0].id, 'public-b');
});

test('local watch details omit unavailable dates instead of throwing or fabricating them', async () => {
  const { deriveWatchPageSignals } = await import('../frontend/server/watch-page-signals/derive');
  const video = publicCardToVideo(card);
  const signals = deriveWatchPageSignals({ video });
  assert.equal(signals.detailRows.some(row => row.key === 'created'), false);
  assert.ok(signals.detailRows.some(row => row.key === 'cost' && row.value === '$1.13'));
  const dated = deriveWatchPageSignals({ video: { ...video, createdAt: '2026-09-01T12:00:00Z' } });
  assert.equal(dated.detailRows.find(row => row.key === 'created')?.value, '2026-09-01');
});


test('local model previews never substitute a family sibling or invent missing media', () => {
  const modelSnapshot = { ...snapshot, cards: {
    a: { ...card, id: 'old', engineIconId: 'seedance-2-0' },
    b: { ...card, id: 'current', engineIconId: 'seedance-2-5' },
  } };
  assert.deepEqual(selectLocalModelExamples(modelSnapshot, 'seedance-2-5').map(video => video.id), ['current']);
  assert.deepEqual(selectLocalModelExamples(modelSnapshot, 'ltx-2-5-pro'), []);
  assert.deepEqual(selectLocalModelExamples(modelSnapshot, 'seedance-2-5', 0), []);
});
