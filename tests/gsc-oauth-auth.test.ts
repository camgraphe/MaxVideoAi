import assert from 'node:assert/strict';
import test from 'node:test';

import { fetchGscDashboardData } from '../frontend/server/seo/gsc.ts';
import { fetchSeoCockpitData } from '../frontend/server/seo/cockpit.ts';
import { fetchUrlInspectionDashboardData, inspectCuratedUrls } from '../frontend/server/seo/url-inspection.ts';

const GSC_ENV_KEYS = [
  'GSC_SITE_URL',
  'GOOGLE_SEARCH_CONSOLE_SITE_URL',
  'GSC_SERVICE_ACCOUNT_JSON',
  'GOOGLE_SERVICE_ACCOUNT_JSON',
  'GOOGLE_SERVICE_ACCOUNT_EMAIL',
  'GSC_CLIENT_EMAIL',
  'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY',
  'GSC_PRIVATE_KEY',
  'GOOGLE_OAUTH_CLIENT_ID',
  'GOOGLE_OAUTH_CLIENT_SECRET',
  'GOOGLE_OAUTH_REFRESH_TOKEN',
  'GSC_CACHE_FILE',
  'GSC_DISABLE_FILE_CACHE',
  'GSC_CACHE_TTL_SECONDS',
  'GSC_URL_INSPECTION_CACHE_FILE',
] as const;

function withCleanGscEnv(fn: () => Promise<void>): Promise<void> {
  const originalEnv = new Map<string, string | undefined>();
  for (const key of GSC_ENV_KEYS) {
    originalEnv.set(key, process.env[key]);
    delete process.env[key];
  }

  const originalFetch = globalThis.fetch;

  return fn().finally(() => {
    for (const key of GSC_ENV_KEYS) {
      const value = originalEnv.get(key);
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    globalThis.fetch = originalFetch;
  });
}

test('GSC dashboard can authenticate with OAuth refresh-token credentials when service account env is absent', async () => {
  await withCleanGscEnv(async () => {
    process.env.GSC_SITE_URL = 'sc-domain:maxvideoai.com';
    process.env.GOOGLE_OAUTH_CLIENT_ID = 'oauth-client-id.apps.googleusercontent.com';
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'oauth-client-secret';
    process.env.GOOGLE_OAUTH_REFRESH_TOKEN = 'oauth-refresh-token';
    process.env.GSC_DISABLE_FILE_CACHE = '1';

    const tokenRequests: string[] = [];
    const searchRequests: Array<{ url: string; authorization: string | null; body: unknown }> = [];

    globalThis.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url === 'https://oauth2.googleapis.com/token') {
        const body = init?.body instanceof URLSearchParams ? init.body : new URLSearchParams(String(init?.body ?? ''));
        tokenRequests.push(body.toString());
        assert.equal(body.get('grant_type'), 'refresh_token');
        assert.equal(body.get('client_id'), 'oauth-client-id.apps.googleusercontent.com');
        assert.equal(body.get('client_secret'), 'oauth-client-secret');
        assert.equal(body.get('refresh_token'), 'oauth-refresh-token');
        return Response.json({ access_token: 'oauth-access-token', expires_in: 3600 });
      }

      searchRequests.push({
        url,
        authorization: new Headers(init?.headers).get('authorization'),
        body: JSON.parse(String(init?.body ?? '{}')),
      });
      return Response.json({ rows: [] });
    };

    const data = await fetchGscDashboardData({ range: '7d', forceRefresh: true });

    assert.equal(data.ok, true);
    assert.equal(data.configured, true);
    assert.equal(data.siteUrl, 'sc-domain:maxvideoai.com');
    assert.equal(tokenRequests.length, 1);
    assert.equal(searchRequests.length, 5);
    assert.ok(searchRequests.every((request) => request.authorization === 'Bearer oauth-access-token'));
    assert.ok(searchRequests.every((request) => request.url.includes('/sites/sc-domain%3Amaxvideoai.com/searchAnalytics/query')));
    assert.ok(searchRequests.every((request) => (request.body as { type?: string }).type === 'web'));
  });
});

