import assert from 'node:assert/strict';
import test from 'node:test';
import { isStablePublicMediaUrl } from '../frontend/lib/media.ts';

test('stable public media URL gate rejects private, signed, and provider-temporary URLs', () => {
  assert.equal(isStablePublicMediaUrl('https://media.maxvideoai.com/renders/example.mp4'), true);
  assert.equal(isStablePublicMediaUrl('/renders/example.mp4'), true);
  assert.equal(isStablePublicMediaUrl('/api/media-proxy?url=https%3A%2F%2Fmedia.maxvideoai.com%2Frenders%2Fexample.mp4'), false);
  assert.equal(isStablePublicMediaUrl('/admin/video-seo/example.mp4'), false);
  assert.equal(isStablePublicMediaUrl('https://media.maxvideoai.com/renders/example.mp4?X-Amz-Signature=abc'), false);
  assert.equal(isStablePublicMediaUrl('https://example.volces.com/seedream-5-0/video.mp4?X-Tos-Expires=60'), false);
});
