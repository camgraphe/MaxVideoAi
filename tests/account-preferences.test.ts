import assert from 'node:assert/strict';
import test from 'node:test';
import type { User } from '@supabase/supabase-js';
import { updateAccountNameWithToken, validateAccountName } from '../frontend/app/(core)/settings/_lib/account-preferences';

test('account name validation trims values and enforces the 1–80 character boundary', () => {
  assert.deepEqual(validateAccountName('   '), { name: '', error: 'required' });
  assert.deepEqual(validateAccountName(`  ${'a'.repeat(80)}  `), { name: 'a'.repeat(80), error: null });
  assert.deepEqual(validateAccountName('a'.repeat(81)), { name: 'a'.repeat(81), error: 'tooLong' });
});

test('account update binds a minimal metadata patch to the captured bearer token', async () => {
  const user = { id: 'user-1', user_metadata: { plan: 'pro', name: 'New', full_name: 'New' } } as unknown as User;
  let request: { input: string | URL | Request; init?: RequestInit } | undefined;
  const result = await updateAccountNameWithToken({
    accessToken: 'captured-token', expectedUserId: user.id, name: 'New',
    supabaseUrl: 'https://project.supabase.co/', anonKey: 'public-anon',
    fetcher: async (input, init) => { request = { input, init }; return Response.json(user); },
  });

  assert.equal(request?.input, 'https://project.supabase.co/auth/v1/user');
  assert.equal(new Headers(request?.init?.headers).get('authorization'), 'Bearer captured-token');
  assert.equal(new Headers(request?.init?.headers).get('apikey'), 'public-anon');
  assert.deepEqual(JSON.parse(String(request?.init?.body)), { data: { name: 'New', full_name: 'New' } });
  assert.deepEqual(result, user);
});

test('account update surfaces API errors, missing users, and mismatched identities', async () => {
  const common = { accessToken: 'token', expectedUserId: 'user-1', name: 'Name', supabaseUrl: 'https://project.supabase.co', anonKey: 'anon' };
  await assert.rejects(() => updateAccountNameWithToken({ ...common, fetcher: async () => Response.json({ message: 'Denied' }, { status: 403 }) }), /Denied/);
  await assert.rejects(() => updateAccountNameWithToken({ ...common, fetcher: async () => Response.json({}) }), /did not return a user/);
  await assert.rejects(() => updateAccountNameWithToken({ ...common, fetcher: async () => Response.json({ id: 'user-2' }) }), /Account changed/);
});
