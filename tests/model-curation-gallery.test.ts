import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { finalizeModelGallery } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-gallery-curation';
test('adopted model galleries cannot reinject excluded static media or override manual order', async () => {
  const cards = [
    { id: 'portrait', aspectRatio: '9:16', videoUrl: '/a.mp4' },
    { id: 'landscape', aspectRatio: '16:9', videoUrl: '/b.mp4' },
  ];
  let fetches = 0;
  const options = {
    managed: true,
    cards,
    featuredIds: ['landscape', 'excluded'],
    preferredIds: ['excluded'],
    preferLandscape: true,
    fetchCards: async (ids: string[]) => {
      fetches++;
      return ids.map((id) => ({ id, aspectRatio: '16:9', videoUrl: '/static.mp4' }));
    },
  };
  assert.deepEqual(await finalizeModelGallery(options), cards);
  assert.deepEqual(await finalizeModelGallery({ ...options, cards: [] }), []);
  assert.equal(fetches, 0);
  assert.deepEqual(
    (await finalizeModelGallery({ ...options, managed: false })).map((card) => card.id),
    ['landscape', 'excluded', 'portrait'],
  );
  const route = readFileSync('frontend/app/(localized)/[locale]/(marketing)/models/[slug]/page.tsx', 'utf8');
  assert.match(route, /projectModelPageGallery\(/);
  assert.match(route, /getPublicVideoIds,/);
  const adminPreview = readFileSync('frontend/server/playlists/curation-model-preview.ts','utf8');
  assert.match(adminPreview, /projectModelPageGallery\(/);
  assert.doesNotMatch(adminPreview, /getPublicVideoIds/, 'admin previews retain their transaction-bound full-reader fallback');
  assert.match(readFileSync('frontend/server/videos-playlists.ts','utf8'), /readLegacyPlaylistVideos/);
  assert.doesNotMatch(readFileSync('frontend/server/model-gallery-projection.ts','utf8'), /curation-service|videos-playlists/);
  assert.match(route, /managed: managedCuration/);
  assert.match(route, /pickHeroMedia\(galleryVideos, preferredIds.hero, fallbackMedia, \{ preserveOrder: managedCuration \}\)/,
    'the route passes curation ownership to its hero selector');
  assert.match(route, /if \(!managedCuration && engine.modelSlug === 'kling-2-5-turbo'\)/,
    'legacy Kling hero preference cannot override managed selection');
  assert.doesNotMatch(route, /galleryVideos = \[\.\.\.galleryVideos\]\.sort/);
});

test('model page projection shares model, editorial and public validation before legacy preferences', async () => {
  const {projectModelPageGallery}=await import('../frontend/server/model-gallery-projection');
  type Video=import('../frontend/server/videos-normalization').GalleryVideo;
  const videos=[
    {id:'safe',engineId:'sora-2',prompt:'Landscape'},
    {id:'lennon',engineId:'sora-2',prompt:'John Lennon'},
    {id:'wrong',engineId:'wan-3',prompt:'Landscape'},
    {id:'unvalidated',engineId:'sora-2',prompt:'Landscape'},
  ] as Video[];
  const options={engine:{modelSlug:'sora-2',id:'sora-2'},examples:videos,managed:true,
    preferred:{hero:'static',demo:null},featuredIds:['static'],
    getPublicVideosByIds:async(ids:string[])=>new Map([...videos,{id:'static',engineId:'sora-2',prompt:'Preferred'} as Video]
      .filter(video=>ids.includes(video.id)&&video.id!=='unvalidated').map(video=>[video.id,video])),
    toCard:(video:Video)=>({id:video.id}),
  };
  assert.deepEqual((await projectModelPageGallery(options)).galleryVideos.map(card=>card.id),['safe']);
  assert.deepEqual((await projectModelPageGallery({...options,managed:false})).galleryVideos.map(card=>card.id),['static','safe']);
});