test('GSC dashboard reads are cache-only unless forceRefresh is requested', async () => {
  await withCleanGscEnv(async () => {
    process.env.GSC_SITE_URL = 'sc-domain:cache-only.example';
    process.env.GOOGLE_OAUTH_CLIENT_ID = 'oauth-client-id.apps.googleusercontent.com';
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'oauth-client-secret';
    process.env.GOOGLE_OAUTH_REFRESH_TOKEN = 'oauth-refresh-token';
    process.env.GSC_DISABLE_FILE_CACHE = '1';

    let fetchCalls = 0;
    globalThis.fetch = async () => {
      fetchCalls += 1;
      return Response.json({ access_token: 'unexpected-token', expires_in: 3600 });
    };

    const data = await fetchGscDashboardData({ range: '3m' });

    assert.equal(fetchCalls, 0);
    assert.equal(data.ok, false);
    assert.equal(data.configured, true);
    assert.equal(data.siteUrl, 'sc-domain:cache-only.example');
    assert.match(data.error ?? '', /No cached GSC snapshot/i);
  });
});

test('SEO cockpit analysis modules read cached GSC data only', async () => {
  await withCleanGscEnv(async () => {
    process.env.GSC_SITE_URL = 'sc-domain:ctr-cache-only.example';
    process.env.GOOGLE_OAUTH_CLIENT_ID = 'oauth-client-id.apps.googleusercontent.com';
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'oauth-client-secret';
    process.env.GOOGLE_OAUTH_REFRESH_TOKEN = 'oauth-refresh-token';
    process.env.GSC_DISABLE_FILE_CACHE = '1';

    let fetchCalls = 0;
    globalThis.fetch = async () => {
      fetchCalls += 1;
      return Response.json({ access_token: 'unexpected-token', expires_in: 3600 });
    };

    const data = await fetchSeoCockpitData({ range: '28d' });

    assert.equal(fetchCalls, 0);
    assert.deepEqual(data.ctrDoctorItems, []);
    assert.deepEqual(data.missingContentItems, []);
    assert.deepEqual(data.internalLinkSuggestions, []);
    assert.match(data.gsc.error ?? '', /No cached GSC snapshot/i);
  });
});

test('URL Inspection dashboard reads cached data only and does not call Google', async () => {
  await withCleanGscEnv(async () => {
    process.env.GSC_SITE_URL = 'sc-domain:url-inspection-cache-only.example';
    process.env.GOOGLE_OAUTH_CLIENT_ID = 'oauth-client-id.apps.googleusercontent.com';
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'oauth-client-secret';
    process.env.GOOGLE_OAUTH_REFRESH_TOKEN = 'oauth-refresh-token';
    process.env.GSC_DISABLE_FILE_CACHE = '1';

    let fetchCalls = 0;
    globalThis.fetch = async () => {
      fetchCalls += 1;
      return Response.json({ access_token: 'unexpected-token', expires_in: 3600 });
    };

    const data = await fetchUrlInspectionDashboardData({ range: '28d' });

    assert.equal(fetchCalls, 0);
    assert.equal(data.configured, true);
    assert.ok(data.items.length > 0);
    assert.ok(data.items.every((item) => item.status === 'unknown'));
  });
});

test('URL Inspection API calls happen only through manual inspection action', async () => {
  await withCleanGscEnv(async () => {
    process.env.GSC_SITE_URL = 'sc-domain:maxvideoai.com';
    process.env.GOOGLE_OAUTH_CLIENT_ID = 'oauth-client-id.apps.googleusercontent.com';
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'oauth-client-secret';
    process.env.GOOGLE_OAUTH_REFRESH_TOKEN = 'oauth-refresh-token';
    process.env.GSC_DISABLE_FILE_CACHE = '1';

    const requests: Array<{ url: string; body: unknown }> = [];
    globalThis.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url === 'https://oauth2.googleapis.com/token') {
        return Response.json({ access_token: 'manual-inspection-token', expires_in: 3600 });
      }
      requests.push({ url, body: JSON.parse(String(init?.body ?? '{}')) });
      return Response.json({
        inspectionResult: {
          indexStatusResult: {
            verdict: 'PASS',
            pageFetchState: 'SUCCESSFUL',
            indexingState: 'INDEXING_ALLOWED',
            googleCanonical: 'https://maxvideoai.com/examples/ltx',
            userCanonical: 'https://maxvideoai.com/examples/ltx',
          },
        },
      });
    };

    const result = await inspectCuratedUrls({ range: '28d', urls: ['/examples/ltx'] });

    assert.equal(result.inspected.length, 1);
    assert.equal(requests.length, 1);
    assert.equal(requests[0]?.url, 'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect');
    assert.deepEqual(requests[0]?.body, {
      inspectionUrl: 'https://maxvideoai.com/examples/ltx',
      siteUrl: 'sc-domain:maxvideoai.com',
      languageCode: 'en-US',
    });
  });
});
