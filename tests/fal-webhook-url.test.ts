import assert from 'node:assert/strict';
import test from 'node:test';
import { getFalWebhookUrl } from '../frontend/src/lib/fal-webhook-url';

const keys = ['NEXT_PUBLIC_APP_URL', 'APP_URL', 'APP_BASE_URL', 'NEXT_PUBLIC_SITE_URL', 'VERCEL_URL', 'NEXT_PUBLIC_VERCEL_URL', 'FAL_WEBHOOK_TOKEN', 'FAL_WEBHOOK_VERCEL_BYPASS_SECRET'];
function withEnv(env: Record<string, string>, run: () => void) {
  const saved = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  try {
    keys.forEach(key => delete process.env[key]);
    Object.assign(process.env, env);
    run();
  } finally {
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
}

test('ordinary callbacks retain their application token without a deployment bypass', () => {
  withEnv({APP_URL: 'https://pilot.example', FAL_WEBHOOK_TOKEN: 'application-token'}, () => {
    assert.equal(getFalWebhookUrl(), 'https://pilot.example/api/fal/webhook?token=application-token');
  });
});

test('protected pilot callbacks preserve application authentication while passing the dedicated server bypass', () => {
  withEnv({APP_URL: 'https://pilot.example', FAL_WEBHOOK_TOKEN: 'application-token', FAL_WEBHOOK_VERCEL_BYPASS_SECRET: 'pilot-bypass'}, () => {
    const url = new URL(getFalWebhookUrl()!);
    assert.equal(url.origin, 'https://pilot.example');
    assert.equal(url.searchParams.get('token'), 'application-token');
    assert.equal(url.searchParams.get('x-vercel-protection-bypass'), 'pilot-bypass');
  });
});

test('a deployment bypass cannot create a callback without the application token', () => {
  withEnv({APP_URL: 'https://pilot.example', FAL_WEBHOOK_VERCEL_BYPASS_SECRET: 'pilot-bypass'}, () => {
    assert.throws(getFalWebhookUrl, /FAL_WEBHOOK_TOKEN_REQUIRED_FOR_PROTECTED_CALLBACK/);
  });
});

test('a protected callback cannot transmit its bypass over HTTP', () => {
  withEnv({APP_URL: 'http://localhost:3000', FAL_WEBHOOK_TOKEN: 'application-token', FAL_WEBHOOK_VERCEL_BYPASS_SECRET: 'pilot-bypass'}, () => {
    assert.throws(getFalWebhookUrl, /FAL_WEBHOOK_HTTPS_REQUIRED_FOR_PROTECTED_CALLBACK/);
  });
});
