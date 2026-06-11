import assert from 'node:assert/strict';
import test from 'node:test';
import { buildBackgroundRemovalProviderInput } from '../frontend/src/lib/tools-background-removal.ts';
import {
  extractBackgroundRemovalOutput,
  formatBackgroundRemovalVideoMime,
  parseBackgroundRemovalRequestId,
} from '../frontend/src/server/tools/background-removal-request-utils.ts';
import {
  BACKGROUND_REMOVAL_PRORES_RETENTION_DAYS,
  buildBackgroundRemovalOutputRetentionMetadata,
} from '../frontend/src/server/tools/background-removal-output-persistence.ts';

test('studio provider input maps MaxVideoAI controls to Bria v3 schema', () => {
  assert.deepEqual(
    buildBackgroundRemovalProviderInput({
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

test('studio provider input defaults to a browser-friendly transparent export', () => {
  assert.deepEqual(
    buildBackgroundRemovalProviderInput({
      videoUrl: 'https://example.com/source.mp4',
    }),
    {
      video_url: 'https://example.com/source.mp4',
      background_color: 'Transparent',
      output_container_and_codec: 'webm_vp9',
      preserve_audio: true,
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

test('ProRes background removal outputs carry seven-day retention metadata', () => {
  const now = new Date('2026-06-11T12:00:00.000Z');
  const retention = buildBackgroundRemovalOutputRetentionMetadata('mov_proresks', now);

  assert.equal(retention.premiumFormat, true);
  assert.equal(retention.retentionDays, BACKGROUND_REMOVAL_PRORES_RETENTION_DAYS);
  assert.equal(retention.expiresAt, '2026-06-18T12:00:00.000Z');
  assert.equal(buildBackgroundRemovalOutputRetentionMetadata('webm_vp9', now).expiresAt, null);
});
