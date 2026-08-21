import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { NextRequest } from 'next/server';

import { handleAudioUpload } from '../frontend/app/api/uploads/audio/_lib/audio-upload-handler.ts';
import { getFalEngineById } from '../frontend/src/config/falEngines.ts';
import {
  resolveEngineMediaFieldConstraint,
  validateMediaFileAgainstConstraint,
} from '../frontend/lib/media-field-constraints.ts';
import {
  validateGenerationMediaConstraints,
  type StoredMediaMetadataRow,
} from '../frontend/app/api/generate/_lib/generation-media-constraints.ts';
import type { NormalizedAttachment } from '../frontend/app/api/generate/_lib/attachments.ts';
import type { ReferenceBudgetMediaItem } from '../frontend/lib/reference-budget.ts';

const MB = 1024 * 1024;
const AUDIO_URL = 'https://media.maxvideoai.com/user-assets/reference.mp3';
const VIDEO_URL = 'https://media.maxvideoai.com/user-assets/source.mp4';

function seedanceAudioContext() {
  const entry = getFalEngineById('seedance-2-5');
  assert.ok(entry);
  const field = [...(entry.engine.inputSchema?.required ?? []), ...(entry.engine.inputSchema?.optional ?? [])]
    .find((candidate) => candidate.id === 'audio_urls');
  assert.ok(field);
  return { engine: entry.engine, field };
}

function referenceItem(url = AUDIO_URL): ReferenceBudgetMediaItem {
  return { fieldId: 'audio_urls', kind: 'audio', url };
}

function attachment(overrides: Partial<NormalizedAttachment> = {}): NormalizedAttachment {
  return {
    name: 'reference.mp3',
    type: 'audio/mpeg',
    size: 1,
    kind: 'audio',
    slotId: 'audio_urls',
    url: AUDIO_URL,
    assetId: 'asset-audio',
    ...overrides,
  };
}

function storedRow(overrides: Partial<StoredMediaMetadataRow> = {}): StoredMediaMetadataRow {
  return {
    asset_id: 'asset-audio',
    url: AUDIO_URL,
    origin_url: null,
    original_name: 'reference.mp3',
    mime_type: 'audio/mpeg',
    size_bytes: 15 * MB,
    ...overrides,
  };
}

async function validateStoredAudio(params: {
  row?: StoredMediaMetadataRow | null;
  attachment?: NormalizedAttachment;
  reference?: ReferenceBudgetMediaItem;
}) {
  const { engine } = seedanceAudioContext();
  const calls: Array<{ sql: string; values: readonly unknown[] | undefined }> = [];
  const result = await validateGenerationMediaConstraints({
    engineId: engine.id,
    mode: 'v2v',
    userId: 'user-1',
    inputSchema: engine.inputSchema,
    attachments: [params.attachment ?? attachment()],
    referenceMediaItems: [params.reference ?? referenceItem()],
    deps: {
      queryFn: async <T>(sql: string, values?: readonly unknown[]) => {
        calls.push({ sql, values });
        return (params.row ? [params.row] : []) as T[];
      },
    },
  });
  return { result, calls };
}

async function validateStoredVideo(width: number, height: number) {
  const entry = getFalEngineById('seedance-2-5');
  assert.ok(entry);
  return validateGenerationMediaConstraints({
    engineId: entry.engine.id,
    mode: 'v2v',
    userId: 'user-1',
    inputSchema: entry.engine.inputSchema,
    attachments: [{
      name: 'source.mp4',
      type: 'video/mp4',
      size: 1,
      kind: 'video',
      slotId: 'video_url',
      url: VIDEO_URL,
      assetId: 'asset-video',
    }],
    referenceMediaItems: [{ fieldId: 'video_url', kind: 'video', url: VIDEO_URL }],
    deps: {
      queryFn: async <T>() => [{
        asset_id: 'asset-video',
        url: VIDEO_URL,
        origin_url: null,
        original_name: 'source.mp4',
        mime_type: 'video/mp4',
        size_bytes: 425_179,
        width,
        height,
      }] as T[],
    },
  });
}

