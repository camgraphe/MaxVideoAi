import assert from 'node:assert/strict';
import test from 'node:test';
import type { User } from '@supabase/supabase-js';
import { updateAccountName, validateAccountName } from '../frontend/app/(core)/settings/_lib/account-preferences';

test('account name validation trims values and enforces the 1–80 character boundary', () => {
  assert.deepEqual(validateAccountName('   '), { name: '', error: 'required' });
  assert.deepEqual(validateAccountName(`  ${'a'.repeat(80)}  `), { name: 'a'.repeat(80), error: null });
  assert.deepEqual(validateAccountName('a'.repeat(81)), { name: 'a'.repeat(81), error: 'tooLong' });
});

test('account update patches only owned keys so concurrent unrelated metadata is preserved', async () => {
  const user = { id: 'user-1', user_metadata: { plan: 'pro', name: 'Old', full_name: 'Old' } } as unknown as User;
  let submitted: Record<string, unknown> | undefined;
  const returned = { ...user, user_metadata: { ...user.user_metadata, name: 'New', full_name: 'New' } } as User;
  const result = await updateAccountName({ auth: { getUser: async () => ({ data: { user }, error: null }), updateUser: async ({ data }) => { submitted = data; return { data: { user: returned }, error: null }; } } }, user.id, 'New');

  assert.deepEqual(submitted, { name: 'New', full_name: 'New' });
  assert.equal(result, returned);
});

test('account update surfaces provider errors and missing completion users', async () => {
  const getUser = async () => ({ data: { user: null }, error: null });
  await assert.rejects(() => updateAccountName({ auth: { getUser, updateUser: async () => ({ data: { user: null }, error: { message: 'Denied' } }) } }, 'user-1', 'Name'), /Denied/);
  await assert.rejects(() => updateAccountName({ auth: { getUser, updateUser: async () => ({ data: { user: null }, error: null }) } }, 'user-1', 'Name'), /did not return a user/);
});

test('account update rejects a completion returned for another identity', async () => {
  const otherUser = { id: 'user-2', user_metadata: {} } as unknown as User;
  await assert.rejects(
    () => updateAccountName({ auth: { getUser: async () => ({ data: { user: otherUser }, error: null }), updateUser: async () => ({ data: { user: otherUser }, error: null }) } }, 'user-1', 'Name'),
    /Account changed/
  );
});
