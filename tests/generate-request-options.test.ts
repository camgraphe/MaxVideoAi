import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import {
  buildGenerateRequestOptions,
  isVideoMode,
} from '../frontend/app/api/generate/_lib/request-options';
import type { EngineCaps } from '../frontend/types/engines';

const root = process.cwd();
const routePath = join(root, 'frontend/app/api/generate/route.ts');
const helperPath = join(root, 'frontend/app/api/generate/_lib/request-options.ts');
const normalizersPath = join(root, 'frontend/app/api/generate/_lib/request-option-normalizers.ts');
const bytePlusPath = join(root, 'frontend/app/api/generate/_lib/request-options-byteplus.ts');
const soraPath = join(root, 'frontend/app/api/generate/_lib/request-options-sora.ts');
const routeSource = readFileSync(routePath, 'utf8');

const baseEngine = {
  id: 'test-video-engine',
  label: 'Test Video Engine',
  modes: ['t2v', 'i2v'],
  resolutions: ['auto', '720p', '1080p'],
  aspectRatios: ['auto', '16:9', '9:16'],
} as EngineCaps;

test('generate route delegates request option normalization', () => {
  assert.ok(existsSync(helperPath), 'request option normalization should live in the generate route _lib folder');
  assert.ok(existsSync(normalizersPath), 'request option pure normalizers should live in a focused module');
  assert.ok(existsSync(bytePlusPath), 'BytePlus request option rules should live in a focused module');
  assert.ok(existsSync(soraPath), 'Sora request option rules should live in a focused module');
  assert.match(routeSource, /from '\.\/_lib\/request-options'/);
  assert.doesNotMatch(routeSource, /const multiPromptRaw = Array\.isArray\(body\.multiPrompt\)/);
  assert.doesNotMatch(routeSource, /parseSoraRequest\(candidate\)/);
  assert.doesNotMatch(routeSource, /BYTEPLUS_DURATION_UNSUPPORTED/);

  const lineCount = routeSource.split('\n').length;
  assert.ok(lineCount <= 1240, `/api/generate route should stay below 1240 lines after request option extraction, got ${lineCount}`);
});

test('request option helper exposes the route contract', () => {
  const helperSource = readFileSync(helperPath, 'utf8');
  const normalizersSource = readFileSync(normalizersPath, 'utf8');
  const bytePlusSource = readFileSync(bytePlusPath, 'utf8');
  const soraSource = readFileSync(soraPath, 'utf8');

  assert.match(helperSource, /export function isVideoMode/);
  assert.match(helperSource, /export function buildGenerateRequestOptions/);
  assert.match(helperSource, /from '\.\/request-option-normalizers'/);
  assert.match(helperSource, /from '\.\/request-options-byteplus'/);
  assert.match(helperSource, /from '\.\/request-options-sora'/);
  assert.match(normalizersSource, /export function normalizeMultiPrompt/);
  assert.match(normalizersSource, /export function normalizeGenerationElements/);
  assert.match(bytePlusSource, /BYTEPLUS_DURATION_UNSUPPORTED/);
  assert.match(soraSource, /parseSoraRequest/);

  const lineCount = helperSource.split('\n').length;
  assert.ok(lineCount <= 400, `request-options helper should stay below 400 lines after rules extraction, got ${lineCount}`);
});

test('request option helper normalizes multi-prompt duration and render metadata', () => {
  const result = buildGenerateRequestOptions({
    body: {
      prompt: '  castle reveal  ',
      multiPrompt: [
        { prompt: 'shot one', duration: '3s' },
        { prompt: 'shot two', duration: 4.4 },
        { prompt: '   ', duration: 9 },
      ],
      durationSec: 2,
      aspectRatio: 'auto',
      resolution: 'auto',
      renderIds: ['a', 12, 'b'],
      iterationIndex: 2.8,
      iterationCount: 0,
    },
    engine: baseEngine,
    mode: 't2v',
    isBytePlusV1a: false,
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.options.prompt, '  castle reveal  ');
  assert.deepEqual(result.options.multiPrompt, [
    { prompt: 'shot one', duration: 3 },
    { prompt: 'shot two', duration: 4 },
  ]);
  assert.equal(result.options.durationSec, 7);
  assert.equal(result.options.aspectRatio, '16:9');
  assert.equal(result.options.requestedResolution, 'auto');
  assert.equal(result.options.pricingResolution, '720p');
  assert.deepEqual(result.options.renderIds, ['a', 'b']);
  assert.equal(result.options.iterationIndex, 2);
  assert.equal(result.options.iterationCount, 1);
});

test('request option helper preserves MaxVideoAI element source metadata without accepting provider ids', () => {
  const result = buildGenerateRequestOptions({
    body: {
      prompt: 'element render',
      elements: [
        {
          id: 'element_1',
          providerElementId: '160',
          provider_element_id: '161',
          frontalImageUrl: ' https://cdn.maxvideoai.com/front.png ',
          frontalAssetId: 'asset_front',
          referenceImageUrls: ['https://cdn.maxvideoai.com/ref.png', ''],
          referenceAssetIds: ['asset_ref'],
          videoUrl: '',
          videoAssetId: '',
        },
      ],
    },
    engine: baseEngine,
    mode: 'i2v',
    isBytePlusV1a: false,
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.deepEqual(result.options.elements, [
    {
      id: 'element_1',
      providerElementId: undefined,
      frontalImageUrl: 'https://cdn.maxvideoai.com/front.png',
      frontalAssetId: 'asset_front',
      referenceImageUrls: ['https://cdn.maxvideoai.com/ref.png'],
      referenceAssetIds: ['asset_ref'],
      videoUrl: undefined,
      videoAssetId: undefined,
    },
  ]);
});

test('request option helper rejects unsupported BytePlus durations before provider submission', () => {
  const result = buildGenerateRequestOptions({
    body: {
      prompt: 'seedance render',
      durationSec: 4,
      resolution: '720p',
      aspectRatio: '16:9',
    },
    engine: {
      ...baseEngine,
      id: 'seedance-2-0',
      label: 'Seedance 2.0',
      resolutions: ['480p', '720p', '1080p'],
      aspectRatios: ['16:9', '9:16'],
    } as EngineCaps,
    mode: 't2v',
    isBytePlusV1a: true,
  });

  assert.equal(result.ok, false);
  if (result.ok) return;

  assert.equal(result.status, 400);
  assert.equal(result.body.error, 'BYTEPLUS_DURATION_UNSUPPORTED');
  assert.equal(result.metric?.errorCode, 'BYTEPLUS_DURATION_UNSUPPORTED');
});

test('request option helper keeps video mode narrowing explicit', () => {
  assert.equal(isVideoMode('t2v'), true);
  assert.equal(isVideoMode('t2i'), false);
  assert.equal(isVideoMode('unknown'), false);
});
