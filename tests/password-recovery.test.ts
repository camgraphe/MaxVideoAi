import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { parseRecoveryProof, safeRecoveryNext, verifyRecoveryProof, updateRecoveredPassword } from '../frontend/lib/password-recovery';

test('recovery never treats an existing session or arbitrary auth hash as proof', () => {
  assert.equal(parseRecoveryProof('', ''), null);
  assert.equal(parseRecoveryProof('?error=access_denied&code=stale', ''), null);
  assert.equal(parseRecoveryProof('', '#access_token=a&refresh_token=b&type=signup'), null);
  assert.deepEqual(parseRecoveryProof('?token_hash=one-time-proof', ''), { kind: 'tokenHash', value: 'one-time-proof' });
});

test('recovery continuations reject external URLs and auth loops', () => {
  for (const value of ['//evil.test', '/\\evil.test', '/auth/reset-password', '/login', '/api/private']) {
    assert.equal(safeRecoveryNext(value), '/app');
  }
  assert.equal(safeRecoveryNext('/app?tab=library'), '/app?tab=library');
});

function fakeAuth(overrides: Record<string, unknown> = {}) {
  return {
    exchangeCodeForSession: async () => ({ data: { session: { user: { id: 'user-a' } } }, error: null }),
    verifyOtp: async () => ({ data: { session: { user: { id: 'user-a' } } }, error: null }),
    setSession: async () => ({ data: { session: { user: { id: 'user-a' } } }, error: null }),
    getUser: async () => ({ data: { user: { id: 'user-a' } }, error: null }),
    updateUser: async () => ({ data: { user: { id: 'user-a' } }, error: null }),
    ...overrides,
  } as any;
}

test('recovery verifies the token then confirms the same user with the auth server', async () => {
  let options: unknown;
  const auth = fakeAuth({ verifyOtp: async (input: unknown) => {
    options = input;
    return { data: { session: { user: { id: 'user-a' } } }, error: null };
  } });
  assert.equal(await verifyRecoveryProof(auth, { kind: 'tokenHash', value: 'proof' }), 'user-a');
  assert.deepEqual(options, { token_hash: 'proof', type: 'recovery' });
  assert.equal(await verifyRecoveryProof(fakeAuth({ getUser: async () => ({ data: { user: { id: 'other' } }, error: null }) }), { kind: 'code', value: 'proof' }), null);
});

test('expired proof never falls back to an already signed-in account', async () => {
  const auth = fakeAuth({ exchangeCodeForSession: async () => ({ data: { session: null }, error: { message: 'expired' } }) });
  assert.equal(await verifyRecoveryProof(auth, { kind: 'code', value: 'expired' }), null);
});

test('a changed account or invalid password cannot be updated', async () => {
  let updates = 0;
  const auth = fakeAuth({ updateUser: async () => { updates++; return { error: null }; } });
  assert.equal(await updateRecoveredPassword(auth, 'other', 'new-password', 'new-password'), 'invalid');
  assert.equal(await updateRecoveredPassword(auth, 'user-a', 'short', 'short'), 'tooShort');
  assert.equal(await updateRecoveredPassword(auth, 'user-a', 'new-password', 'different'), 'mismatch');
  assert.equal(updates, 0);
});

test('successful update and provider failures produce explicit results', async () => {
  assert.equal(await updateRecoveredPassword(fakeAuth(), 'user-a', 'new-password', 'new-password'), 'saved');
  for (const [code, expected] of [['weak_password', 'weak'], ['same_password', 'same'], ['reauthentication_needed', 'invalid']]) {
    assert.equal(await updateRecoveredPassword(fakeAuth({ updateUser: async () => ({ error: { code } }) }), 'user-a', 'new-password', 'new-password'), expected);
  }
});

test('recovery callback preserves proof and locale without consuming the link', async () => {
  const { GET } = await import('../frontend/app/auth/callback/route');
  for (const locale of ['en', 'fr', 'es']) {
    const response = await GET(new NextRequest(`https://maxvideoai.com/auth/callback?flow=recovery&code=fixture&lang=${locale}&next=%2Fapp%3Ftab%3Dlibrary`));
    const location = new URL(response.headers.get('location')!);
    assert.equal(location.pathname, '/auth/reset-password');
    assert.equal(location.searchParams.get('code'), 'fixture');
    assert.equal(location.searchParams.get('lang'), locale);
    assert.equal(location.searchParams.get('next'), '/app?tab=library');
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
    assert.match(response.headers.get('cache-control')!, /no-store/);
  }
  const response = await GET(new NextRequest('https://maxvideoai.com/auth/callback?flow=recovery&error=expired&next=https://external.example'));
  const location = new URL(response.headers.get('location')!);
  assert.equal(location.pathname, '/auth/reset-password');
  assert.equal(location.searchParams.get('next'), '/app');
  assert.equal(location.searchParams.get('error'), 'expired');
});

test('recovery pages exclude analytics even with token-bearing query parameters', async () => {
  const { getAnalyticsRouteContext } = await import('../frontend/lib/analytics-route');
  assert.equal(getAnalyticsRouteContext('/auth/reset-password?token_hash=fixture').excludedFromGa4, true);
});

test('branded email links preserve locale and safe continuations across browsers', async () => {
  const { recoveryEmailDestination } = await import('../frontend/lib/password-recovery');
  assert.deepEqual(recoveryEmailDestination('https://maxvideoai.com/auth/callback?lang=fr&next=%2Fapp%3Ftab%3Dlibrary'), { locale: 'fr', next: '/app?tab=library' });
  assert.deepEqual(recoveryEmailDestination('https://evil.test/auth/callback?lang=es'), { next: '/app' });
  assert.deepEqual(recoveryEmailDestination('https://maxvideoai.com/auth/callback?lang=es&next=https://evil.test'), { locale: 'es', next: '/app' });
  assert.deepEqual(recoveryEmailDestination(undefined), { next: '/app' });
});
