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

test('lip sync explains Photo and Video as distinct input modes without fake playback', async () => {
  const f = await mountToolFixture(`import {CreatorWorkflowDemo} from './src/components/tools/creator-marketing/CreatorWorkflowDemo.client';import {enLabels} from './src/components/tools/creator-marketing/creator-copy.en';function App(){return <CreatorWorkflowDemo id="lip-sync" labels={enLabels}/>}`, {});
  try {
    const video = Array.from(f.w.document.querySelectorAll('button')).find((button: any) => button.textContent === 'Video') as any;
    await f.act(() => video.click());
    assert.equal(video.getAttribute('aria-pressed'), 'true');
    assert.equal(f.w.document.querySelector('[data-source-mode]').getAttribute('data-source-mode'), 'video');
    assert.equal(f.w.document.querySelectorAll('video, audio').length, 0);
    assert.match(f.w.document.body.textContent, /Voice/);
    assert.match(f.w.document.body.textContent, /passages of equal length/);
    assert.equal(f.w.requests.length, 0);
  } finally { await f.close(); }
});

test('product comparison changes only the disclosed presentation image reveal', async () => {
  const f = await mountToolFixture(`import {CreatorWorkflowDemo} from './src/components/tools/creator-marketing/CreatorWorkflowDemo.client';import {frLabels} from './src/components/tools/creator-marketing/creator-copy.fr';function App(){return <CreatorWorkflowDemo id="product-video-editor" labels={frLabels} locale="fr"/>}`, {});
  try {
    const input = f.w.document.querySelector('input[type="range"]');
    await f.act(() => { Object.getOwnPropertyDescriptor(f.w.HTMLInputElement.prototype, 'value')!.set!.call(input, '73'); input.dispatchEvent(new f.w.Event('input', { bubbles: true })); });
    assert.equal(f.w.document.querySelector('.creator-product-changed').style.clipPath, 'inset(0 0 0 73%)');
    assert.match(f.w.document.body.textContent, /pas un avant-après produit par l’outil/);
    assert.equal(f.w.document.querySelectorAll('video, audio').length, 0);
    assert.equal(f.w.requests.length, 0);
  } finally { await f.close(); }
});
