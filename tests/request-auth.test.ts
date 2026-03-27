import test from 'node:test';
import assert from 'node:assert/strict';
import { readBearerAccessToken } from '../frontend/src/lib/request-auth';

test('readBearerAccessToken extracts a bearer token', () => {
  const token = readBearerAccessToken(
    new Headers({
      authorization: 'Bearer test-token-123',
    })
  );

  assert.equal(token, 'test-token-123');
});

test('readBearerAccessToken rejects a raw authorization token', () => {
  const token = readBearerAccessToken(
    new Headers({
      authorization: 'raw-token-456',
    })
  );

  assert.equal(token, null);
});

test('readBearerAccessToken rejects a non-bearer authorization scheme', () => {
  const token = readBearerAccessToken(
    new Headers({
      authorization: 'Basic abc123',
    })
  );

  assert.equal(token, null);
});

test('readBearerAccessToken returns null when the header is missing', () => {
  const token = readBearerAccessToken(new Headers());

  assert.equal(token, null);
});
