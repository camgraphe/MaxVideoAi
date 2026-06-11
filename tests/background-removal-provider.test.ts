import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildBackgroundRemovalFalInput,
  buildBackgroundRemovalRealtimeInput,
} from '../frontend/src/lib/tools-background-removal.ts';
import {
  extractBackgroundRemovalOutput,
  formatBackgroundRemovalVideoMime,
  parseBackgroundRemovalRequestId,
} from '../frontend/src/server/tools/background-removal-request-utils.ts';

test('studio fal input maps MaxVideoAI controls to Bria v3 schema', () => {
  assert.deepEqual(
    buildBackgroundRemovalFalInput({
      videoUrl: 'https://example.com/source.mp4',
      backgroundColor: 'Transparent',
      outputCodec: 'webm_vp9',
      preserveAudio: false,
    }),
    {
      video_url: 'https://example.com/source.mp4',
      background_color: 'Transparent',
      output_container_and_codec: 'webm_vp9',
      preserve_audio: false,
    }
  );
});

test('realtime input emits only fields relevant to selected background type', () => {
  assert.deepEqual(buildBackgroundRemovalRealtimeInput({ backgroundType: 'blur', blurStrength: 73 }), {
    background_type: 'blur',
    blur_strength: 73,
  });
  assert.deepEqual(
    buildBackgroundRemovalRealtimeInput({
      backgroundType: 'image',
      backgroundImageUrl: 'https://example.com/bg.png',
    }),
    {
      background_type: 'image',
      background_image_url: 'https://example.com/bg.png',
    }
  );
});

test('provider output parsing supports Bria video object payloads', () => {
  const payload = {
    video: {
      url: 'https://cdn.example.com/output.webm',
      content_type: 'video/webm',
      file_name: 'output.webm',
      file_size: 123,
    },
    request_id: 'bria-123',
  };
  const output = extractBackgroundRemovalOutput(payload);
  assert.equal(output?.url, 'https://cdn.example.com/output.webm');
  assert.equal(output?.mimeType, 'video/webm');
  assert.equal(parseBackgroundRemovalRequestId(payload), 'bria-123');
  assert.equal(formatBackgroundRemovalVideoMime('mov_proresks'), 'video/quicktime');
});
