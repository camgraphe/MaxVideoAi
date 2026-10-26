import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { startDisposablePostgres } from './helpers/disposable-postgres';
import { BASE_SELECT, BASE_SELECT_FOR_REUSE, BASE_SELECT_WITH_SETTINGS } from '../frontend/server/videos-query';
import { mapGalleryVideoRow } from '../frontend/server/videos-normalization';
import { toGalleryCard, toFeaturedMedia } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-media';
import { parseModelPromptingContent } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-prompting-content';
import { buildModelPromptingViewModel } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-prompting-view-model';

test('real gallery SQL preserves only the recorded mode through the card, media and localized demo', async () => {
  const db = await startDisposablePostgres('model-demo-generation-mode');
  const prompt = readFileSync('tests/fixtures/kling-v4-next-one.submitted.txt', 'utf8');
  try {
    await db.pool.query(`CREATE TABLE app_jobs(job_id text,user_id text,engine_id text,engine_label text,
      duration_sec numeric,prompt text,thumb_url text,video_url text,settings_snapshot jsonb,
      aspect_ratio text,has_audio boolean,can_upscale boolean,created_at timestamptz,visibility text,
      indexable boolean,featured boolean,featured_order int,final_price_cents int,currency text,pricing_snapshot jsonb);
      CREATE TABLE job_outputs(job_id text,kind text,status text,url text,storage_url text,thumb_url text,
      width int,height int,position int,created_at timestamptz);`);
    await db.pool.query(`INSERT INTO app_jobs(job_id,engine_id,engine_label,duration_sec,prompt,video_url,
      thumb_url,settings_snapshot,aspect_ratio,has_audio,created_at,visibility,indexable)
      VALUES('offline-mode-fixture','kling-v4','Kling 4.0',28.041667,$1,'https://example.test/video.mp4',
      'https://example.test/poster.webp',$2,'16:9',true,now(),'public',true)`,
      [prompt, JSON.stringify({ inputMode: 'ref2v', refs: { privateReference: 'not-a-public-prop' } })]);
    for (const sql of [BASE_SELECT, BASE_SELECT_FOR_REUSE, BASE_SELECT_WITH_SETTINGS]) {
      const [row] = (await db.pool.query(sql)).rows;
      assert.equal(row.generation_mode, 'ref2v');
      if (sql !== BASE_SELECT_WITH_SETTINGS) assert.equal(row.settings_snapshot, undefined);
      const video = mapGalleryVideoRow({ ...row, duration_sec: Number(row.duration_sec) });
      const card = toGalleryCard(video, 'kling', 'Kling 4.0', 'kling-v4', 'kling-v4');
      const media = toFeaturedMedia(card, true)!;
      assert.equal(video.generationMode, 'ref2v');
      assert.equal(card.generationMode, 'ref2v');
      assert.equal(media.generationMode, 'ref2v');
      assert.equal(media.videoUrl, video.videoUrl);
      assert.equal(media.durationSec, video.durationSec);
      assert.equal(media.hasAudio, true);
      assert.equal(JSON.stringify(card).includes('privateReference'), false);
      for (const [locale, label] of [['en', 'Reference-to-video'], ['fr', 'Vidéo guidée par références'], ['es', 'Vídeo guiado por referencias']] as const) {
        const file = `content/models/${locale}/kling-v4.json`;
        const content = parseModelPromptingContent(JSON.parse(readFileSync(file, 'utf8')).prompting, 'kling-v4', locale, file);
        const vm = buildModelPromptingViewModel({ content, locale, engineId: 'kling-v4', modelSlug: 'kling-v4',
          appGenerationEnabled: false, imageAnchorId: 'prompting', isVideoEngine: true, isImageEngine: false,
          supportsNativeAudio: true, demoPromptSource: 'media', defaultDemoPromptSource: 'media', demoMedia: media,
          defaultDemoPresentation: { audioBadgeLabel: '', altContext: '' }, referenceWorkflows: [] });
        assert.equal(vm.demo?.modeLabel, label);
        assert.equal(vm.demo?.prompt, prompt.replace(/\s*\n+\s*/g, ' ').replace(/\s{2,}/g, ' ').trim());
      }
    }
    const [row] = (await db.pool.query(BASE_SELECT)).rows;
    for (const value of [undefined, null, '', 'unknown-mode', { inputMode: 't2v' }]) {
      const unknown = mapGalleryVideoRow({ ...row, generation_mode: value, duration_sec: Number(row.duration_sec) });
      assert.equal(unknown.generationMode, undefined);
      assert.equal(Object.hasOwn(unknown, 'generationMode'), false, 'old public row shapes stay unchanged');
      const demoMedia = toFeaturedMedia(toGalleryCard(unknown), true);
      const file = 'content/models/fr/kling-v4.json';
      const content = parseModelPromptingContent(JSON.parse(readFileSync(file, 'utf8')).prompting, 'kling-v4', 'fr', file);
      const vm = buildModelPromptingViewModel({ content, locale: 'fr', engineId: 'kling-v4', modelSlug: 'kling-v4',
        appGenerationEnabled: false, imageAnchorId: 'prompting', isVideoEngine: true, isImageEngine: false,
        supportsNativeAudio: true, demoPromptSource: 'media', defaultDemoPromptSource: 'media', demoMedia,
        defaultDemoPresentation: { audioBadgeLabel: '', altContext: '' }, referenceWorkflows: [] });
      assert.equal(vm.demo?.modeLabel, 'Génération vidéo', 'old or invalid metadata must not invent text-to-video');
    }
  } finally { await db.cleanup(); }
});
