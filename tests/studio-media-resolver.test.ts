import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveStudioMedia } from '../frontend/src/server/studio/media-resolver';

test('exact read-only resolver refuses foreign, hidden, deleted, unready and mismatched tuples', async () => {
  const ref = { type: 'job-output', jobId: 'job', outputId: 'exact', kind: 'audio' };
  const row = { id: 'exact', job_id: 'job', user_id: 'a', job_user_id: 'a', kind: 'audio', status: 'ready', mime_type: 'audio/wav', url: 'https://media.maxvideoai.com/a.wav?signature=one%2Ftwo', metadata: { mediaFacts: { source: 'probe', durationSec: 9.25 } } };
  const resolved = await resolveStudioMedia('a', ref, async (sql, values) => {
    assert.match(sql, /o\.job_id = \$2 AND o\.id = \$3/);
    assert.doesNotMatch(sql, /INSERT|UPDATE|DELETE|CREATE/);
    assert.deepEqual(values, ['a', 'job', 'exact', 'audio']);
    return [row];
  });
  assert.equal(resolved.url, row.url);
  assert.equal(resolved.mediaFacts?.durationSec, 9.25);
  for (const delta of [{ user_id: 'b' }, { job_user_id: 'b' }, { hidden: true }, { deleted_at: 'today' }, { status: 'pending' }, { job_id: 'other' }, { id: 'other' }, { kind: 'video' }, { url: '' }, { url: 'javascript:alert(1)' }, { mime_type: 'image/png' }, { mime_type: null }]) {
    await assert.rejects(resolveStudioMedia('a', ref, async () => [{ ...row, ...delta }]), /MEDIA_NOT_AVAILABLE/);
  }
});
