import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveSiteOrigin } from '../frontend/lib/siteOrigin.ts';

function withEnv<T>(overrides: Record<string, string | undefined>, run: () => T): T {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(overrides)) {
    previous.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return run();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test('resolveSiteOrigin keeps production origin on Vercel production', () => {
  const origin = withEnv(
    {
      VERCEL_ENV: 'production',
      NEXT_PUBLIC_SITE_URL: 'https://preview.example.vercel.app',
      SITE_URL: undefined,
      VERCEL_PROJECT_PRODUCTION_URL: 'maxvideoai.com',
      VERCEL_URL: 'preview.example.vercel.app',
    },
    () => resolveSiteOrigin()
  );

  assert.equal(origin, 'https://maxvideoai.com');
});

test('resolveSiteOrigin uses preview deployment origin on Vercel preview', () => {
  const origin = withEnv(
    {
      VERCEL_ENV: 'preview',
      NEXT_PUBLIC_SITE_URL: undefined,
      SITE_URL: undefined,
      VERCEL_PROJECT_PRODUCTION_URL: 'maxvideoai.com',
      VERCEL_URL: 'preview-123.camgraphes-projects.vercel.app',
    },
    () => resolveSiteOrigin()
  );

  assert.equal(origin, 'https://preview-123.camgraphes-projects.vercel.app');
});

test('resolveSiteOrigin uses configured site outside Vercel production', () => {
  const origin = withEnv(
    {
      VERCEL_ENV: '',
      NEXT_PUBLIC_SITE_URL: 'https://staging.maxvideoai.test',
      SITE_URL: undefined,
      VERCEL_PROJECT_PRODUCTION_URL: undefined,
      VERCEL_URL: undefined,
    },
    () => resolveSiteOrigin()
  );

  assert.equal(origin, 'https://staging.maxvideoai.test');
});
