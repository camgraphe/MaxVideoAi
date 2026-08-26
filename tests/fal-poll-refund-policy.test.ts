import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const falPollPath = join(root, 'frontend/server/fal-poll.ts');
const falPollSource = readFileSync(falPollPath, 'utf8');

test('Fal poll timeout failures remain wallet-refund eligible', () => {
  assert.match(
    falPollSource,
    /const markRefundEligiblePollFailure = async \(reason: string\) => \{[\s\S]*autoRefundEligible: true,[\s\S]*failureOrigin: 'poll_internal'/,
    'poll timeout failures should pass auto-refund eligibility through the webhook handler'
  );

  for (const reason of [
    'Unable to determine render engine for this job.',
    'Render status remained unavailable after timeout grace period.',
    'Render polling exceeded expected window after timeout grace period.',
  ]) {
    assert.match(
      falPollSource,
      new RegExp(`markRefundEligiblePollFailure\\(['"]${reason.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`),
      `${reason} should use the timeout refund helper`
    );
  }

  assert.match(
    falPollSource,
    /markRefundEligiblePollFailure\(providerError \?\? 'Render returned no result after timeout grace period\.'\)/,
    'missing-result timeout failures should use the timeout refund helper'
  );
});

test('Fal poll repairs recent completed jobs that still point at Fal media', () => {
  assert.match(
    falPollSource,
    /import \{ linkFalJob \} from '@\/server\/admin-job-tools';/,
    'the cron should reuse the normal Fal resync path'
  );
  assert.match(
    falPollSource,
    /status = 'completed'[\s\S]*video_url ILIKE '%\.fal\.media\/%'[\s\S]*updated_at > NOW\(\) - INTERVAL '7 days'[\s\S]*LIMIT 5/,
    'the repair scan must stay limited to recent completed provider-hosted outputs'
  );
  assert.match(
    falPollSource,
    /await linkFalJob\(\{ jobId: recoverable\.job_id \}\)/,
    'each recoverable job should enter the idempotent durable-copy and persistence path'
  );
  assert.match(
    falPollSource,
    /durableRecoveries/,
    'the cron response should report durable recovery activity'
  );
});
