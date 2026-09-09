import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { safeInternalReturnTarget } from '../frontend/lib/auth-return-target';
import { stageGuestCreation, consumeGuestCreation } from '../frontend/lib/guest-creation-continuation';
import { canVisitorBrowseWorkspacePath } from '../frontend/lib/visitor-access';
import { activityLoadedJobs } from '../frontend/app/(core)/jobs/_lib/jobs-activity';
import type { Job } from '../frontend/types/jobs';
const read = (path: string) => readFileSync(path, 'utf8');

test('continuations reject external and normalized authority redirects and retain legitimate context', () => {
  for (const candidate of ['//evil.test', '/\\evil.test', '/\n/evil.test', 'https://evil.test']) {
    assert.equal(safeInternalReturnTarget(candidate), '/app');
  }
  assert.equal(safeInternalReturnTarget('/app/audio?intent=sfx&job=abc#preview'), '/app/audio?intent=sfx&job=abc#preview');
  assert.equal(safeInternalReturnTarget('/app/../api/private'), '/api/private'); // callers apply route policy after canonicalization
});

test('guest creation handoff is explicit, same-surface, one-use and expires', () => {
  const values = new Map<string,string>();
  const store = { getItem: (k:string) => values.get(k) ?? null, setItem: (k:string,v:string) => { values.set(k,v); }, removeItem: (k:string) => {values.delete(k);} };
  assert.equal(stageGuestCreation(store, '/app/audio', '{"script":"My first voice"}', 'token', 100), true);
  assert.equal(consumeGuestCreation(store, '/app/audio', null, 200), null);
  assert.equal(consumeGuestCreation(store, '/app/image', 'token', 200), null);
  assert.equal(consumeGuestCreation(store, '/app/audio', 'different-token', 200), null);
  assert.equal(consumeGuestCreation(store, '/app/audio', 'token', 200), '{"script":"My first voice"}');
  assert.equal(consumeGuestCreation(store, '/app/audio', 'token', 201), null);
  stageGuestCreation(store, '/app', '{}', 'expired', 100);
  assert.equal(consumeGuestCreation(store, '/app', 'expired', 1_800_101), null);
  assert.equal(stageGuestCreation(store, '/app', 'a'.repeat(100_001), 'oversized'), false);
});

test('Studio permits only its presentation to visitors and independently gates both editor routes', () => {
  assert.equal(canVisitorBrowseWorkspacePath('/app/studio/projects'), true);
  for (const path of ['/app/studio/projects/private', '/app/studio/workspace', '/app/studio/workspace/private', '/api/studio/projects']) assert.equal(canVisitorBrowseWorkspacePath(path), false);
  for (const file of ['page.tsx', '[projectId]/page.tsx']) {
    const source = read(`frontend/app/(core)/(workspace)/app/studio/workspace/${file}`);
    assert.match(source, /await resolveStudioPageAccess\(\)/);
    assert.match(source, /if \(!access.ok\) notFound\(\)/);
    assert.doesNotMatch(source, /if \(FEATURES.studio.adminOnly\)/);
  }
  const preview = read('frontend/app/(core)/(workspace)/app/studio/projects/StudioPreviewAccess.client.tsx');
  assert.doesNotMatch(preview, /\/api\/studio|WorkspacePage|StudioProjectsPageClient/);
});

test('Activity separates starter examples from owned jobs without discarding real history', () => {
  const sample = { jobId:'sample', curated:true } as Job;
  const owned = { jobId:'owned', curated:false } as Job;
  assert.deepEqual(activityLoadedJobs([{ok:true,jobs:[sample,owned],nextCursor:null}], []), [owned]);
  assert.deepEqual(activityLoadedJobs([{ok:true,jobs:[sample],nextCursor:null}], []), []);
});

test('Media empty actions belong to the selected category and never seed a fake personal library', () => {
  const source = read('frontend/app/(core)/(workspace)/app/library/_components/LibraryPageClient.tsx');
  assert.match(source, /activeSource === 'all' && !activeJobId && !hasMore/);
  assert.match(source, /<MediaEmptyState[\s\S]*kind=\{activeKind\}/);
  assert.match(source, /key=\{user\?\.id \?\? 'guest'\}/);
  const state = read('frontend/components/library/MediaEmptyState.tsx');
  assert.match(state, /saved \?/);
  assert.doesNotMatch(state, /fetch\(|saveAsset|playlist|onboardingDone/);
});

test('Image draft reads are account-scoped and its entire state retires on account change', () => {
  const owner = read('frontend/app/(core)/(workspace)/app/image/_components/ImageWorkspaceSession.client.tsx');
  const persistence = read('frontend/app/(core)/(workspace)/app/image/_hooks/useImageComposerPersistence.ts');
  assert.match(owner, /ImageWorkspace key=\{user\?\.id \?\? 'guest'\}/);
  assert.match(persistence, /IMAGE_COMPOSER_STORAGE_KEY\}:\$\{accountId \?\? 'guest'\}/);
  assert.doesNotMatch(persistence, /getItem\(IMAGE_COMPOSER_STORAGE_KEY\)/);
});
