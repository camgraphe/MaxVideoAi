import assert from 'node:assert/strict';
import test from 'node:test';
import { createStudioPreviewEnvironment, parseStudioPreviewPort } from '../scripts/_lib/studio-preview-environment.mjs';

test('Studio preview reserves its own local port and cannot occupy app port with auth fixture', () => {
  assert.equal(parseStudioPreviewPort([]), 3032);
  assert.equal(parseStudioPreviewPort(['--port=3040']), 3040);
  for (const args of [['--port=3026'], ['--port=3025'], ['--port=80'], ['--port=65534'], ['--port=NaN'], ['--host=remote'], ['--port=3040', '--port=3041']]) {
    assert.throws(() => parseStudioPreviewPort(args));
  }
});

test('Studio preview cannot inherit remote databases, auth or paid-service credentials', () => {
  const environment = createStudioPreviewEnvironment({
    port: 3032,
    executable: '/local/node22/bin/node',
    inherited: {
      PATH: '/usr/bin', HOME: '/local/user', TMPDIR: '/local/tmp',
      DATABASE_URL: 'postgres://forbidden.invalid/db',
      SUPABASE_SERVICE_ROLE_KEY: 'forbidden-service-key',
      NEXT_PUBLIC_SUPABASE_URL: 'https://forbidden.invalid',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'forbidden-anon-key',
      FAL_KEY: 'forbidden-provider-key', STRIPE_SECRET_KEY: 'forbidden-payment-key',
      AWS_SECRET_ACCESS_KEY: 'forbidden-storage-key', NODE_OPTIONS: '--require=/forbidden.js',
    },
  });
  assert.equal(environment.NEXT_PUBLIC_SUPABASE_URL, 'http://127.0.0.1:3033');
  assert.equal(environment.NEXT_PUBLIC_SITE_URL, 'http://127.0.0.1:3032');
  assert.equal(environment.PATH, '/local/node22/bin:/usr/bin');
  assert.equal(environment.HOME, '/local/user');
  assert.equal(environment.NEXT_PUBLIC_VISITOR_WORKSPACE_ACCESS, 'true');
  assert.equal(JSON.stringify(environment).includes('forbidden'), false);
  for (const key of ['DATABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'FAL_KEY', 'STRIPE_SECRET_KEY', 'AWS_SECRET_ACCESS_KEY', 'NODE_OPTIONS']) {
    assert.equal(Object.hasOwn(environment, key), false);
  }
});
