import assert from 'node:assert/strict';
import test from 'node:test';
import React, {act} from '../frontend/node_modules/react';
import {createRoot} from '../frontend/node_modules/react-dom/client';
import {JSDOM} from 'jsdom';
import {applyConversationTimelineEdit} from '../frontend/lib/studio/conversation-timeline-editing';
import {useProgramPlaybackSync} from '../frontend/app/(core)/(workspace)/app/studio/_shared/_components/viewer/useProgramPlaybackSync';
import type {WorkspaceTimelineItem} from '../frontend/app/(core)/(workspace)/app/studio/_shared/_lib/workspace-types';

test('the real preview applies a saved zero gain to unknown embedded sound without replacing the original or linked audio', async () => {
  const dom = new JSDOM('<div id="root"></div>', {url: 'https://maxvideoai.com'});
  const keys = ['window', 'document', 'navigator', 'IS_REACT_ACT_ENVIRONMENT'];
  const previous = new Map(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries({window: dom.window, document: dom.window.document, navigator: dom.window.navigator, IS_REACT_ACT_ENVIRONMENT: true})) Object.defineProperty(globalThis, key, {value, configurable: true, writable: true});
  dom.window.HTMLMediaElement.prototype.pause = function () {};
  const source: WorkspaceTimelineItem = {id: 'video', outputNodeId: 'source', title: 'Unknown sound', track: 'video', mediaKind: 'video', mediaUrl: 'https://cdn.maxvideoai.com/original.mp4', startSec: 0, sourceStartSec: 1, sourceDurationSec: 6, durationSec: 3, audioProvenance: 'unknown'};
  const voice: WorkspaceTimelineItem = {id: 'voice', outputNodeId: 'voice', title: 'Voice', track: 'audio', mediaKind: 'audio', mediaUrl: 'https://cdn.maxvideoai.com/voice.wav', startSec: 0, durationSec: 3, audioMix: {volume: 80, muted: false}};
  let items = [source, voice];
  const root = createRoot(dom.window.document.getElementById('root')!);
  function Harness() {
    const playback = useProgramPlaybackSync({items, isPlaying: false, playheadSec: 0, projectSettings: {fps: 30, aspectRatio: '16:9', resolution: '720p'}, selectedItemId: source.id, onSelectItem() {}, onSendSnapshotToCanvas() {}});
    return React.createElement(React.Fragment, null,
      React.createElement('video', {'data-playback-item-id': source.id, ref: playback.registerPlaybackVideo}),
      React.createElement('audio', {'data-playback-audio-item-id': voice.id, ref: playback.registerPlaybackAudio}));
  }
  try {
    await act(async () => root.render(React.createElement(Harness)));
    const video = dom.window.document.querySelector('video')!;
    const audio = dom.window.document.querySelector('audio')!;
    assert.equal(video.volume, 1);
    assert.equal(audio.volume, .8);
    items = applyConversationTimelineEdit(items, {kind: 'gain', clipId: source.id, volume: 0}, 30, []);
    await act(async () => root.render(React.createElement(Harness)));
    assert.equal(video.volume, 0);
    assert.equal(audio.volume, .8, 'The separately mixed voice keeps its gain.');
    assert.equal(items[0].mediaUrl, 'https://cdn.maxvideoai.com/original.mp4');
    assert.equal(items[0].audioProvenance, 'unknown');
    assert.equal(items[0].hasEmbeddedAudio, undefined);
    assert.equal(items[0].sourceStartSec, 1);
    items = applyConversationTimelineEdit(items, {kind: 'gain', clipId: source.id, volume: 100}, 30, []);
    await act(async () => root.render(React.createElement(Harness)));
    assert.equal(video.volume, 1, 'Restoring the original level reverses the mute.');
    assert.equal(audio.volume, .8);
    assert.equal(items[0].audioProvenance, 'unknown');
    items = applyConversationTimelineEdit(items, {kind: 'gain', clipId: source.id, volume: 100}, 30, []);
    await act(async () => root.render(React.createElement(Harness)));
    assert.equal(video.volume, 1, 'A repeated restore does not reject or remute.');
    assert.equal(source.audioMix, undefined, 'The source input remains unchanged.');
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, descriptor] of previous) if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
  }
});