test('Seedance 2.5 audio field resolves an exact 15 MB MP3/WAV contract', () => {
  const { engine, field } = seedanceAudioContext();
  const constraint = resolveEngineMediaFieldConstraint({ engine, field });
  assert.deepEqual(constraint, {
    maxSizeMB: 15,
    acceptedMimeTypes: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/vnd.wave'],
    acceptedFileExtensions: ['mp3', 'wav'],
  });

  assert.deepEqual(validateMediaFileAgainstConstraint({
    name: 'reference.mp3',
    mimeType: 'audio/mpeg',
    sizeBytes: 15 * MB,
    constraint,
  }), { ok: true });
  assert.deepEqual(validateMediaFileAgainstConstraint({
    name: 'reference.wav',
    mimeType: 'audio/wav',
    sizeBytes: 15 * MB,
    constraint,
  }), { ok: true });

  const tooLarge = validateMediaFileAgainstConstraint({
    name: 'reference.mp3',
    mimeType: 'audio/mpeg',
    sizeBytes: 15 * MB + 1,
    constraint,
  });
  assert.equal(tooLarge.ok, false);
  assert.equal(tooLarge.ok ? null : tooLarge.reason, 'size');

  const m4a = validateMediaFileAgainstConstraint({
    name: 'reference.m4a',
    mimeType: 'audio/mp4',
    sizeBytes: 1,
    constraint,
  });
  assert.equal(m4a.ok, false);
  assert.equal(m4a.ok ? null : m4a.reason, 'format');
});

test('generation validation uses stored user-owned metadata instead of client size or MIME', async () => {
  const exactMp3 = await validateStoredAudio({ row: storedRow() });
  assert.deepEqual(exactMp3.result, { ok: true });
  assert.equal(exactMp3.calls.length, 1);
  assert.match(exactMp3.calls[0].sql, /user_assets/);
  assert.match(exactMp3.calls[0].sql, /media_assets/);
  assert.deepEqual(exactMp3.calls[0].values?.[0], 'user-1');

  const exactWav = await validateStoredAudio({
    row: storedRow({
      url: 'https://media.maxvideoai.com/user-assets/reference.wav',
      origin_url: 'https://media.maxvideoai.com/library/original.wav',
      original_name: 'reference.wav',
      mime_type: 'audio/wav',
    }),
    attachment: attachment({
      name: 'untrusted.m4a',
      type: 'audio/mp4',
      size: 99 * MB,
      url: 'https://media.maxvideoai.com/library/original.wav',
    }),
    reference: referenceItem('https://media.maxvideoai.com/library/original.wav'),
  });
  assert.deepEqual(exactWav.result, { ok: true });

  const tooLarge = await validateStoredAudio({
    row: storedRow({ size_bytes: 15 * MB + 1 }),
    attachment: attachment({ size: 1, type: 'audio/mpeg' }),
  });
  assert.equal(tooLarge.result.ok, false);
  assert.equal(tooLarge.result.ok ? null : tooLarge.result.body.error, 'MEDIA_FILE_TOO_LARGE');
  assert.equal(tooLarge.result.ok ? null : tooLarge.result.body.field, 'audio_urls');

  const m4a = await validateStoredAudio({
    row: storedRow({ original_name: 'reference.m4a', mime_type: 'audio/mp4', size_bytes: 2 * MB }),
  });
  assert.equal(m4a.result.ok, false);
  assert.equal(m4a.result.ok ? null : m4a.result.body.error, 'MEDIA_FORMAT_UNSUPPORTED');

  const unknown = await validateStoredAudio({ row: null });
  assert.equal(unknown.result.ok, false);
  assert.equal(unknown.result.ok ? null : unknown.result.body.error, 'MEDIA_METADATA_UNVERIFIED');

  const mismatchedAsset = await validateStoredAudio({
    row: storedRow({ url: 'https://media.maxvideoai.com/user-assets/different.mp3', size_bytes: 1 }),
  });
  assert.equal(mismatchedAsset.result.ok, false);
  assert.equal(mismatchedAsset.result.ok ? null : mismatchedAsset.result.body.error, 'MEDIA_METADATA_UNVERIFIED');
});

test('Seedance 2.5 rejects source videos below the provider pixel floor before submission', async () => {
  const belowFloor = await validateStoredVideo(637, 640);
  assert.equal(belowFloor.ok, false);
  if (belowFloor.ok) return;
  assert.equal(belowFloor.status, 422);
  assert.deepEqual(belowFloor.body, {
    ok: false,
    error: 'MEDIA_DIMENSIONS_TOO_SMALL',
    message: 'This video is 637 x 640 px. Seedance 2.5 requires at least 407696 total pixels. Choose a larger video and try again.',
    field: 'video_url',
    actualWidth: 637,
    actualHeight: 640,
    minimumPixelCount: 407696,
  });

  const aboveFloor = await validateStoredVideo(638, 640);
  assert.deepEqual(aboveFloor, { ok: true });
});

