import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const route = readFileSync('frontend/app/api/jobs/[jobId]/route.ts', 'utf8');
test('Fal status preserves explicit zero and reports processing independently of a percentage', () => {
  assert.match(route, /sj\?\.progress \?\? sj\?\.percent/);
  assert.match(route, /typeof prog === 'number' && Number\.isFinite\(prog\)/);
  assert.match(route, /providerPercent = \{ value: Math\.max\(0, Math\.min\(100, prog\)\), source: 'provider', provider: 'fal' \}/);
  assert.match(route, /st\?\.toUpperCase\(\) === 'IN_PROGRESS'/);
  assert.doesNotMatch(route, /providerPercent[^\n]*job\.progress/);
});

test('a polled update cannot overwrite a terminal webhook and degraded checks remain explicit', () => {
  assert.match(route, /WHERE job_id = \$6 AND \(status IS NULL OR status NOT IN \('completed', 'failed'\)\)[\s\S]*RETURNING job_id/);
  assert.match(route, /if \(!updated.length\)[\s\S]*readOwnedGenerationRecord\(\{ userId, jobId \}\)/);
  assert.match(route, /if \(!statusInfo\) statusCheckDegraded = true/);
  assert.match(route, /degraded: statusCheckDegraded/);
  assert.match(route, /if \(providerCompleted && !queueResult\) statusCheckDegraded = true/);
  assert.match(route, /generationStage\(job.status, providerCompleted \|\|/);
});
