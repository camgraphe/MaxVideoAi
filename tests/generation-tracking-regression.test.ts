import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { refreshCompositePreview } from '../frontend/app/(core)/(workspace)/app/_lib/composite-preview';
import type { VideoGroup } from '../frontend/types/video-groups';

function group(status: 'pending' | 'completed', checkedAt: number): VideoGroup {
  return { id: 'selected', layout: 'x1', provider: 'fal', createdAt: '2026-09-15', status: status === 'pending' ? 'loading' : 'ready',
    items: [{ id: 'job', jobId: 'job', url: status === 'completed' ? 'https://example.com/ready.mp4' : '', aspect: '16:9',
      meta: { status, observation: { stage: status === 'pending' ? 'processing' : 'completed', checkedAt } } }] };
}
test('a selected snapshot follows live status and immediately displays completed media', () => {
  const selected = group('pending', 100);
  const running = refreshCompositePreview(selected, [group('pending', 200)]);
  assert.equal((running.items[0].meta?.observation as {checkedAt: number}).checkedAt, 200);
  const ready = refreshCompositePreview(selected, [group('completed', 300)]);
  assert.equal(ready.status, 'ready');
  assert.equal(ready.items[0].url, 'https://example.com/ready.mp4');
  assert.equal(refreshCompositePreview(ready, [group('pending', 200)]).items[0].url, ready.items[0].url);
  assert.equal(selected.items[0].url, '', 'snapshot is never mutated');
});
test('all generation provider cron fallbacks run every minute', () => {
  const config = JSON.parse(readFileSync('frontend/vercel.json', 'utf8'));
  const routes = ['fal','byteplus','kling-direct','google-vertex-veo','google-vertex-omni','luma-agents','alibaba-model-studio'];
  for (const provider of routes) assert.equal(config.crons.find((c: {path: string}) => c.path === `/api/cron/${provider}-poll`)?.schedule, '* * * * *');
});

test('all direct provider keys reuse their poll owner and every owner takes the shared lease', () => {
  const providers = ['alibaba-model-studio','byteplus','kling-direct','google-vertex-veo','google-vertex-omni','luma-agents'];
  const dispatcher = readFileSync('frontend/server/refresh-direct-generation.ts','utf8');
  for (const provider of providers) {
    assert.ok(dispatcher.includes(`./${provider}-poll`));
    const owner = readFileSync(`frontend/server/${provider}-poll.ts`,'utf8');
    assert.match(owner,/options.jobId \?\? null/);
    assert.match(owner,/deps.claimPollFn \?\? claimGenerationPoll/);
    assert.match(owner,/await pollClaim.checked\(\)/);
    assert.match(owner,/finally \{\s*await pollClaim.release\(\)/);
  }
});
