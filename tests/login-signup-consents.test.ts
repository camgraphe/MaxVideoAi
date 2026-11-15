import assert from 'node:assert/strict';
import test from 'node:test';
import { submitPasswordSignupConsents } from '../frontend/app/(core)/login/_lib/login-signup-consents';

test('obfuscated duplicate signup never submits its synthetic id as a real consent owner', async () => {
  const submitted: string[] = [];
  const saved = await submitPasswordSignupConsents(
    { user: { id: 'synthetic-id', identities: [] }, session: null },
    async (id) => { submitted.push(id); }
  );
  assert.equal(saved, false);
  assert.deepEqual(submitted, []);
});

test('unconfirmed accounts defer consent until an authenticated session exists', async () => {
  const submitted: string[] = [];
  assert.equal(await submitPasswordSignupConsents(
    { user: { id: 'real-id', identities: [{ provider: 'email' }] }, session: null },
    async (id) => { submitted.push(id); }
  ), false);
  assert.deepEqual(submitted, []);
});

test('authenticated signup and responses without identities still require consent persistence', async () => {
  for (const data of [
    { user: { id: 'real-id', identities: [] }, session: { access_token: 'synthetic-token', user: { id: 'real-id' } } },
    { user: { id: 'real-id' }, session: { access_token: 'synthetic-token', user: { id: 'real-id' } } },
  ]) {
    await assert.rejects(
      submitPasswordSignupConsents(data, async () => { throw new Error('storage unavailable'); }),
      /storage unavailable/
    );
  }
});

test('missing signup user cannot write consent or report a newly created account', async () => {
  assert.equal(await submitPasswordSignupConsents(
    { user: null, session: null },
    async () => { assert.fail('no consent owner'); }
  ), false);
});


test('authenticated signup carries its token and rejects a mismatched session owner', async () => {
  const submitted: string[][] = [];
  const save = async (id: string, token: string) => { submitted.push([id, token]); };
  assert.equal(await submitPasswordSignupConsents({ user: { id: 'real-id' }, session: { access_token: 'synthetic-token', user: { id: 'real-id' } } }, save), true);
  assert.equal(await submitPasswordSignupConsents({ user: { id: 'other-id' }, session: { access_token: 'synthetic-token', user: { id: 'real-id' } } }, save), false);
  assert.deepEqual(submitted, [['real-id', 'synthetic-token']]);
});
