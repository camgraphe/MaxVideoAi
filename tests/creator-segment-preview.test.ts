import assert from 'node:assert/strict';
import test from 'node:test';
import { mountToolFixture } from './helpers/tool-selection-fixture';

async function mount(kind = 'video') {
  return mountToolFixture(`import {CreatorSegmentFields} from './src/components/tools/creator/CreatorSettings';
    function App(){const [value,setValue]=useState({enabled:true,start:'2',end:'5'});window.setSegment=setValue;
      return <CreatorSegmentFields locale="en" role="motion" source={window.source} value={value} disabled={false}
        onChange={next=>{window.changes.push(next);setValue(next)}}/>;}`,
  { './creator-workspace.module.css': 'export default {};' }, w => {
    w.source = { ref: { type: 'asset', assetId: 'ma_test', kind }, url: `https://private.invalid/source.${kind === 'audio' ? 'wav' : 'mp4'}?signature=exact`, name: 'Reference', durationSec: 8 };
    w.changes = []; w.plays = 0; w.pauses = 0;
    Object.defineProperty(w.HTMLMediaElement.prototype, 'paused', { get() { return !this.isPlaying; } });
    w.HTMLMediaElement.prototype.play = function () { w.plays++; this.isPlaying = true; this.dispatchEvent(new w.Event('play')); return Promise.resolve(); };
    w.HTMLMediaElement.prototype.pause = function () { w.pauses++; this.isPlaying = false; this.dispatchEvent(new w.Event('pause')); };
  });
}
function button(f: any, text: string) { return Array.from(f.w.document.querySelectorAll('button')).find((node: any) => node.textContent === text) as any; }
async function metadata(f: any, media: any) {
  Object.defineProperty(media, 'duration', { value: 8 });
  await f.act(async () => media.dispatchEvent(new f.w.Event('loadedmetadata')));
}

test('passage preview preserves the exact private URL, starts at the selected offset and stops at its end', async () => {
  const f = await mount(); try {
    const media = f.w.document.querySelector('video');
    assert.equal(media.src, f.w.source.url); assert.equal(media.preload, 'none'); assert.equal(media.controls, true); assert.equal(media.autoplay, false); assert.equal(f.w.plays, 0);
    assert.equal(button(f, 'Set start here').disabled, true);
    await f.act(async () => button(f, 'Play passage').click()); assert.equal(media.currentTime, 2); assert.equal(f.w.plays, 1);
    await metadata(f, media); assert.equal(media.currentTime, 2);
    await f.act(async () => { media.currentTime = 5.1; media.dispatchEvent(new f.w.Event('timeupdate')); });
    assert.equal(media.paused, true); assert.equal(media.currentTime, 5); assert.equal(f.w.changes.length, 0);
    await f.act(async () => button(f, 'Play passage').click()); assert.equal(media.currentTime, 2);
    await f.act(async () => f.w.setSegment({ enabled: true, start: '3', end: '6' })); assert.equal(media.paused, true);
  } finally { await f.close(); }
});

test('marking the playhead updates the selected passage, while native reference playback does not change it', async () => {
  const f = await mount(); try {
    const media = f.w.document.querySelector('video'); await metadata(f, media);
    await f.act(async () => { await media.play(); media.currentTime = 6.23456; media.dispatchEvent(new f.w.Event('timeupdate')); });
    assert.equal(media.paused, false); assert.equal(f.w.changes.length, 0);
    await f.act(async () => button(f, 'Set end here').click()); assert.equal(f.w.changes.at(-1).end, '6.235');
    await f.act(async () => { media.currentTime = 3.125; button(f, 'Set start here').click(); });
    assert.equal(f.w.changes.at(-1).start, '3.125'); assert.equal(f.w.changes.at(-1).end, '6.235');
  } finally { await f.close(); }
});

test('invalid or empty ranges block passage playback without hiding native controls', async () => {
  const f = await mount(); try {
    for (const [start, end] of [['', '5'], ['5', '2'], ['0', '9'], ['-1', '3']]) {
      await f.act(async () => f.w.setSegment({ enabled: true, start, end }));
      assert.equal(button(f, 'Play passage').disabled, true); assert.equal(f.w.document.querySelector('video').controls, true);
    }
    assert.equal(f.w.plays, 0);
  } finally { await f.close(); }
});

test('changing or closing the reference stops playback and clears the previous media state', async () => {
  const f = await mount(); try {
    const old = f.w.document.querySelector('video'); await metadata(f, old);
    await f.act(async () => button(f, 'Play passage').click());
    f.w.source = { ...f.w.source, url: 'https://private.invalid/new.mp4?signature=new' }; await f.render();
    assert.equal(old.paused, true); assert.equal(f.w.document.querySelector('video').src, f.w.source.url); assert.equal(button(f, 'Set start here').disabled, true);
    await f.act(async () => button(f, 'Play passage').click());
    const next = f.w.document.querySelector('video'); await f.act(async () => f.w.document.querySelector('input[type=checkbox]').click());
    assert.equal(next.paused, true); assert.equal(f.w.document.querySelector('video'), null);
  } finally { await f.close(); }
});

test('audio uses the same passage player and reports an unavailable reference', async () => {
  const f = await mount('audio'); try {
    const media = f.w.document.querySelector('audio'); assert.equal(media.src, f.w.source.url);
    await f.act(async () => media.dispatchEvent(new f.w.Event('error')));
    assert.ok(f.w.document.querySelector('[role=alert]')); assert.equal(f.w.document.querySelector('video'), null);
  } finally { await f.close(); }
});
