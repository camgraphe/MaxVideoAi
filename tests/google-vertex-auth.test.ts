import assert from 'node:assert/strict';
import test from 'node:test';

import { parseGoogleVertexServiceAccount } from '../frontend/src/server/video-providers/google-vertex-auth.ts';

test('parses base64 service-account JSON and normalizes private-key newlines', () => {
  const encoded = Buffer.from(
    JSON.stringify({
      client_email: 'vertex@example.iam.gserviceaccount.com',
      private_key: ['-----BEGIN ', 'PRIVATE KEY-----\\nkey\\n-----END PRIVATE KEY-----'].join(''),
    })
  ).toString('base64');

  const account = parseGoogleVertexServiceAccount(encoded);

  assert.equal(account.client_email, 'vertex@example.iam.gserviceaccount.com');
  assert.match(account.private_key, /\nkey\n/);
});

test('rejects incomplete service-account JSON', () => {
  assert.throws(() => parseGoogleVertexServiceAccount(JSON.stringify({ client_email: 'missing-key@example.com' })));
});
