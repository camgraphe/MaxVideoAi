import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { AUTH_COPY } from '../frontend/app/(core)/login/_lib/login-copy.ts';
import { buildLoginContinuation } from '../frontend/app/(core)/login/_lib/login-continuation.ts';

const controllerSource = readFileSync(
  'frontend/app/(core)/login/_hooks/useLoginPageController.ts',
  'utf8'
);
const surfaceSource = readFileSync(
  'frontend/app/(core)/login/_components/LoginAuthSurface.tsx',
  'utf8'
);

test('billing continuation confirms the preserved top-up amount', () => {
  assert.deepEqual(
    buildLoginContinuation({
      copy: AUTH_COPY.en.continuation,
      locale: 'en',
      nextPath: '/billing?amount=2500&currency=USD',
    }),
    {
      kind: 'billing',
      title: 'Your $25 top-up is saved',
      body: 'Create an account or sign in, then you’ll return to Billing with that amount still selected.',
    }
  );
});

test('workspace continuation distinguishes video, image, audio, library, and tools', () => {
  const cases = [
    ['/app?engine=seedance-2-0', 'video'],
    ['/app/image?engine=gemini-2-5-flash-image', 'image'],
    ['/app/audio', 'audio'],
    ['/app/library', 'library'],
    ['/app/tools/storyboard', 'tool'],
  ] as const;

  for (const [nextPath, kind] of cases) {
    assert.equal(
      buildLoginContinuation({ copy: AUTH_COPY.en.continuation, locale: 'en', nextPath })?.kind,
      kind
    );
  }
});

test('direct login and unsafe targets do not invent continuation claims', () => {
  assert.equal(
    buildLoginContinuation({ copy: AUTH_COPY.en.continuation, locale: 'en', nextPath: '/generate' }),
    null
  );
  assert.equal(
    buildLoginContinuation({ copy: AUTH_COPY.en.continuation, locale: 'en', nextPath: 'https://example.com' }),
    null
  );
});

test('all supported auth locales expose continuation copy', () => {
  for (const locale of ['en', 'fr', 'es'] as const) {
    const copy = AUTH_COPY[locale].continuation;
    for (const key of ['billing', 'billingGeneric', 'video', 'image', 'audio', 'library', 'tool'] as const) {
      assert.ok(copy[key].title.length > 0, `${locale}.${key}.title`);
      assert.ok(copy[key].body.length > 0, `${locale}.${key}.body`);
    }
  }
});

test('login controller and surface keep continuation derivation and rendering explicit', () => {
  assert.match(controllerSource, /buildLoginContinuation/);
  assert.match(controllerSource, /nextPathReady\s*\?\s*buildLoginContinuation/);
  assert.match(controllerSource, /nextPath:\s*safeNextPath/);
  assert.match(surfaceSource, /continuation:\s*LoginContinuation \| null/);
  assert.match(surfaceSource, /mode !== 'reset' && continuation/);
  assert.match(surfaceSource, /continuation\.title/);
  assert.match(surfaceSource, /continuation\.body/);
  assert.match(surfaceSource, /CheckCircle2/);
});
