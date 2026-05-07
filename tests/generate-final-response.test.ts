import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import {
  buildFinalGenerateResponse,
  resolveGenerateResponsePaymentStatus,
} from '../frontend/app/api/generate/_lib/final-response';
import type { PendingReceipt } from '../frontend/app/api/generate/_lib/initial-video-job';
import type { PricingSnapshot } from '../frontend/types/engines';
import type { VideoAsset } from '../frontend/types/render';

const root = process.cwd();
const routePath = join(root, 'frontend/app/api/generate/route.ts');
const helperPath = join(root, 'frontend/app/api/generate/_lib/final-response.ts');

const routeSource = readFileSync(routePath, 'utf8');
const helperSource = readFileSync(helperPath, 'utf8');

const pricing = {
  totalCents: 1200,
  currency: 'USD',
} as PricingSnapshot;

const pendingReceipt: PendingReceipt = {
  userId: 'user_123',
  amountCents: 1200,
  currency: 'USD',
  description: 'Run Seedance - 8s',
  jobId: 'job_123',
  snapshot: { totalCents: 1200 },
  applicationFeeCents: 300,
  vendorAccountId: 'acct_123',
  stripePaymentIntentId: 'pi_123',
  stripeChargeId: 'ch_123',
};

test('generate route delegates final response building', () => {
  assert.ok(existsSync(helperPath), 'final response building should live in the generate route _lib folder');
  assert.match(routeSource, /from '\.\/_lib\/final-response'/);
  assert.match(routeSource, /const finalResponse = buildFinalGenerateResponse/);
  assert.match(routeSource, /return NextResponse\.json\(finalResponse\)/);
  assert.doesNotMatch(
    routeSource,
    /return NextResponse\.json\(\{\n\s+ok: true,\n\s+jobId,\n\s+videoUrl: video,/,
    'final success response shape belongs in final-response.ts'
  );

  const lineCount = routeSource.split('\n').length;
  assert.ok(lineCount <= 1865, `/api/generate route should stay below 1865 lines after final response extraction, got ${lineCount}`);
});

test('final response helper exposes the route contract', () => {
  assert.match(helperSource, /export type FinalGenerateResponse/, 'FinalGenerateResponse should be exported');
  assert.match(helperSource, /export function resolveGenerateResponsePaymentStatus/, 'payment status resolver should be exported');
  assert.match(helperSource, /export function buildFinalGenerateResponse/, 'final response builder should be exported');
});

test('final response helper builds the completed generation payload', () => {
  const videoAsset = {
    url: 'https://cdn.maxvideoai.com/video.mp4',
    mime: 'video/mp4',
  } as VideoAsset;

  assert.deepEqual(
    buildFinalGenerateResponse({
      jobId: 'job_123',
      media: {
        video: 'https://cdn.maxvideoai.com/video.mp4',
        videoAsset,
        thumb: 'https://cdn.maxvideoai.com/thumb.jpg',
      },
      completion: {
        status: 'completed',
        progress: 100,
        message: 'Render complete',
        etaSeconds: null,
        etaLabel: null,
      },
      pricing,
      payment: {
        pendingReceipt: null,
        paymentMode: 'wallet',
        paymentStatus: 'paid_wallet',
      },
      provider: {
        providerMode: 'fal',
        providerJobId: 'provider_123',
      },
      batch: {
        batchId: 'batch_123',
        groupId: 'group_123',
        iterationIndex: 0,
        iterationCount: 2,
        renderIds: ['job_123', 'job_456'],
        heroRenderId: 'job_123',
        localKey: 'local_123',
      },
    }),
    {
      ok: true,
      jobId: 'job_123',
      videoUrl: 'https://cdn.maxvideoai.com/video.mp4',
      video: videoAsset,
      thumbUrl: 'https://cdn.maxvideoai.com/thumb.jpg',
      status: 'completed',
      progress: 100,
      pricing,
      paymentStatus: 'paid_wallet',
      provider: 'fal',
      providerJobId: 'provider_123',
      batchId: 'batch_123',
      groupId: 'group_123',
      iterationIndex: 0,
      iterationCount: 2,
      renderIds: ['job_123', 'job_456'],
      heroRenderId: 'job_123',
      localKey: 'local_123',
      message: 'Render complete',
      etaSeconds: null,
      etaLabel: null,
    }
  );
});

test('final response helper reports refunded wallet status for failed wallet generations', () => {
  assert.equal(
    resolveGenerateResponsePaymentStatus({
      status: 'failed',
      pendingReceipt,
      paymentMode: 'wallet',
      paymentStatus: 'paid_wallet',
    }),
    'refunded_wallet'
  );

  const response = buildFinalGenerateResponse({
    jobId: 'job_123',
    media: {
      video: null,
      videoAsset: null,
      thumb: '/assets/frames/thumb-16x9.svg',
    },
    completion: {
      status: 'failed',
      progress: 0,
      message: 'Provider copy failed',
      etaSeconds: 30,
      etaLabel: '30s',
    },
    pricing,
    payment: {
      pendingReceipt,
      paymentMode: 'wallet',
      paymentStatus: 'paid_wallet',
    },
    provider: {
      providerMode: 'fal',
      providerJobId: 'provider_123',
    },
    batch: {
      batchId: null,
      groupId: null,
      iterationIndex: null,
      iterationCount: null,
      renderIds: null,
      heroRenderId: null,
      localKey: null,
    },
  });

  assert.equal(response.paymentStatus, 'refunded_wallet');
  assert.equal(response.videoUrl, null);
  assert.equal(response.message, 'Provider copy failed');
});

test('payment status resolver preserves non-wallet statuses', () => {
  assert.equal(
    resolveGenerateResponsePaymentStatus({
      status: 'failed',
      pendingReceipt,
      paymentMode: 'direct',
      paymentStatus: 'paid_direct',
    }),
    'paid_direct'
  );
  assert.equal(
    resolveGenerateResponsePaymentStatus({
      status: 'completed',
      pendingReceipt,
      paymentMode: 'wallet',
      paymentStatus: 'paid_wallet',
    }),
    'paid_wallet'
  );
});
