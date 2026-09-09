import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  parseTimelineExportRequest,
} from '../frontend/src/server/timeline-exports/render-request';
import {
  signTimelineExportEstimateToken,
  timelineExportManifestHash,
  verifyTimelineExportEstimateToken,
} from '../frontend/src/server/timeline-exports/estimate-token';
import {
  validateLegacyTimelineExportMediaUrl,
} from '../frontend/src/server/timeline-exports/media-security';

const secret = 'test-timeline-export-secret-with-at-least-32-bytes';

function requestFixture() {
  return {
    version: 1,
    source: 'maxvideoai-editor',
    projectId: 'project-owned',
    idempotencyKey: 'export-idempotency-123456',
    createdAt: '2026-07-11T08:00:00.000Z',
    status: 'ready',
    manifest: {
      version: 1,
      source: 'maxvideoai-editor',
      projectName: 'Owned project',
      sequenceId: 'sequence-main',
      sequenceName: 'Main sequence',
      projectSettings: { aspectRatio: '16:9', resolution: '1080p', fps: 30 },
      createdAt: '2026-07-11T08:00:00.000Z',
      status: 'ready',
      durationSec: 5,
      exportRange: { mode: 'sequence', startSec: 0, endSec: 5, durationSec: 5 },
      tracks: [{
        id: 'video',
        durationSec: 5,
        clips: [{
          id: 'clip-1',
          outputNodeId: 'output-1',
          assetId: 'asset-1',
          title: 'Clip 1',
          track: 'video',
          mediaKind: 'video',
          mediaUrl: 'https://cdn.maxvideoai.com/users/user-1/clip-1.mp4',
          startSec: 0,
          endSec: 5,
          durationSec: 5,
          sourceStartSec: 0,
          sourceEndSec: 5,
          sourceDurationSec: null,
        }],
      }],
      issues: [],
    },
    exportSettings: {
      format: 'mp4-h264',
      qualityPreset: 'standard',
      includeAudio: true,
      serverRenderMode: 'server',
    },
  };
}

test('timeline export request parser deeply validates bounded ready manifests', () => {
  const request = parseTimelineExportRequest(requestFixture());
  assert.equal(request.projectId, 'project-owned');
  assert.equal(request.manifest.tracks[0]?.clips[0]?.assetId, 'asset-1');

  const overlapping = requestFixture();
  overlapping.manifest.tracks[0].clips.push({
    ...overlapping.manifest.tracks[0].clips[0],
    id: 'clip-overlap',
    startSec: 4,
    endSec: 5,
    durationSec: 1,
    sourceEndSec: 1,
  });
  assert.throws(() => parseTimelineExportRequest(overlapping), /EXPORT_MANIFEST_OVERLAP/);

  const oversized = requestFixture();
  oversized.manifest.durationSec = 60 * 60 * 7;
  oversized.manifest.exportRange.endSec = oversized.manifest.durationSec;
  oversized.manifest.exportRange.durationSec = oversized.manifest.durationSec;
  assert.throws(() => parseTimelineExportRequest(oversized), /INVALID_EXPORT_REQUEST/);
});

test('legacy export URLs require approved HTTPS media with bounded HEAD metadata', async () => {
  const accepted = await validateLegacyTimelineExportMediaUrl({
    url: 'https://cdn.maxvideoai.com/users/user-1/clip-1.mp4',
    mediaKind: 'video',
    requestOrigin: 'https://maxvideoai.com',
    fetchImpl: async () => new Response(null, {
      status: 200,
      headers: {
        'content-length': String(32 * 1024 * 1024),
        'content-type': 'video/mp4',
      },
    }),
  });
  assert.equal(accepted, 'https://cdn.maxvideoai.com/users/user-1/clip-1.mp4');

  await assert.rejects(() => validateLegacyTimelineExportMediaUrl({
    url: 'http://127.0.0.1:3000/internal',
    mediaKind: 'video',
    requestOrigin: 'https://maxvideoai.com',
    fetchImpl: async () => new Response(null, { status: 200 }),
  }), /EXPORT_MEDIA_URL_NOT_ALLOWED/);

  await assert.rejects(() => validateLegacyTimelineExportMediaUrl({
    url: 'https://cdn.maxvideoai.com/users/user-1/huge.mp4',
    mediaKind: 'video',
    requestOrigin: 'https://maxvideoai.com',
    fetchImpl: async () => new Response(null, {
      status: 200,
      headers: {
        'content-length': String(3 * 1024 * 1024 * 1024),
        'content-type': 'video/mp4',
      },
    }),
  }), /EXPORT_MEDIA_TOO_LARGE/);
});

