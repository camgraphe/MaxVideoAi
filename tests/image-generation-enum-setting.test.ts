import assert from 'node:assert/strict';
import test from 'node:test';

import * as normalization from '../frontend/src/server/images/image-generation-normalization.ts';
import { listFalEngines } from '../frontend/src/config/falEngines';
import { ImageGenerationExecutionError } from '../frontend/src/server/images/image-generation-error';

const { resolveImageEnumSetting } = normalization;

test('image enum settings canonicalize supported strings and flag only non-empty invalid selections', () => {
  assert.deepEqual(resolveImageEnumSetting(['auto', 'transparent'], ' TRANSPARENT '), {
    allowed: ['auto', 'transparent'],
    invalid: false,
    value: 'transparent',
  });
  assert.deepEqual(resolveImageEnumSetting(['auto', 'transparent'], 'unsupported'), {
    allowed: ['auto', 'transparent'],
    invalid: true,
    value: null,
  });
  assert.deepEqual(resolveImageEnumSetting(['auto', 'transparent'], ''), {
    allowed: ['auto', 'transparent'],
    invalid: false,
    value: null,
  });
  assert.deepEqual(resolveImageEnumSetting(['auto', 'transparent'], null), {
    allowed: ['auto', 'transparent'],
    invalid: false,
    value: null,
  });
});

test('image output settings canonicalize schema enums without inserting caller-owned defaults', () => {
  const resolve = normalization.resolveImageGenerationOutputSettings;
  assert.equal(typeof resolve, 'function');
  const engine = listFalEngines().find(entry => entry.id === 'seedream-5-5')!.engine;
  const before = JSON.stringify(engine);
  assert.deepEqual(resolve({ engine, mode: 'i2i', body: { outputFormat: ' PNG ', background: ' TRANSPARENT ' } }), {
    outputFormat: 'png', quality: null, background: 'transparent', style: null,
  });
  assert.deepEqual(resolve({ engine, mode: 't2i', body: {} }), {
    outputFormat: null, quality: null, background: null, style: null,
  });
  assert.equal(JSON.stringify(engine), before);
  const luma = listFalEngines().find(entry => entry.id === 'luma-uni-1')!.engine;
  assert.deepEqual(resolve({ engine: luma, mode: 't2i', body: { outputFormat: ' JPEG ', style: ' MANGA ' } }), {
    outputFormat: 'jpeg', quality: null, background: null, style: 'manga',
  });
});

test('image output validation preserves typed failure identity and rejects transparent JPEG before reservation', () => {
  const resolve = normalization.resolveImageGenerationOutputSettings;
  assert.equal(typeof resolve, 'function');
  const engine = listFalEngines().find(entry => entry.id === 'seedream-5-5')!.engine;
  const extras = { engineId: engine.id, engineLabel: engine.label };
  for (const [body, code, allowed] of [
    [{ outputFormat: 'invalid', quality: 'invalid' }, 'output_format_invalid', ['jpeg', 'png']],
    [{ quality: 'invalid' }, 'quality_invalid', []],
    [{ background: 'invalid' }, 'background_invalid', ['auto', 'opaque', 'transparent']],
    [{ style: 'invalid' }, 'style_invalid', []],
    [{ outputFormat: 'jpeg', background: 'transparent' }, 'output_format_invalid', ['png']],
  ] as const) {
    assert.throws(() => resolve({ engine, mode: 'i2i', body, extras }), (error: unknown) => {
      assert.ok(error instanceof ImageGenerationExecutionError);
      assert.equal(error.mode, 'i2i');
      assert.equal(error.code, code);
      assert.equal(error.status, 400);
      assert.deepEqual(error.extras, extras);
      assert.deepEqual(error.detail, { allowed });
      return true;
    });
  }
  const pro = listFalEngines().find(entry => entry.id === 'seedream-5-0-pro')!.engine;
  assert.deepEqual(resolve({ engine: pro, mode: 'i2i', body: { outputFormat: 'jpeg' } }), {
    outputFormat: 'jpeg', quality: null, background: null, style: null,
  });
});
