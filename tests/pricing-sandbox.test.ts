import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { buildPricingSandboxEnvironment } from '../frontend/scripts/_lib/pricing-sandbox.ts';

test('sandbox binds the advertised localhost origin so localized rewrites stay internal', () => {
  const runner = readFileSync('frontend/scripts/run-pricing-sandbox.ts', 'utf8');
  assert.match(runner, /'dev', '-p', String\(port\), '-H', 'localhost'/);
});

test('pricing sandbox cannot inherit remote credentials or remote database configuration', () => {
  const environment = buildPricingSandboxEnvironment({
    parent: { PATH: '/bin', DATABASE_URL: 'postgresql://secret@production.invalid/live',
      STRIPE_SECRET_KEY: 'production', FAL_KEY: 'production', RESEND_API_KEY: 'production',
      S3_SECRET_ACCESS_KEY: 'production', NEXT_PUBLIC_API_BASE: 'https://api.production.invalid' },
    fileVariables: { BYTEPLUS_ARK_API_KEY: 'production', SUPABASE_SERVICE_ROLE_KEY: 'production',
      NEXT_PUBLIC_SUPABASE_URL: 'https://production.invalid', UNKNOWN_FUTURE_SECRET: 'production' },
    databaseUrl: 'postgresql://postgres@localhost/postgres?host=%2Ftmp%2Fpricing-sandbox%2Fsocket', port: 3106,
  });
  assert.equal(environment.DATABASE_URL, 'postgresql://postgres@localhost/postgres?host=%2Ftmp%2Fpricing-sandbox%2Fsocket');
  assert.equal(environment.STRIPE_SECRET_KEY, '');
  assert.equal(environment.BYTEPLUS_ARK_API_KEY, '');
  assert.equal(environment.SUPABASE_SERVICE_ROLE_KEY, '');
  assert.equal(environment.UNKNOWN_FUTURE_SECRET, '');
  assert.equal(environment.NEXT_PUBLIC_API_BASE, 'http://localhost:3106');
  assert.equal(environment.NEXT_PUBLIC_SUPABASE_URL, 'http://127.0.0.1:54321');
  assert.equal(environment.LOCAL_ADMIN_BYPASS, '1');
  assert.equal(environment.SEEDANCE_2_PROVIDER, 'byteplus_modelark');
  assert.equal(environment.SEEDANCE_FAST_PROVIDER, 'byteplus_modelark');
  assert.equal(environment.SEEDANCE_2_5_BYTEPLUS_ENABLED, 'false');
  assert.ok(!Object.values(environment).includes('production'));
});

test('sandbox rejects remote database hosts and ambiguous socket overrides', () => {
  for (const databaseUrl of [
    'postgresql://postgres@production.invalid/postgres',
    'postgresql://postgres@localhost/postgres?host=production.invalid',
    'postgresql://postgres@production.invalid/postgres?host=%2Ftmp%2Fsocket',
    'postgresql://postgres@localhost/postgres?host=%2Ftmp%2Fsocket&host=production.invalid',
  ]) assert.throws(() => buildPricingSandboxEnvironment({ parent: {}, fileVariables: {}, databaseUrl, port: 3106 }), /local socket/i);
});
