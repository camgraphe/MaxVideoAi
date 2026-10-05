import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from '../frontend/node_modules/next/server';
import { handleStudioMarketingEntry } from '../frontend/app/api/studio/marketing-entry/_lib/handle-studio-marketing-entry';

const request = () => new NextRequest('http://localhost/api/studio/marketing-entry?starter=product-ad');

test('Studio marketing entry sends admins to the allowlisted starter and members back to the app', async () => {
  const admin = await handleStudioMarketingEntry(request(), async () => ({ ok: true, userId: 'admin-user' }));
  const member = await handleStudioMarketingEntry(request(), async () => ({ ok: false, status: 403, error: 'FORBIDDEN' }));

  assert.equal(admin.status, 307);
  assert.equal(admin.headers.get('location'), '/app/studio?starter=product-ad');
  assert.equal(member.status, 307);
  assert.equal(member.headers.get('location'), '/app');
  assert.equal(admin.headers.get('cache-control'), 'private, no-store');
});

test('Studio marketing entry opens the anonymous demonstration and hides a disabled Studio', async () => {
  const anonymous = await handleStudioMarketingEntry(request(), async () => ({ ok: false, status: 401, error: 'UNAUTHORIZED' }));
  const disabled = await handleStudioMarketingEntry(request(), async () => ({ ok: false, status: 404, error: 'NOT_FOUND' }));

  assert.equal(anonymous.headers.get('location'), '/app/studio?starter=product-ad');
  assert.equal(disabled.headers.get('location'), '/app');
});

test('Studio public entry carries the requested language through account entry without trusting arbitrary values', async () => {
  for (const lang of ['en', 'fr', 'es']) {
    const response = await handleStudioMarketingEntry(
      new NextRequest(`http://localhost/api/studio/marketing-entry?lang=${lang}&starter=product-ad`),
      async () => ({ ok: false, status: 401, error: 'UNAUTHORIZED' }),
    );
    const destination = new URL(response.headers.get('location')!, 'https://maxvideoai.local');
    assert.equal(destination.pathname, '/app/studio');
    assert.equal(destination.searchParams.get('lang'), lang);
    assert.equal(destination.searchParams.get('starter'), 'product-ad');
  }
  const invalid = await handleStudioMarketingEntry(
    new NextRequest('http://localhost/api/studio/marketing-entry?lang=outside&starter=unknown'),
    async () => ({ ok: false, status: 401, error: 'UNAUTHORIZED' }),
  );
  const destination = new URL(invalid.headers.get('location')!, 'https://maxvideoai.local');
  assert.equal(destination.searchParams.get('lang'), null);
  assert.equal(destination.pathname, '/app/studio');
});