test('Seedance 2.5 probes a trusted stored video when dimension metadata is missing', async () => {
  const entry = getFalEngineById('seedance-2-5');
  assert.ok(entry);
  const result = await validateGenerationMediaConstraints({
    engineId: entry.engine.id,
    mode: 'v2v',
    userId: 'user-1',
    inputSchema: entry.engine.inputSchema,
    attachments: [{
      name: 'source.mp4',
      type: 'video/mp4',
      size: 1,
      kind: 'video',
      slotId: 'video_url',
      url: VIDEO_URL,
      assetId: 'asset-video',
    }],
    referenceMediaItems: [{ fieldId: 'video_url', kind: 'video', url: VIDEO_URL }],
    deps: {
      queryFn: async <T>() => [{
        asset_id: 'asset-video',
        url: VIDEO_URL,
        origin_url: null,
        original_name: 'source.mp4',
        mime_type: 'video/mp4',
        size_bytes: 425_179,
        width: null,
        height: null,
      }] as T[],
      detectVideoDimensionsFn: async () => ({ width: 638, height: 640 }),
    },
  });

  assert.deepEqual(result, { ok: true });
});

async function uploadRequest(params: {
  name: string;
  mimeType: string;
  sizeBytes: number;
  constrained?: boolean;
  engineId?: string;
}) {
  const form = new FormData();
  form.set('file', new File([new Uint8Array(params.sizeBytes)], params.name, { type: params.mimeType }));
  if (params.constrained) {
    form.set('engineId', params.engineId ?? 'seedance-2-5');
    form.set('mode', 'v2v');
    form.set('fieldId', 'audio_urls');
  }
  return handleAudioUpload(
    new NextRequest('http://localhost/api/uploads/audio', { method: 'POST', body: form }),
    { getRouteAuthContextFn: async () => ({ userId: null }) }
  );
}

test('audio upload API applies Seedance field limits before auth while generic uploads keep existing limits', async () => {
  const exactMp3 = await uploadRequest({ name: 'reference.mp3', mimeType: 'audio/mpeg', sizeBytes: 15 * MB, constrained: true });
  assert.equal(exactMp3.status, 401);
  const exactWav = await uploadRequest({ name: 'reference.wav', mimeType: 'audio/wav', sizeBytes: 1, constrained: true });
  assert.equal(exactWav.status, 401);

  const tooLarge = await uploadRequest({ name: 'reference.mp3', mimeType: 'audio/mpeg', sizeBytes: 15 * MB + 1, constrained: true });
  assert.equal(tooLarge.status, 413);
  assert.deepEqual(await tooLarge.json(), { ok: false, error: 'FILE_TOO_LARGE', maxMB: 15 });

  const m4a = await uploadRequest({ name: 'reference.m4a', mimeType: 'audio/mp4', sizeBytes: 1, constrained: true });
  assert.equal(m4a.status, 415);
  assert.deepEqual(await m4a.json(), { ok: false, error: 'UNSUPPORTED_TYPE' });

  const missingExtension = await uploadRequest({ name: 'reference', mimeType: 'audio/mpeg', sizeBytes: 1, constrained: true });
  assert.equal(missingExtension.status, 415);

  const genericFieldWrongType = await uploadRequest({
    name: 'not-audio.png',
    mimeType: 'image/png',
    sizeBytes: 1,
    constrained: true,
    engineId: 'seedance-2-0',
  });
  assert.equal(genericFieldWrongType.status, 415);

  const genericM4a = await uploadRequest({ name: 'unrelated.m4a', mimeType: 'audio/mp4', sizeBytes: 20 * MB });
  assert.equal(genericM4a.status, 401);
});

test('workspace upload context and trusted generation validation are wired before billing', () => {
  const dropzoneSource = readFileSync('frontend/components/AssetDropzone.tsx', 'utf8');
  const dropzoneHelpersSource = readFileSync('frontend/components/asset-dropzone/asset-dropzone-helpers.ts', 'utf8');
  const workspaceUploadSource = readFileSync('frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceReferenceAssets.ts', 'utf8');
  const generateRouteSource = readFileSync('frontend/app/api/generate/route.ts', 'utf8');
  const attachmentProcessingSource = readFileSync(
    'frontend/app/api/generate/_lib/generation-attachment-processing.ts',
    'utf8'
  );

  assert.match(dropzoneSource, /resolveEngineMediaFieldConstraint/);
  assert.match(dropzoneSource, /validateEngineAudioFile/);
  assert.match(dropzoneHelpersSource, /validateMediaFileAgainstConstraint/);
  assert.match(workspaceUploadSource, /formData\.append\('engineId', engineId\)/);
  assert.match(workspaceUploadSource, /formData\.append\('mode', preferredMode\)/);
  assert.match(workspaceUploadSource, /formData\.append\('fieldId', field\.id\)/);
  const constraintValidation = generateRouteSource.indexOf('const attachmentProcessing = await processAndValidateGenerationAttachments');
  const billingPreflight = generateRouteSource.indexOf('const billingPreflight = await resolveGenerateBillingPreflight');
  assert.ok(constraintValidation >= 0);
  assert.ok(constraintValidation < billingPreflight, 'trusted media validation must run before billing preflight');
  assert.match(attachmentProcessingSource, /validateGenerationMediaConstraints/);
});
