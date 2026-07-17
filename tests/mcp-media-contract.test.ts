import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const mediaTypesPath = 'frontend/src/server/agent-api/media-types.ts';
const referenceTypesPath = 'frontend/src/server/agent-api/reference-types.ts';
const errorsPath = 'frontend/src/server/agent-api/errors.ts';

function source(path: string): string {
  assert.equal(existsSync(path), true, `${path} must exist`);
  return readFileSync(path, 'utf8');
}

function typeBody(moduleSource: string, typeName: string): string {
  const body = moduleSource.match(
    new RegExp(`export type ${typeName}\\s*=\\s*\\{([\\s\\S]*?)\\n\\};`),
  )?.[1];
  assert.ok(body, `${typeName} must be an exported exact object type`);
  return body;
}

function fieldNames(body: string): string[] {
  return Array.from(body.matchAll(/^\s*([A-Za-z][A-Za-z0-9]*):/gmu), (match) => match[1]!);
}

test('R1 owns separate public media and internal reference type modules', () => {
  assert.equal(existsSync(mediaTypesPath), true, `${mediaTypesPath} must exist`);
  assert.equal(existsSync(referenceTypesPath), true, `${referenceTypesPath} must exist`);
});

test('AgentMediaItem is the exact image-only public DTO with one controlled URL field', () => {
  const moduleSource = source(mediaTypesPath);
  const body = typeBody(moduleSource, 'AgentMediaItem');
  assert.deepEqual(fieldNames(body), [
    'assetId',
    'kind',
    'label',
    'width',
    'height',
    'mimeType',
    'previewUrl',
    'source',
    'createdAt',
  ]);
  assert.match(body, /assetId:\s*string;/u);
  assert.match(body, /kind:\s*'image';/u);
  assert.match(body, /label:\s*string\s*\|\s*null;/u);
  assert.match(body, /width:\s*number\s*\|\s*null;/u);
  assert.match(body, /height:\s*number\s*\|\s*null;/u);
  assert.match(body, /mimeType:\s*string\s*\|\s*null;/u);
  assert.match(body, /previewUrl:\s*string\s*\|\s*null;/u);
  assert.match(body, /source:\s*'upload'\s*\|\s*'generated'\s*\|\s*'imported';/u);
  assert.match(body, /createdAt:\s*string;/u);
  assert.deepEqual(
    fieldNames(body).filter((field) => field.toLowerCase().endsWith('url')),
    ['previewUrl'],
  );
  assert.doesNotMatch(moduleSource, /storageUrl|originUrl|sourceUrl|providerUrl|credentials/iu);
});

test('ResolvedReference is an internal storage DTO using the canonical role owner', () => {
  const moduleSource = source(referenceTypesPath);
  const body = typeBody(moduleSource, 'ResolvedReference');
  assert.deepEqual(fieldNames(body), [
    'assetId',
    'role',
    'storageUrl',
    'width',
    'height',
    'mimeType',
  ]);
  assert.match(
    moduleSource,
    /import type \{ CanonicalGenerationReferenceRole \} from ['"]\.\/generation-types['"];/u,
  );
  assert.match(body, /assetId:\s*string;/u);
  assert.match(body, /role:\s*CanonicalGenerationReferenceRole;/u);
  assert.match(body, /storageUrl:\s*string;/u);
  assert.match(body, /width:\s*number\s*\|\s*null;/u);
  assert.match(body, /height:\s*number\s*\|\s*null;/u);
  assert.match(body, /mimeType:\s*string;/u);
  assert.doesNotMatch(body, /previewUrl|resourceUrl|originUrl|providerUrl/iu);
});

test('reference and upload failures have one stable AgentApiError code owner', async () => {
  const expected = [
    'REFERENCE_REQUIRED',
    'REFERENCE_INVALID',
    'REFERENCE_NOT_FOUND',
    'REFERENCE_FORBIDDEN',
    'UPLOAD_EXPIRED',
    'UPLOAD_ALREADY_USED',
  ] as const;
  const errorsSource = source(errorsPath);
  assert.match(errorsSource, /export const REFERENCE_ERROR_CODES\s*=/u);
  assert.match(errorsSource, /export type ReferenceErrorCode\s*=/u);
  assert.match(errorsSource, /export type AgentApiErrorCode\s*=[\s\S]*?ReferenceErrorCode/u);
  for (const code of expected) {
    assert.equal(
      errorsSource.match(new RegExp(`'${code}'`, 'gu'))?.length,
      1,
      `${code} must be authored once in the central error owner`,
    );
  }

  const errors = await import('../frontend/src/server/agent-api/errors') as Record<string, unknown>;
  assert.deepEqual(errors.REFERENCE_ERROR_CODES, expected);
  const AgentError = errors.AgentApiError as new (
    code: string,
    message: string,
  ) => Error & { code: string };
  const toFailure = errors.toAgentApiFailure as (
    error: Error & { code: string },
  ) => { error: { code: string } };
  for (const code of expected) {
    const failure = toFailure(new AgentError(code, 'Safe reference error.'));
    assert.equal(failure.error.code, code);
  }
});
