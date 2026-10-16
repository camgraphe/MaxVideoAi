import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { GET, POST } from '../frontend/app/api/admin/pricing/seedance-las/route';

test('LAS tariff release refuses anonymous preview and confirmation before any pricing access', async () => {
  const original = process.env.LOCAL_ADMIN_BYPASS;
  delete process.env.LOCAL_ADMIN_BYPASS;
  try {
    const read = await GET(new NextRequest('https://maxvideoai.com/api/admin/pricing/seedance-las'));
    assert.equal(read.status, 401);
    const write = await POST(new NextRequest('https://maxvideoai.com/api/admin/pricing/seedance-las', {
      method: 'POST', headers: { origin: 'https://maxvideoai.com', 'content-type': 'application/json' },
      body: JSON.stringify({ fingerprint: '0'.repeat(64), confirm: true }),
    }));
    assert.equal(write.status, 401);
  } finally {
    if (original === undefined) delete process.env.LOCAL_ADMIN_BYPASS; else process.env.LOCAL_ADMIN_BYPASS = original;
  }
});
