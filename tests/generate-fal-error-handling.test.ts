import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { FalGenerationError } from '../frontend/src/lib/fal';
import {
  condenseFalErrorMessage,
  extractFalProviderMessage,
  FalTimeoutError,
  shouldDeferFalError,
  withFalTimeout,
} from '../frontend/app/api/generate/_lib/fal-error-handling';

const root = process.cwd();
const routePath = join(root, 'frontend/app/api/generate/route.ts');
const helperPath = join(root, 'frontend/app/api/generate/_lib/fal-error-handling.ts');

const routeSource = readFileSync(routePath, 'utf8');
const helperSource = readFileSync(helperPath, 'utf8');

test('generate route delegates Fal error handling helpers', () => {
  assert.ok(existsSync(helperPath), 'Fal error helpers should live in the generate route _lib folder');
  assert.match(routeSource, /from '\.\/_lib\/fal-error-handling'/);

  for (const implementationName of [
    'normalizeFalErrorValue',
    'extractFalProviderMessage',
    'condenseFalErrorMessage',
    'isConstraintDetail',
    'isSafetyMessage',
    'isConstraintMessage',
    'shouldDeferFalError',
    'withFalTimeout',
  ]) {
    assert.doesNotMatch(
      routeSource,
      new RegExp(`function ${implementationName}\\(`),
      `${implementationName} belongs in fal-error-handling.ts`
    );
  }

  assert.doesNotMatch(routeSource, /class FalTimeoutError/, 'Fal timeout error belongs in fal-error-handling.ts');
  assert.doesNotMatch(routeSource, /FAL_ERROR_FIELDS/, 'Fal provider error field mapping belongs in fal-error-handling.ts');
  assert.doesNotMatch(routeSource, /CONSTRAINT_ERROR_CODES/, 'constraint code mapping belongs in fal-error-handling.ts');
  assert.doesNotMatch(routeSource, /TRANSIENT_FAL_STATUS_CODES/, 'transient status mapping belongs in fal-error-handling.ts');

  const lineCount = routeSource.split('\n').length;
  assert.ok(lineCount <= 3000, `/api/generate route should stay below 3000 lines after error helper extraction, got ${lineCount}`);
});

test('Fal error helper module exposes the route contract', () => {
  for (const exportName of [
    'withFalTimeout',
    'extractFalProviderMessage',
    'condenseFalErrorMessage',
    'shouldDeferFalError',
  ]) {
    assert.match(
      helperSource,
      new RegExp(`export function ${exportName}`),
      `${exportName} should be exported by fal-error-handling.ts`
    );
  }

  assert.match(helperSource, /export class FalTimeoutError/, 'FalTimeoutError should be exported by fal-error-handling.ts');
  assert.match(helperSource, /const FAL_ERROR_FIELDS/, 'provider message key mapping should live with extraction');
  assert.match(helperSource, /const TRANSIENT_FAL_STATUS_CODES/, 'transient Fal status mapping should live with deferral logic');
  assert.match(helperSource, /const CONSTRAINT_ERROR_CODES/, 'constraint code mapping should live with deferral logic');
});

test('Fal provider message extraction and deferral behavior stays intact', async () => {
  assert.equal(
    extractFalProviderMessage({ response: { errors: [{ detail: 'Provider is still processing the request' }] } }),
    'Provider is still processing the request'
  );
  assert.equal(condenseFalErrorMessage('  one\n\n two\tthree  '), 'one two three');
  assert.equal(condenseFalErrorMessage('x'.repeat(450)), `${'x'.repeat(400)}...`);

  const transientError = new FalGenerationError('Fal request failed', {
    status: 500,
    providerJobId: 'fal_job_123',
  });
  assert.equal(
    shouldDeferFalError({
      error: transientError,
      status: 500,
      providerMessage: 'still processing',
      providerJobId: 'fal_job_123',
    }),
    true
  );

  const constraintError = new FalGenerationError('Fal request failed', {
    status: 422,
    body: { code: 'invalid_input' },
    providerJobId: 'fal_job_123',
  });
  assert.equal(
    shouldDeferFalError({
      error: constraintError,
      status: 422,
      detail: { code: 'invalid_input' },
      providerMessage: 'invalid input',
      providerJobId: 'fal_job_123',
    }),
    false
  );

  await assert.rejects(
    () => withFalTimeout(new Promise(() => undefined), 1),
    FalTimeoutError
  );
});
