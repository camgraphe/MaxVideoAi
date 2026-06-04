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