test('timeline export estimate tokens bind identity, manifest, preset, idempotency, kind, amount, and expiry', () => {
  const manifestHash = timelineExportManifestHash(requestFixture().manifest);
  const claims = {
    userId: 'user-1',
    manifestHash,
    qualityPreset: 'standard' as const,
    idempotencyKey: 'export-idempotency-123456',
    billingKind: 'paid' as const,
    amountCents: 180,
    issuedAt: 1_720_000_000,
    expiresAt: 1_720_000_300,
  };
  const token = signTimelineExportEstimateToken({ claims, secret });

  assert.deepEqual(verifyTimelineExportEstimateToken({
    token,
    expected: claims,
    secret,
    now: 1_720_000_100,
  }), { ...claims, version: 1 });
  assert.throws(() => verifyTimelineExportEstimateToken({
    token,
    expected: { ...claims, amountCents: 181 },
    secret,
    now: 1_720_000_100,
  }), /EXPORT_ESTIMATE_CHANGED/);
  assert.throws(() => verifyTimelineExportEstimateToken({
    token,
    expected: claims,
    secret,
    now: claims.expiresAt + 1,
  }), /EXPORT_ESTIMATE_EXPIRED/);

  const [payload, signature] = token.split('.');
  const tampered = `${payload.slice(0, -1)}${payload.endsWith('A') ? 'B' : 'A'}.${signature}`;
  assert.throws(() => verifyTimelineExportEstimateToken({
    token: tampered,
    expected: claims,
    secret,
    now: 1_720_000_100,
  }), /EXPORT_ESTIMATE_INVALID/);
});

test('timeline export routes resolve authenticated project ownership and bind quotes inside reservation transaction', () => {
  const estimateRoute = readFileSync('frontend/app/api/studio/timeline-exports/estimate/route.ts', 'utf8');
  const createRoute = readFileSync('frontend/app/api/studio/timeline-exports/route.ts', 'utf8');
  const resolver = readFileSync('frontend/src/server/timeline-exports/manifest-resolver.ts', 'utf8');
  const billing = readFileSync('frontend/src/server/timeline-exports/billing.ts', 'utf8');

  assert.match(estimateRoute, /resolveOwnedTimelineExportRequest/);
  assert.match(createRoute, /resolveOwnedTimelineExportRequest/);
  assert.match(resolver, /readStudioProject/);
  assert.match(resolver, /readStudioSequence/);
  assert.match(resolver, /projectAssets/);
  assert.match(resolver, /assetId/);
  assert.match(billing, /verifyTimelineExportEstimateToken/);
  assert.match(billing, /EXPORT_IDEMPOTENCY_CONFLICT/);
  const createReservationStart = billing.indexOf('export async function createTimelineExportJobWithReservation');
  const transactionStart = billing.indexOf('return withDbTransaction(async (executor)', createReservationStart);
  const quoteVerificationCall = billing.indexOf('verifyTimelineExportEstimateToken({', transactionStart);
  const receiptInsert = billing.indexOf('INSERT INTO app_receipts', transactionStart);
  assert.ok(transactionStart >= 0, 'job reservation must execute inside a database transaction');
  assert.ok(
    quoteVerificationCall > transactionStart,
    'quote verification must execute inside the reservation transaction'
  );
  assert.ok(
    quoteVerificationCall < receiptInsert,
    'quote verification must happen before a paid reservation'
  );
  const withoutVerificationCall = `${billing.slice(0, quoteVerificationCall)}${billing.slice(billing.indexOf('});', quoteVerificationCall) + 3)}`;
  assert.equal(
    withoutVerificationCall.indexOf('verifyTimelineExportEstimateToken({', transactionStart),
    -1,
    'the scoped assertion must not match the import when the transaction call is absent'
  );
});
