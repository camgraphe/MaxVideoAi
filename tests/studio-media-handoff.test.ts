import assert from 'node:assert/strict';
import test from 'node:test';
import { stageStudioMediaHandoff, consumeStudioMediaHandoff, studioProjectWithMediaHandoff } from '../frontend/lib/studio-media-handoff';

test('Studio handoff carries only the exact ref and implemented intent, bound to account/token/expiry', () => {
  let value: string | null = null;
  const storage = { setItem: (_key: string, raw: string) => { value = raw; }, getItem: () => value, removeItem: () => { value = null; } };
  const handoff = { ref: { type: 'job-output' as const, jobId: 'job', outputId: 'actual', kind: 'audio' as const }, intent: 'project' as const };
  assert.equal(stageStudioMediaHandoff(storage, 'a', handoff, 'token', 10), '/app/studio/projects?studioMedia=token');
  assert.equal(consumeStudioMediaHandoff(storage, 'b', 'token', 20), null);
  stageStudioMediaHandoff(storage, 'a', handoff, 'token', 10);
  assert.deepEqual(consumeStudioMediaHandoff(storage, 'a', 'token', 20), handoff);
  assert.equal(consumeStudioMediaHandoff(storage, 'a', 'token', 20), null);
  assert.equal(studioProjectWithMediaHandoff('selected', '?studioMedia=token'), '/app/studio/workspace/selected?studioMedia=token');
});
