import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { validateExtraInputValues } from '../frontend/app/api/generate/_lib/extra-input-values';

const root = process.cwd();
const routePath = join(root, 'frontend/app/api/generate/route.ts');
const helperPath = join(root, 'frontend/app/api/generate/_lib/extra-input-values.ts');

const routeSource = readFileSync(routePath, 'utf8');
const helperSource = readFileSync(helperPath, 'utf8');

const engineWithExtraFields = {
  inputSchema: {
    required: [
      { id: 'prompt', type: 'text', label: 'Prompt' },
      { id: 'style_strength', type: 'number', label: 'Style strength', requiredInModes: ['t2v'] },
    ],
    optional: [
      { id: 'camera_style', type: 'enum', label: 'Camera style', values: ['cinematic', 'handheld'] },
      { id: 'director_note', type: 'text', label: 'Director note' },
      { id: 'aspect_ratio', type: 'enum', label: 'Aspect ratio', values: ['16:9', '9:16'] },
    ],
  },
} as const;

test('generate route delegates extra input validation', () => {
  assert.ok(existsSync(helperPath), 'extra input validation should live in the generate route _lib folder');
  assert.match(routeSource, /from '\.\/_lib\/extra-input-values'/);
  assert.doesNotMatch(routeSource, /function normalizeFieldId\(/, 'field id normalization belongs in extra-input-values.ts');
  assert.doesNotMatch(routeSource, /STANDARD_INPUT_FIELD_IDS/, 'standard input exclusion belongs in extra-input-values.ts');
  assert.doesNotMatch(routeSource, /applicableSchemaFields/, 'extra schema field selection belongs in extra-input-values.ts');
  assert.doesNotMatch(routeSource, /applicableFieldMap/, 'extra schema field map belongs in extra-input-values.ts');

  const lineCount = routeSource.split('\n').length;
  assert.ok(lineCount <= 2400, `/api/generate route should stay below 2400 lines after extra input extraction, got ${lineCount}`);
});

test('extra input helper exposes the route contract', () => {
  assert.match(helperSource, /export function validateExtraInputValues/, 'validateExtraInputValues should be exported');
  assert.match(helperSource, /const STANDARD_INPUT_FIELD_IDS/, 'standard field exclusions should stay with extra input validation');
  assert.match(helperSource, /function normalizeFieldId/, 'field id normalization should stay with extra input validation');
});

test('extra input helper validates and normalizes schema-driven values', () => {
  const result = validateExtraInputValues({
    engine: engineWithExtraFields,
    mode: 't2v',
    rawExtraInputValues: {
      style_strength: '0.72',
      camera_style: 'cinematic',
      director_note: '  close camera  ',
    },
  });

  assert.deepEqual(result, {
    ok: true,
    values: {
      style_strength: 0.72,
      camera_style: 'cinematic',
      director_note: 'close camera',
    },
  });
});

test('extra input helper rejects unsupported, invalid, and missing fields', () => {
  assert.deepEqual(
    validateExtraInputValues({
      engine: engineWithExtraFields,
      mode: 't2v',
      rawExtraInputValues: { unknown: 'value', style_strength: '0.5' },
    }),
    {
      ok: false,
      status: 400,
      body: {
        ok: false,
        error: 'INVALID_EXTRA_FIELD',
        field: 'unknown',
        message: 'Unsupported input field "unknown" for this mode.',
      },
    }
  );

  assert.deepEqual(
    validateExtraInputValues({
      engine: engineWithExtraFields,
      mode: 't2v',
      rawExtraInputValues: { style_strength: 'nope' },
    }),
    {
      ok: false,
      status: 400,
      body: {
        ok: false,
        error: 'INVALID_EXTRA_FIELD',
        field: 'style_strength',
        message: 'style_strength must be a number.',
      },
    }
  );

  assert.deepEqual(
    validateExtraInputValues({
      engine: engineWithExtraFields,
      mode: 't2v',
      rawExtraInputValues: { style_strength: '0.5', camera_style: 'wrong' },
    }),
    {
      ok: false,
      status: 400,
      body: {
        ok: false,
        error: 'INVALID_EXTRA_FIELD',
        field: 'camera_style',
        message: 'camera_style must be one of cinematic, handheld.',
      },
    }
  );

  assert.deepEqual(
    validateExtraInputValues({
      engine: engineWithExtraFields,
      mode: 't2v',
      rawExtraInputValues: null,
    }),
    {
      ok: false,
      status: 400,
      body: {
        ok: false,
        error: 'MISSING_EXTRA_FIELD',
        field: 'style_strength',
        message: 'style_strength is required for this mode.',
      },
    }
  );
});

test('extra input helper excludes standard route fields from the extra field contract', () => {
  const result = validateExtraInputValues({
    engine: engineWithExtraFields,
    mode: 't2v',
    rawExtraInputValues: {
      style_strength: 0.5,
      aspect_ratio: '16:9',
    },
  });

  assert.deepEqual(result, {
    ok: false,
    status: 400,
    body: {
      ok: false,
      error: 'INVALID_EXTRA_FIELD',
      field: 'aspect_ratio',
      message: 'Unsupported input field "aspect_ratio" for this mode.',
    },
  });
});
