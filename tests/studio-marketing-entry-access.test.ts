import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from '../frontend/node_modules/next/server';
import { handleStudioMarketingEntry } from '../frontend/app/api/studio/marketing-entry/_lib/handle-studio-marketing-entry';

const request = () => new NextRequest('http://localhost/api/studio/marketing-entry?starter=product-ad');

test('Studio marketing entry sends admins to the allowlisted starter and members back to the app', async () => {
  const admin = await handleStudioMarketingEntry(request(), async () => ({ ok: true, userId: 'admin-user' }));
  const member = await handleStudioMarketingEntry(request(), async () => ({ ok: false, status: 403, error: 'FORBIDDEN' }));

  assert.equal(admin.status, 307);
  assert.equal(admin.headers.get('location'), '/app/studio/projects?starter=product-ad');
  assert.equal(member.status, 307);
  assert.equal(member.headers.get('location'), '/app');
  assert.equal(admin.headers.get('cache-control'), 'private, no-store');
});

test('Studio marketing entry preserves login for anonymous users and hides a disabled Studio', async () => {
  const anonymous = await handleStudioMarketingEntry(request(), async () => ({ ok: false, status: 401, error: 'UNAUTHORIZED' }));
  const disabled = await handleStudioMarketingEntry(request(), async () => ({ ok: false, status: 404, error: 'NOT_FOUND' }));

  assert.equal(anonymous.headers.get('location'), '/login?mode=signin&next=%2Fapp%2Fstudio%2Fprojects%3Fstarter%3Dproduct-ad');
  assert.equal(disabled.headers.get('location'), '/app');
});
