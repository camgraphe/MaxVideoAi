import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

test('chat media uses explicit playback, original links and no video URL as an image', async () => {
  const require = createRequire(import.meta.url);
  const previous = require.extensions['.css'];
  const priorReact = (globalThis as any).React;
  (globalThis as any).React = React;
  require.extensions['.css'] = module => {module.exports = {};};
  try {
    const module = await import('../frontend/app/(core)/(workspace)/app/studio/conversation/[projectId]/_components/ConversationMedia.client').catch(() => null);
    assert.ok(module?.ConversationMedia);
    const videoUrl = 'https://cdn.example.com/original.mp4';
    const video = renderToStaticMarkup(React.createElement(module.ConversationMedia, {locale: 'en', result: {surface: 'video', videoUrl, previewUrl: 'https://cdn.example.com/preview.mp4', thumbnailUrl: null, audioUrl: null}}));
    assert.match(video, /<video/);
    assert.match(video, /preload="none"/);
    assert.match(video, /controls=""/);
    assert.ok(!video.includes('autoplay'));
    assert.ok(!video.includes('<img'));
    assert.match(video, /src="https:\/\/cdn.example.com\/original.mp4"/);
    const audio = renderToStaticMarkup(React.createElement(module.ConversationMedia, {locale: 'en', result: {surface: 'audio', audioUrl: 'https://cdn.example.com/voice.mp3', videoUrl: null, thumbnailUrl: null, mimeType: 'audio/mpeg', durationSec: 12}}));
    assert.match(audio, /<audio/);
    assert.match(audio, /preload="none"/);
    assert.match(audio, /12 s/);
    assert.match(audio, /Open original/);
  } finally {if (previous) require.extensions['.css'] = previous; else delete require.extensions['.css']; (globalThis as any).React = priorReact;}
});
