import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveWorkspaceReferenceFieldTitle } from '../frontend/components/composer/workspace-reference-copy';
import type { EngineInputField } from '../frontend/types/engines';

function field(id: string, type: EngineInputField['type'], label: string, maxCount?: number): EngineInputField {
  return { id, type, label, ...(maxCount == null ? {} : { maxCount }) };
}

test('known reference roles use localized French and Spanish capacity copy', () => {
  const source = field('video_url', 'video', 'Source video', 1);
  const images = field('image_urls', 'image', 'Reference images (up to 30)', 30);
  const videos = field('video_urls', 'video', 'Reference video clips (up to 10)', 10);
  const audio = field('audio_urls', 'audio', 'Reference audio clips (up to 10)', 10);

  assert.equal(resolveWorkspaceReferenceFieldTitle(source, 'generic', 'fr'), 'Vidéo source');
  assert.equal(resolveWorkspaceReferenceFieldTitle(images, 'reference', 'fr'), 'Images de référence (jusqu’à 30)');
  assert.equal(resolveWorkspaceReferenceFieldTitle(videos, 'reference', 'fr'), 'Clips vidéo de référence (jusqu’à 10)');
  assert.equal(resolveWorkspaceReferenceFieldTitle(audio, 'reference', 'fr'), 'Clips audio de référence (jusqu’à 10)');
  assert.equal(resolveWorkspaceReferenceFieldTitle(source, 'generic', 'es'), 'Video fuente');
  assert.equal(resolveWorkspaceReferenceFieldTitle(images, 'reference', 'es'), 'Imágenes de referencia (hasta 30)');
  assert.equal(resolveWorkspaceReferenceFieldTitle(videos, 'reference', 'es'), 'Clips de vídeo de referencia (hasta 10)');
  assert.equal(resolveWorkspaceReferenceFieldTitle(audio, 'reference', 'es'), 'Clips de audio de referencia (hasta 10)');
});

test('custom labels and exact field identity remain unchanged', () => {
  const custom = field('mask_video_url', 'video', 'Foreground mask', 4);
  const before = structuredClone(custom);
  assert.equal(resolveWorkspaceReferenceFieldTitle(custom, 'reference', 'fr'), 'Foreground mask');
  assert.equal(resolveWorkspaceReferenceFieldTitle(custom, 'generic', 'es'), 'Foreground mask');
  assert.deepEqual(custom, before);
  assert.equal(custom.id, 'mask_video_url');
});
