import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildWebJobJourneyContext, buildConfirmedJobJourneyContext, normalizeJobJourneyContext,
  type JobJourneyContext,
} from '../frontend/src/server/generations/job-journey-context';
import type { GenerationActor } from '../frontend/src/server/agent-api/generation-actor';

const sha = 'a'.repeat(40);
test('C01/C04: web context uses validated server release and missing callers stay unknown', () => {
  assert.deepEqual(buildWebJobJourneyContext({ VERCEL_GIT_COMMIT_SHA: sha }), {
    entrySurface: 'generator', entrySource: 'web_route', journeyVersion: 1, entryReleaseSha: sha,
  });
  assert.ok(Object.isFrozen(buildWebJobJourneyContext({})));
  for (const value of [undefined, '', 'A'.repeat(40), 'a'.repeat(39), ' a'.repeat(40)]) {
    assert.equal(buildWebJobJourneyContext({ VERCEL_GIT_COMMIT_SHA: value }).entryReleaseSha, null);
  }
  assert.deepEqual(normalizeJobJourneyContext(undefined, { VERCEL_GIT_COMMIT_SHA: sha }), {
    entrySurface: 'unknown', entrySource: 'unknown', journeyVersion: 1, entryReleaseSha: sha,
  });
});

test('C02: same account maps validated actors, independently of media or quote defaults', () => {
  for (const [authMethod, surface] of [['oauth', 'mcp'], ['studio-session', 'studio'], ['toolbox-session', 'tool']] as const) {
    const actor = { userId: 'fixture-owner', clientId: null, authMethod, projectId: 'fixture-project' } as GenerationActor;
    assert.deepEqual(buildConfirmedJobJourneyContext(actor, { VERCEL_GIT_COMMIT_SHA: sha }), {
      entrySurface: surface, entrySource: 'confirmed_actor', journeyVersion: 1, entryReleaseSha: sha,
    });
  }
  for (const actor of [null, { authMethod: 'oauth', userId: '' },
    { authMethod: 'studio-session', userId: 'fixture-owner', clientId: null }]) {
    assert.throws(() => buildConfirmedJobJourneyContext(actor as GenerationActor));
  }
});

test('C03: malformed internal context is rejected; valid snapshots retain their captured release', () => {
  const valid = buildWebJobJourneyContext({ VERCEL_GIT_COMMIT_SHA: sha });
  assert.deepEqual(normalizeJobJourneyContext(valid, { VERCEL_GIT_COMMIT_SHA: 'b'.repeat(40) }), valid);
  for (const patch of [{ entrySurface: 'mcp' }, { entrySource: null }, { journeyVersion: 2 },
    { entryReleaseSha: 'bad' }, { entryReleaseSha: undefined }, { entrySurface: 'arbitrary' }]) {
    assert.throws(() => normalizeJobJourneyContext({ ...valid, ...patch } as JobJourneyContext));
  }
  assert.throws(() => normalizeJobJourneyContext(null as unknown as JobJourneyContext));
});
