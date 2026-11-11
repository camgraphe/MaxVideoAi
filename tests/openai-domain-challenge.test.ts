import assert from 'node:assert/strict';
import test from 'node:test';
import { GET } from '../frontend/app/.well-known/openai-apps-challenge/route';

const allowed = {
  VERCEL_PROJECT_ID: 'prj_UCIR8ODoPEK3bLF30ID94gvyDs5C',
  MCP_OPENAI_DIRECTORY_DEPLOYMENT_PROFILE: 'dedicated-qualification',
  MCP_OPENAI_DOMAIN_VERIFICATION_TOKEN: 'test_challenge_token_12345678',
};
const request = (host: string, extra: Record<string, string> = {}) => new Request('https://openai-mcp.maxvideoai.com/.well-known/openai-apps-challenge', { headers: { host, ...extra } });

test('dedicated domain proof returns exactly the plain token without exposing account or OAuth data', async () => {
  const original = { ...process.env };
  try {
    Object.assign(process.env, allowed);
    const response = GET(request('openai-mcp.maxvideoai.com'));
    assert.equal(response.status, 200);
    assert.equal(await response.text(), allowed.MCP_OPENAI_DOMAIN_VERIFICATION_TOKEN);
    assert.equal(response.headers.get('content-type'), 'text/plain; charset=utf-8');
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.match(response.headers.get('x-robots-tag')!, /noindex/);
    for (const host of ['maxvideoai.com', 'api.maxvideoai.com', 'openai-review.maxvideoai.com', 'openai-mcp.maxvideoai.com.attacker.test', 'openai-mcp.maxvideoai.com:444']) {
      const denied = GET(request(host, { 'x-forwarded-host': 'openai-mcp.maxvideoai.com' }));
      assert.equal(denied.status, 404, host); assert.equal(await denied.text(), '');
    }
    for (const patch of [
      { VERCEL_PROJECT_ID: 'prj_CA8KpDAwYzihVJZyDNnEUrDszaMu' },
      { MCP_OPENAI_DIRECTORY_DEPLOYMENT_PROFILE: 'shared-production' },
      { MCP_OPENAI_DOMAIN_VERIFICATION_TOKEN: '' },
      { MCP_OPENAI_DOMAIN_VERIFICATION_TOKEN: 'token\nwith_whitespace' },
    ]) {
      Object.assign(process.env, allowed, patch);
      const denied = GET(request('openai-mcp.maxvideoai.com'));
      assert.equal(denied.status, 404); assert.equal(await denied.text(), '');
    }
  } finally {
    for (const key of Object.keys(allowed)) {
      if (original[key] === undefined) delete process.env[key]; else process.env[key] = original[key];
    }
  }
});
