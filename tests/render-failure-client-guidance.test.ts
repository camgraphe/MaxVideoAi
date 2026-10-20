import assert from 'node:assert/strict';
import test from 'node:test';
import { getKnownGenerationFailureMessage, localizeGenerationRefundDescription } from '../frontend/lib/generation-failure-messages';
import { getVideoFailureCodeFromSettingsSnapshot } from '../frontend/lib/video-failure-codes';
import { mapGenerationStatusRecordToAgent } from '../frontend/src/server/generations/agent-generation-policy';
import type { GenerationStatusRecord } from '../frontend/src/server/generations/generation-status';
import { getWorkspaceGenerationFailureMessage } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-failure-messages';

const generic = 'MaxVideoAI could not complete this render. Please retry in a few moments. If this keeps happening, contact support with your request ID.';
const workspaceCopy = { messages: { seedanceCopyrightBlocked: '', seedanceCopyrightBlockedRefunded: '' } };
function failedRecord(patch: Partial<GenerationStatusRecord> = {}): GenerationStatusRecord {
  return { job_id: 'incident', engine_id: 'veo-3-1-lite', status: 'failed', surface: 'video',
    settings_snapshot: {}, final_price_cents: 24, currency: 'USD', payment_status: 'refunded_wallet',
    progress: 0, video_url: null, render_ids: null, message: generic, ...patch } as GenerationStatusRecord;
}

test('a persisted rejected reference host remains actionable through agent status without exposing the URL', () => {
  const record = failedRecord({ settings_snapshot: { submissionFailure: {
    code: 'IMAGE_HOST_NOT_ALLOWED', origin: 'submission_rejected', status: 422,
    message: generic, url: 'https://private.invalid/file?token=private',
  } } });
  const code = getVideoFailureCodeFromSettingsSnapshot(record.settings_snapshot);
  assert.equal(code, 'reference_link_unsupported');
  const status = mapGenerationStatusRecordToAgent(record)!;
  assert.match(status.message ?? '', /import|upload/i);
  assert.match(status.message ?? '', /returned to your wallet/i);
  assert.doesNotMatch(status.message ?? '', /private|https|token|retry in a few/i);
  assert.equal(status.retryAfterSeconds, null);
});

for (const [locale, refund, image, ratio, unavailable, prompt, reference] of [
  ['en', /returned to your wallet/i, /256/, /0.4.*2.5/, /unavailable|another model/, /prompt/, /reference image/],
  ['fr', /recrédit/, /256/, /0,4.*2,5/, /indisponible|autre modèle/, /prompt/, /image de référence/],
  ['es', /devuelto/, /256/, /0,4.*2,5/, /disponible|otro modelo/, /prompt/, /imagen de referencia/],
] as const) {
  test(`failures and confirmed wallet refunds give translated recovery guidance in ${locale}`, () => {
    for (const [message, expected] of [
      ['Image dimensions are too small. Minimum dimensions are 256x256 pixels.', image],
      ['The aspect ratio of the image should be between 0.4 and 2.5.', ratio],
      ['This video editing mode is currently unavailable. Choose another model.', unavailable],
    ] as const) {
      for (const paymentStatus of ['paid_wallet', 'paid_direct', 'refunded', 'included_mcp_trial', 'refunded_wallet']) {
        const web = getWorkspaceGenerationFailureMessage({ message, paymentStatus }, workspaceCopy, { locale })!;
        assert.match(web, expected);
        assert.equal(refund.test(web), paymentStatus === 'refunded_wallet');
      }
      const receipt = localizeGenerationRefundDescription(`Refund Model - 5s - ${message}`, locale)!;
      assert.match(receipt, expected);
      if (locale !== 'en') assert.doesNotMatch(receipt, /256x256 pixels|The aspect ratio|currently unavailable/);
    }
  });

  test(`Seedream refund localization preserves rejected input and image quantity in ${locale}`, () => {
    for (const [reason, expected] of [['Prompt was blocked by safety checks.', prompt],
      ['Reference image was blocked by safety checks.', reference]] as const) {
      const receipt = localizeGenerationRefundDescription(`Refund Seedream - 1 image - ${reason}`, locale)!;
      assert.match(receipt, /1 imag/);
      assert.match(receipt, expected);
    }
  });

  test(`unknown render failures still confirm only a persisted wallet recredit in ${locale}`, () => {
    for (const paymentStatus of ['paid_wallet', 'refunded_wallet']) {
      const web = getWorkspaceGenerationFailureMessage({ message: generic, paymentStatus }, workspaceCopy, { locale })!;
      assert.equal(refund.test(web), paymentStatus === 'refunded_wallet');
      if (locale !== 'en') assert.doesNotMatch(web, /could not|retry|Refund/);
    }
  });
}

test('agent messages confirm a real wallet refund for generic and validation failures', () => {
  for (const message of [generic, 'Image dimensions are too small. Minimum dimensions are 256x256 pixels.']) {
    for (const payment_status of ['paid_wallet', 'refunded', 'included_mcp_trial', 'refunded_wallet']) {
      const result = mapGenerationStatusRecordToAgent(failedRecord({ message, payment_status }))!;
      assert.equal(/returned to your wallet/i.test(result.message ?? ''), payment_status === 'refunded_wallet');
      assert.equal(result.retryAfterSeconds, null);
      assert.match(result.message ?? '', /fresh exact quote.*explicit user approval/);
    }
  }
});

test('opaque transport errors remain unclassified rather than being called safety or input failures', () => {
  assert.equal(getKnownGenerationFailureMessage({ message: 'Unexpected status code: 422' }), null);
});
