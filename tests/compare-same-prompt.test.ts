import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import type { GalleryVideo } from '../frontend/server/videos';
import {
  selectSamePromptExamples,
  type SamePromptSelection,
} from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-same-prompt-data';

const prompt = 'A presenter opens the box.\nUse a slow push in.';
const promptHash = createHash('sha256').update(prompt).digest('hex');
const fast = { engineId: 'veo-3-1-fast', modelSlug: 'veo-3-1-fast' };
const lite = { engineId: 'veo-3-1-lite', modelSlug: 'veo-3-1-lite' };
const selected: SamePromptSelection = { promptHash, videoIds: ['fast', 'lite'] };

function clip(id: string, engine: typeof fast | typeof lite, extra: Partial<GalleryVideo> = {}): GalleryVideo {
  return {
    id,
    engineId: engine.engineId,
    engineLabel: id === 'fast' ? 'Veo 3.1 Fast' : 'Veo 3.1 Lite',
    userId: 'owner-field',
    durationSec: id === 'fast' ? 8 : 6,
    prompt,
    promptExcerpt: 'an excerpt',
    videoUrl: `https://media.maxvideoai.com/${id}.mp4`,
    thumbUrl: `https://media.maxvideoai.com/${id}.jpg`,
    requestedResolution: id === 'fast' ? '1080p' : '720p',
    aspectRatio: '16:9',
    visibility: 'public',
    indexable: true,
    createdAt: '2026-10-20T12:00:00Z',
    canUpscale: false,
    hasAudio: id === 'fast',
    ...extra,
  };
}

const fastVideo = clip('fast', fast, {
  prompt: 'A stale column that is not the submitted prompt.',
  requestedResolution: undefined,
  settingsSnapshot: { prompt: `  ${prompt.replaceAll('\n', '\r\n')}  `, core: { resolution: '1080p' } },
});
const liteVideo = clip('lite', lite);

test('one verified prompt presents both original clips, with per-model settings and the requested order', () => {
  const videos = new Map([['fast', fastVideo], ['lite', liteVideo]]);
  const cases = selectSamePromptExamples([selected], videos, lite, fast);
  assert.equal(cases.length, 1);
  assert.equal(cases[0].prompt, prompt);
  assert.equal(cases[0].promptHash, promptHash);
  assert.deepEqual(cases[0].clips.map(v => [v.id, v.durationSec, v.requestedResolution, v.hasAudio]), [
    ['lite', 6, '720p', null], ['fast', 8, '1080p', true],
  ]);
  assert.ok(!('userId' in cases[0].clips[0]));
});

test('the same-prompt section has no case for stale text, mismatched models or withdrawn media', () => {
  for (const revised of [
    { prompt: prompt.toUpperCase() },
    { settingsSnapshot: { prompt: 'A changed submitted prompt.' } },
    { visibility: 'private' },
    { indexable: false },
    { videoUrl: undefined },
    { engineId: 'veo-3-1' },
    { videoUrl: fastVideo.videoUrl },
  ] satisfies Array<Partial<GalleryVideo>>) {
    const videos = new Map([
      ['fast', fastVideo], ['lite', { ...liteVideo, ...revised }],
    ]);
    assert.deepEqual(selectSamePromptExamples([selected], videos, fast, lite), []);
  }
  assert.deepEqual(selectSamePromptExamples([selected], new Map([['lite', liteVideo]]), fast, lite), []);
});

test('distinct multi-shot instructions are not presented as a shared prompt', () => {
  const videos = new Map([
    ['fast', { ...fastVideo, settingsSnapshot: { prompt, advanced: { multiPrompt: [{ prompt: 'Open the door.' }] } } }],
    ['lite', { ...liteVideo, settingsSnapshot: { prompt, advanced: { multiPrompt: [{ prompt: 'Close the door.' }] } } }],
  ]);
  assert.deepEqual(selectSamePromptExamples([selected], videos, fast, lite), []);
});
