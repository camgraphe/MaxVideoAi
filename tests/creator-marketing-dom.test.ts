import assert from 'node:assert/strict';
import test from 'node:test';
import { mountToolFixture } from './helpers/tool-selection-fixture';

test('subtitle presentation offers three real rendered styles without a generation request', async () => {
  const f = await mountToolFixture(`import {CreatorWorkflowDemo} from './src/components/tools/creator-marketing/CreatorWorkflowDemo.client';import {enLabels} from './src/components/tools/creator-marketing/creator-copy.en';function App(){return <CreatorWorkflowDemo id="subtitles" labels={enLabels}/>}`, {});
  try {
    const video=f.w.document.querySelector('video');assert.equal(video.preload,'none');assert.match(video.getAttribute('src'),/active-word/);
    const buttons=Array.from(f.w.document.querySelectorAll('.subtitle-style-picker button')) as any[];assert.equal(buttons.length,3);
    const contrast=buttons.find(button=>button.getAttribute('aria-label')==='Contrast');await f.act(()=>contrast.click());
    assert.equal(contrast.getAttribute('aria-pressed'),'true');assert.match(video.getAttribute('src'),/high-contrast/);
    assert.equal(f.w.document.querySelector('a[download]').getAttribute('href'),video.getAttribute('src'));
    assert.equal(f.w.document.querySelectorAll('img').length,0,'the hero still must not repeat in the demo');
    assert.equal(f.w.requests.length,0);
  } finally { await f.close(); }
});

test('lip sync presents the full approved voice and a distinct recorded performance', async () => {
  const f = await mountToolFixture(`import {CreatorWorkflowDemo} from './src/components/tools/creator-marketing/CreatorWorkflowDemo.client';import {enLabels} from './src/components/tools/creator-marketing/creator-copy.en';function App(){return <CreatorWorkflowDemo id="lip-sync" labels={enLabels}/>}`, {});
  try {
    const audio=f.w.document.querySelector('audio'),video=f.w.document.querySelector('video');
    assert.equal(audio.preload,'none');assert.equal(video.preload,'none');
    assert.match(audio.getAttribute('src'),/lip-voice-original-[a-f0-9]{12}\.mp3$/);
    assert.match(video.getAttribute('src'),/lip-performance-[a-f0-9]{12}\.mp4$/);
    assert.equal(f.w.document.querySelectorAll('img').length,1);
    assert.equal(f.w.document.querySelector('a[download]').getAttribute('href'),video.getAttribute('src'));
    assert.match(f.w.document.body.textContent,/I was going to take the last train tonight/);
    assert.doesNotMatch(f.w.document.body.textContent,/LTX|Every story starts/);
    assert.equal(f.w.requests.length,0);
  } finally { await f.close(); }
});

for (const id of ['product-photo-editor', 'product-video-editor', 'motion-transfer']) {
  test(`${id} presents distinct recorded inputs and outputs without starting a generation`, async () => {
    const f = await mountToolFixture(`import {CreatorWorkflowDemo} from './src/components/tools/creator-marketing/CreatorWorkflowDemo.client';import {frLabels} from './src/components/tools/creator-marketing/creator-copy.fr';function App(){return <CreatorWorkflowDemo id="${id}" labels={frLabels} locale="fr"/>}`, {});
    try {
      const videos = [...f.w.document.querySelectorAll('video')];
      assert.equal(videos.length, id === 'product-photo-editor' ? 0 : 2);
      for (const video of videos) {
        assert.equal(video.preload, 'none');
        assert.match(video.getAttribute('src'), /creator-results\/[a-z-]+-[a-f0-9]{12}\.mp4$/);
        assert.match(video.getAttribute('poster'), /-poster-[a-f0-9]{12}\.webp$/);
        assert.equal(video.autoplay, false);
      }
      const images = [...f.w.document.querySelectorAll('img')];
      assert.equal(images.length, id === 'product-photo-editor' ? 2 : id === 'motion-transfer' ? 1 : 0);
      assert.equal(new Set([...images, ...videos].map(media => media.getAttribute('src'))).size, images.length + videos.length);
      assert.equal(f.w.document.querySelectorAll('[style*="clip-path"]').length, 0);
      assert.match(f.w.document.querySelector('a[download]').getAttribute('href'), /creator-results\/.+\.(png|mp4)$/);
      assert.equal(f.w.requests.length, 0);
    } finally { await f.close(); }
  });
}
