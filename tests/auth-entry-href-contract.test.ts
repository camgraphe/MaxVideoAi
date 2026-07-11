import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { buildAuthReturnTarget, buildLoginHref } from '../frontend/lib/auth-entry-href.ts';

const marketingNavSource = readFileSync('frontend/components/marketing/MarketingNav.tsx', 'utf8');
const marketingMobileSource = readFileSync('frontend/components/marketing/MarketingMobileMenu.tsx', 'utf8');
const headerSource = readFileSync('frontend/components/HeaderBar.tsx', 'utf8');
const headerMobileSource = readFileSync('frontend/components/header/HeaderMobileMenu.tsx', 'utf8');
const audioSource = readFileSync('frontend/app/(core)/(workspace)/app/audio/AudioWorkspace.tsx', 'utf8');
const librarySource = readFileSync(
  'frontend/app/(core)/(workspace)/app/library/_components/LibraryPageClient.tsx',
  'utf8'
);
const explicitAuthEntrySources = [
  'frontend/app/(core)/(workspace)/app/_components/WorkspaceAuthGateModal.tsx',
  'frontend/app/(core)/(workspace)/app/image/_components/ImageAuthGateModal.tsx',
  'frontend/app/(core)/billing/_components/BillingAuthGateModal.tsx',
  'frontend/src/components/tools/angle/_components/angle-auth-gate-modal.tsx',
  'frontend/src/components/tools/character-builder/_components/character-builder-page-shell.tsx',
  'frontend/src/components/tools/StoryboardWorkspace.tsx',
  'frontend/src/components/tools/BackgroundRemovalWorkspace.tsx',
  'frontend/src/hooks/useRequireAuth.ts',
  'frontend/app/(core)/admin/layout.tsx',
].map((path) => ({ path, source: readFileSync(path, 'utf8') }));

test('auth-entry helper maps labels to explicit modes and preserves encoded return targets', () => {
  assert.equal(
    buildLoginHref({ mode: 'signin', nextPath: '/app?engine=seedance-2-0' }),
    '/login?mode=signin&next=%2Fapp%3Fengine%3Dseedance-2-0'
  );
  assert.equal(
    buildLoginHref({ mode: 'signup', nextPath: '/billing?amount=2500&currency=USD' }),
    '/login?mode=signup&next=%2Fbilling%3Famount%3D2500%26currency%3DUSD'
  );
});

test('auth return target retains the current query without adding empty punctuation', () => {
  assert.equal(buildAuthReturnTarget('/app', 'engine=seedance-2-0&from=example'), '/app?engine=seedance-2-0&from=example');
  assert.equal(buildAuthReturnTarget('/billing', new URLSearchParams('amount=2500&currency=USD')), '/billing?amount=2500&currency=USD');
  assert.equal(buildAuthReturnTarget('/app/audio', ''), '/app/audio');
  assert.equal(buildAuthReturnTarget(null, ''), '/app');
});

test('links labelled login use signin mode on public and workspace mobile navigation', () => {
  for (const source of [marketingNavSource, marketingMobileSource]) {
    assert.match(source, /buildLoginHref/);
  }
  assert.match(headerMobileSource, /loginHref:\s*string/);
  assert.doesNotMatch(marketingNavSource, /href="\/login\?next=\/app"/);
  assert.doesNotMatch(marketingMobileSource, /href="\/login\?next=\/app"/);
  assert.match(marketingNavSource, /mode:\s*'signin'/);
  assert.match(marketingMobileSource, /mode:\s*'signin'/);
});

test('workspace header carries pathname and query into desktop and mobile auth entries', () => {
  assert.match(headerSource, /useSearchParams\(\)/);
  assert.match(headerSource, /buildAuthReturnTarget\(pathname, searchParams\)/);
  assert.match(headerSource, /mode:\s*'signup'/);
  assert.match(headerSource, /mode:\s*'signin'/);
  assert.match(headerSource, /loginHref=\{signinHref\}/);
  assert.match(headerMobileSource, /loginHref:\s*string/);
});

test('standalone Audio and Library account gates keep their feature route', () => {
  assert.match(audioSource, /nextPath:\s*'\/app\/audio'/);
  assert.match(librarySource, /nextPath:\s*'\/app\/library'/);
  assert.doesNotMatch(audioSource, /href="\/login"/);
  assert.doesNotMatch(librarySource, /href="\/login"/);
});

test('auth gates use the shared builder instead of rebuilding ambiguous login URLs', () => {
  for (const { path, source } of explicitAuthEntrySources) {
    assert.match(source, /buildLoginHref/, `${path} should use the shared auth-entry builder`);
    assert.doesNotMatch(source, /\/login\?/, `${path} should not rebuild login query strings`);
  }
});
