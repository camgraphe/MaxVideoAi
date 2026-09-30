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

test('complete local catalog paginates beyond 120 and keeps independent family media', () => {
  const cards=Object.fromEntries(Array.from({length:145},(_,i)=>[String(i),{...card,id:`public-${i}`,engineIconId:'kling-3-pro'}]));
  const ids=Object.keys(cards);
  const complete={...snapshot,cards,feeds:{'':{playlist:ids,'date-desc':ids},kling:{playlist:ids,'date-desc':ids}}};
  const tail=selectLocalPublicExamples(complete,'','playlist',24,120);
  assert.equal(tail.total,145);assert.equal(tail.items.length,24);assert.equal(tail.items[0].id,'public-120');assert.equal(tail.hasMore,true);
  assert.equal(selectLocalPublicExamples(complete,'kling','playlist',24,144).items[0].id,'public-144');
});

test('historical stored IDs retain their registry family and discovery eligibility',async()=>{
 const {resolveExampleFamilyId}=await import('../frontend/lib/model-families');
 const {normalizeEngineId}=await import('../frontend/src/lib/engine-alias');
 const {isDiscoverableExampleEngine}=await import('../frontend/lib/examples/discovery');
 for(const [input,canonical,family] of [['veo-3-fast','veo-3-1-fast','veo'],['veo3fast','veo-3-1-fast','veo'],['pika-image-to-video','pika-text-to-video','pika'],['lumaRay2','lumaRay2','luma'],['lumaRay2_flash','lumaRay2_flash','luma']]){
  assert.equal(normalizeEngineId(input),canonical);assert.equal(resolveExampleFamilyId(input),family);assert.equal(isDiscoverableExampleEngine(input),true);
 }
});

test('model previews accept registry aliases for the same model without choosing a sibling',()=>{
 const aliases={...snapshot,cards:{
  a:{...card,id:'luma-old',engineIconId:'lumaRay2'},
  b:{...card,id:'luma-flash',engineIconId:'lumaRay2_flash'},
  c:{...card,id:'veo-old',engineIconId:'veo3fast'},
 }};
 assert.deepEqual(selectLocalModelExamples(aliases,'luma-ray-2').map(v=>v.id),['luma-old']);
 assert.deepEqual(selectLocalModelExamples(aliases,'veo-3-1-fast').map(v=>v.id),['veo-old']);
});
