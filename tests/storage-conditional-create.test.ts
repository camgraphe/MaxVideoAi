import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildFileBufferToKeyPutInput,
  createFileBufferUploadError,
  StorageUploadError,
} from '../frontend/server/storage';

test('storage upload keeps overwrite-compatible defaults and opts into conditional create explicitly', () => {
  const base = { key: 'files/example.mp4', data: Buffer.from('video'), mime: 'video/mp4', cacheControl: 'immutable', acl: null };
  const normal = buildFileBufferToKeyPutInput(base);
  assert.equal(normal.IfNoneMatch, undefined);
  const conditional = buildFileBufferToKeyPutInput({ ...base, conditionalCreate: true });
  assert.equal(conditional.IfNoneMatch, '*');
  assert.equal(conditional.Key, base.key);
  assert.deepEqual(conditional.Body, base.data);
});

test('conditional-create precondition failures remain recognizable to safe publishing callers', () => {
  const error = createFileBufferUploadError(
    { key: 'files/example.mp4', conditionalCreate: true },
    { name: 'PreconditionFailed', $metadata: { httpStatusCode: 412 } }
  );
  assert.equal(error instanceof StorageUploadError, true);
  assert.equal(error.context.code, 'precondition-conflict');

  const ordinary = createFileBufferUploadError(
    { key: 'files/example.mp4', conditionalCreate: false },
    { name: 'AccessDenied', $metadata: { httpStatusCode: 403 } }
  );
  assert.equal(ordinary.context.code, undefined);
});
