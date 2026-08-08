import assert from 'node:assert/strict';
import test from 'node:test';

import {
  validateGenerationMediaConstraints,
  type StoredMediaMetadataRow,
} from '../frontend/app/api/generate/_lib/generation-media-constraints';
import type { NormalizedAttachment } from '../frontend/app/api/generate/_lib/attachments';
import { MINIMAX_H3_FAL_ENGINE_REGISTRY } from '../frontend/src/config/fal-engines/minimax-h3';
import type { ReferenceBudgetMediaItem } from '../frontend/lib/reference-budget';

const MB = 1024 * 1024;
const inputSchema = MINIMAX_H3_FAL_ENGINE_REGISTRY[0]?.engine.inputSchema;
assert.ok(inputSchema);

type MediaKind = 'image' | 'video' | 'audio';

function fieldFor(kind: MediaKind): string {
  if (kind === 'image') return 'reference_image_urls';
  if (kind === 'video') return 'reference_video_urls';
  return 'reference_audio_urls';
}

function extensionFor(kind: MediaKind): string {
  if (kind === 'image') return 'jpg';
  if (kind === 'video') return 'mp4';
  return 'wav';
}

function mimeFor(kind: MediaKind): string {
  if (kind === 'image') return 'image/jpeg';
  if (kind === 'video') return 'video/mp4';
  return 'audio/wav';
}

function mediaFixture(params: {
  kind: MediaKind;
  id?: string;
  sizeMB: number;
  durationSec?: number | null;
}) {
  const id = params.id ?? `${params.kind}-1`;
  const fieldId = fieldFor(params.kind);
  const url = `https://media.maxvideoai.com/user-assets/${id}.${extensionFor(params.kind)}`;
  const attachment: NormalizedAttachment = {
    name: `${id}.${extensionFor(params.kind)}`,
    type: mimeFor(params.kind),
    size: 1,
    kind: params.kind,
    slotId: fieldId,
    url,
    durationSec: 999,
    assetId: id,
  };
  const reference: ReferenceBudgetMediaItem = { fieldId, kind: params.kind, url };
  const row: StoredMediaMetadataRow = {
    asset_id: id,
    url,
    origin_url: null,
    original_name: attachment.name,
    mime_type: attachment.type,
    size_bytes: params.sizeMB * MB,
    duration_sec: params.durationSec ?? null,
  };
  return { attachment, reference, row };
}

async function validate(fixtures: ReturnType<typeof mediaFixture>[]) {
  return validateGenerationMediaConstraints({
    engineId: 'minimax-h3',
    mode: 'ref2v',
    userId: 'user-h3',
    inputSchema,
    attachments: fixtures.map(({ attachment }) => attachment),
    referenceMediaItems: fixtures.map(({ reference }) => reference),
    deps: {
      queryFn: async <T>() => fixtures.map(({ row }) => row) as T[],
    },
  });
}

test('MiniMax H3 enforces exact stored media size boundaries', async () => {
  assert.equal((await validate([mediaFixture({ kind: 'image', sizeMB: 30 })])).ok, true);
  assert.equal((await validate([mediaFixture({ kind: 'image', sizeMB: 30 + 1 / MB })])).ok, false);
  assert.equal((await validate([mediaFixture({ kind: 'video', sizeMB: 50, durationSec: 2 })])).ok, true);
  assert.equal((await validate([mediaFixture({ kind: 'video', sizeMB: 50 + 1 / MB, durationSec: 2 })])).ok, false);
  assert.equal((await validate([mediaFixture({ kind: 'audio', sizeMB: 15, durationSec: 15 })])).ok, true);
  assert.equal((await validate([mediaFixture({ kind: 'audio', sizeMB: 15 + 1 / MB, durationSec: 15 })])).ok, false);
});

test('MiniMax H3 enforces trusted individual video and audio durations', async () => {
  for (const durationSec of [2, 15]) {
    assert.equal((await validate([mediaFixture({ kind: 'video', sizeMB: 1, durationSec })])).ok, true);
    assert.equal((await validate([mediaFixture({ kind: 'audio', sizeMB: 1, durationSec })])).ok, true);
  }
  for (const durationSec of [1.99, 15.01]) {
    const video = await validate([mediaFixture({ kind: 'video', sizeMB: 1, durationSec })]);
    assert.equal(video.ok, false);
    if (!video.ok) assert.equal(video.body.field, 'reference_video_urls');
    const audio = await validate([mediaFixture({ kind: 'audio', sizeMB: 1, durationSec })]);
    assert.equal(audio.ok, false);
    if (!audio.ok) assert.equal(audio.body.field, 'reference_audio_urls');
  }
});

test('MiniMax H3 rejects missing trusted duration metadata for temporal references', async () => {
  for (const kind of ['video', 'audio'] as const) {
    const result = await validate([mediaFixture({ kind, sizeMB: 1, durationSec: null })]);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.body.error, 'MEDIA_DURATION_UNVERIFIED');
      assert.equal(result.body.field, fieldFor(kind));
    }
  }
});

test('MiniMax H3 enforces 15-second combined video and audio reference budgets', async () => {
  for (const kind of ['video', 'audio'] as const) {
    const exact = await validate([
      mediaFixture({ kind, id: `${kind}-a`, sizeMB: 1, durationSec: 5 }),
      mediaFixture({ kind, id: `${kind}-b`, sizeMB: 1, durationSec: 5 }),
      mediaFixture({ kind, id: `${kind}-c`, sizeMB: 1, durationSec: 5 }),
    ]);
    assert.equal(exact.ok, true);

    const over = await validate([
      mediaFixture({ kind, id: `${kind}-a`, sizeMB: 1, durationSec: 5 }),
      mediaFixture({ kind, id: `${kind}-b`, sizeMB: 1, durationSec: 5 }),
      mediaFixture({ kind, id: `${kind}-c`, sizeMB: 1, durationSec: 5.01 }),
    ]);
    assert.equal(over.ok, false);
    if (!over.ok) {
      assert.equal(over.body.error, 'MEDIA_COMBINED_DURATION_EXCEEDED');
      assert.equal(over.body.field, fieldFor(kind));
    }
  }
});
