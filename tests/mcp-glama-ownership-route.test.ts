import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import test from 'node:test';

const routePath = 'frontend/app/.well-known/glama.json/route.ts';

test('Glama ownership route returns the exact permanent public challenge', async () => {
  assert.ok(existsSync(routePath), 'Glama ownership route must exist');

  const { GET } = await import('../frontend/app/.well-known/glama.json/route');
  const response = await GET();

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    $schema: 'https://glama.ai/mcp/schemas/connector.json',
    claim: 'glama_claim_F6nygH7bBQqTyYeJp1TpaOh9hgo2zBbj',
  });
  assert.match(response.headers.get('content-type') ?? '', /^application\/json\b/u);
  assert.equal(response.headers.get('cache-control'), 'public, max-age=3600');
  assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
});
