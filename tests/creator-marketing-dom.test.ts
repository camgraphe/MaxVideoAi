import assert from 'node:assert/strict';
import test from 'node:test';
import { mountToolFixture } from './helpers/tool-selection-fixture';

test('caption illustration reflects edits and style without performing an operation', async () => {
  const f = await mountToolFixture(`import {CreatorWorkflowDemo} from './src/components/tools/creator-marketing/CreatorWorkflowDemo.client';import {enLabels} from './src/components/tools/creator-marketing/creator-copy.en';function App(){return <CreatorWorkflowDemo id="subtitles" labels={enLabels}/>}`, {});
  try {
    const input = f.w.document.querySelector('input[type="text"]');
    await f.act(() => { Object.getOwnPropertyDescriptor(f.w.HTMLInputElement.prototype, 'value')!.set!.call(input, 'An edited brand name.'); input.dispatchEvent(new f.w.Event('input', { bubbles: true })); });
    assert.equal(f.w.document.querySelector('[data-caption-preview]').textContent, 'An edited brand name.');
    const contrast = Array.from(f.w.document.querySelectorAll('button')).find((button: any) => button.textContent === 'High contrast') as any;
    await f.act(() => contrast.click());
    assert.equal(contrast.getAttribute('aria-pressed'), 'true');
    assert.equal(f.w.document.querySelector('[data-caption-preview]').getAttribute('data-style'), '2');
    assert.match(f.w.document.body.textContent, /not a generated result/);
    assert.equal(f.w.requests.length, 0);
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
    assert.equal(f.w.requests.length, 0);
  } finally { await f.close(); }
});
