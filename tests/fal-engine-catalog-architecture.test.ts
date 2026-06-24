import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const facadePath = join(root, 'frontend/src/config/falEngines.ts');
const modulesDir = join(root, 'frontend/src/config/fal-engines');
const moduleNames = [
  'types.ts',
  'launch-config.ts',
  'luma-ray-shared.ts',
  'luma-agents-shared.ts',
  'registry.ts',
  'pika.ts',
  'sora.ts',
  'veo-3-1.ts',
  'veo-3-1-fast.ts',
  'veo-3-1-lite.ts',
  'luma-ray-3-2.ts',
  'luma-ray-2.ts',
  'luma-ray-2-flash.ts',
  'luma-ray-3-2.ts',
  'luma-uni-1.ts',
  'luma-uni-1-max.ts',
  'kling-2-5.ts',
  'kling-2-6.ts',
  'kling-3-pro.ts',
  'kling-3-standard.ts',
  'kling-3-4k.ts',
  'kling-o3.ts',
  'happy-horse-1-1.ts',
  'happy-horse.ts',
  'seedance-1-5.ts',
  'seedance-2-standard.ts',
  'seedance-2-fast.ts',
  'seedance-2-byteplus.ts',
  'wan-2-5.ts',
  'wan-2-6.ts',
  'hailuo.ts',
  'ltx-2-fast.ts',
  'ltx-2.ts',
  'ltx-2-3-fast.ts',
  'ltx-2-3.ts',
  'nano-banana.ts',
  'nano-banana-pro.ts',
  'nano-banana-2.ts',
  'gpt-image-2.ts',
  'seedream.ts',
];

const facadeSource = readFileSync(facadePath, 'utf8');

test('Fal engine catalog public facade stays focused on materialization and lookup helpers', () => {
  assert.match(facadeSource, /from '\.\/fal-engines\/registry'/);
  assert.match(facadeSource, /from '\.\/fal-engines\/types'/);
  assert.match(facadeSource, /export type \{/);
  assert.match(facadeSource, /export function listFalEngines/);
  assert.match(facadeSource, /export function getFalEngineBySlug/);

  assert.doesNotMatch(facadeSource, /const RAW_FAL_ENGINE_REGISTRY/, 'raw engine data belongs in fal-engines modules');
  assert.doesNotMatch(facadeSource, /const SORA_2_ENGINE/, 'engine caps belong in fal-engines modules');
  assert.doesNotMatch(facadeSource, /SEEDANCE_2_ENDPOINTS/, 'launch constants belong in launch-config.ts');

  const lineCount = facadeSource.split('\n').length;
  assert.ok(lineCount <= 180, `falEngines.ts should stay a thin public facade, got ${lineCount} lines`);
});

test('Fal engine catalog data is split into provider-family modules', () => {
  moduleNames.forEach((moduleName) => {
    const modulePath = join(modulesDir, moduleName);
    assert.ok(existsSync(modulePath), `${moduleName} should exist under fal-engines`);
  });

  const registrySource = readFileSync(join(modulesDir, 'registry.ts'), 'utf8');
  [
    'PIKA_FAL_ENGINE_REGISTRY',
    'SORA_FAL_ENGINE_REGISTRY',
    'VEO_3_1_FAL_ENGINE_REGISTRY',
    'VEO_3_1_FAST_FAL_ENGINE_REGISTRY',
    'VEO_3_1_LITE_FAL_ENGINE_REGISTRY',
    'LUMA_RAY_3_2_FAL_ENGINE_REGISTRY',
    'LUMA_RAY_2_FAL_ENGINE_REGISTRY',
    'LUMA_RAY_2_FLASH_FAL_ENGINE_REGISTRY',
    'LUMA_RAY_3_2_FAL_ENGINE_REGISTRY',
    'LUMA_UNI_1_FAL_ENGINE_REGISTRY',
    'LUMA_UNI_1_MAX_FAL_ENGINE_REGISTRY',
    'KLING_2_5_FAL_ENGINE_REGISTRY',
    'KLING_2_6_FAL_ENGINE_REGISTRY',
    'KLING_3_PRO_FAL_ENGINE_REGISTRY',
    'KLING_3_STANDARD_FAL_ENGINE_REGISTRY',
    'KLING_3_4K_FAL_ENGINE_REGISTRY',
    'KLING_O3_FAL_ENGINE_REGISTRY',
    'HAPPY_HORSE_FAL_ENGINE_REGISTRY',
    'SEEDANCE_1_5_FAL_ENGINE_REGISTRY',
    'SEEDANCE_2_STANDARD_FAL_ENGINE_REGISTRY',
    'SEEDANCE_2_FAST_FAL_ENGINE_REGISTRY',
    'SEEDANCE_2_BYTEPLUS_FAL_ENGINE_REGISTRY',
    'WAN_2_5_FAL_ENGINE_REGISTRY',
    'WAN_2_6_FAL_ENGINE_REGISTRY',
    'HAILUO_FAL_ENGINE_REGISTRY',
    'LTX_2_3_FAST_FAL_ENGINE_REGISTRY',
    'LTX_2_3_FAL_ENGINE_REGISTRY',
    'LTX_2_FAST_FAL_ENGINE_REGISTRY',
    'LTX_2_FAL_ENGINE_REGISTRY',
    'NANO_BANANA_FAL_ENGINE_REGISTRY',
    'NANO_BANANA_PRO_FAL_ENGINE_REGISTRY',
    'NANO_BANANA_2_FAL_ENGINE_REGISTRY',
    'GPT_IMAGE_2_FAL_ENGINE_REGISTRY',
    'SEEDREAM_FAL_ENGINE_REGISTRY',
  ].forEach((exportName) => {
    assert.match(registrySource, new RegExp(`import \\{ ${exportName} \\}`));
    assert.match(registrySource, new RegExp(`\\.\\.\\.${exportName}`));
  });
});

test('Fal engine data modules avoid recreating a single giant registry file', () => {
  moduleNames.forEach((moduleName) => {
    const modulePath = join(modulesDir, moduleName);
    const lineCount = readFileSync(modulePath, 'utf8').split('\n').length;
    assert.ok(lineCount <= 500, `${moduleName} should stay below 500 lines, got ${lineCount}`);
  });
});
