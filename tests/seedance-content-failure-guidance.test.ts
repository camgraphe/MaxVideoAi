import assert from 'node:assert/strict';
import test from 'node:test';
import { getBytePlusTaskFailureCode, getBytePlusUserSafeErrorMessage, getBytePlusUserSafeTaskFailureMessage } from '../frontend/src/server/video-providers/byteplus-modelark-response';
import { getVideoFailureCodeFromSettingsSnapshot } from '../frontend/lib/video-failure-codes';
import { localizeGenerationRefundDescription } from '../frontend/lib/generation-failure-messages';
import { toUserFacingFailureMessage, toUserFacingRefundReason } from '../frontend/server/user-facing-failure-messages';
import { getWorkspaceGenerationFailureMessage } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-failure-messages';

const workspaceCopy = { messages: { seedanceCopyrightBlocked: 'Copyright blocked', seedanceCopyrightBlockedRefunded: 'Copyright blocked and refunded' } };
const promptDiagnostic = 'The request failed because the input text may contain sensitive information. Request ID: private';
const legacyMediaMessage = 'Seedance blocked reference media during its safety checks. Review the prompt and reference images, videos, or audio before trying again.';

test('Seedance input-text refusals identify the prompt during submission and polling', () => {
  for (const code of [undefined, 'InputTextSensitiveContentDetected', 'InputTextSensitiveContentDetected.PolicyViolation']) {
    // A code-only response must work too, without guessing from a generic message.
    const diagnostic = code ? 'Request failed.' : promptDiagnostic;
    assert.equal(getBytePlusTaskFailureCode(diagnostic, code), 'seedance_prompt_blocked');
    for (const message of [getBytePlusUserSafeErrorMessage(diagnostic, code), getBytePlusUserSafeTaskFailureMessage(diagnostic, code)]) {
      assert.match(message, /prompt.*blocked|blocked.*prompt/i);
      assert.doesNotMatch(message, /reference|image|video|BytePlus|request id|sensitive information/i);
    }
  }
});

test('unattributed moderation failures do not assert that reference media was rejected', () => {
  for (const [diagnostic, code] of [
    ['The request was rejected by the content policy.', undefined],
    ['The request may contain sensitive information.', 'BYTEPLUS_PROVIDER_ERROR'],
    ['Request failed.', 'SensitiveContentDetected'],
    ['The output video may contain sensitive information.', 'OutputVideoSensitiveContentDetected'],
  ] as const) {
    assert.equal(getBytePlusTaskFailureCode(diagnostic, code), 'seedance_content_blocked');
    const message = getBytePlusUserSafeErrorMessage(diagnostic, code);
    assert.match(message, /Seedance blocked this request/i);
    assert.doesNotMatch(message, /blocked (?:a |the )?reference|recognizable person|copyright/i);
    assert.equal(toUserFacingFailureMessage(message), message);
    assert.equal(toUserFacingRefundReason(message), 'Request was blocked by Seedance safety checks.');
  }
});

test('a generic moderation code preserves the explicitly identified input modality', () => {
  for (const [diagnostic, expected] of [
    [promptDiagnostic, 'seedance_prompt_blocked'],
    ['The input image may contain sensitive information.', 'seedance_reference_image_blocked'],
    ['The input video may contain sensitive information.', 'seedance_reference_video_blocked'],
    ['The input audio may contain sensitive information.', 'seedance_reference_media_blocked'],
  ] as const) {
    assert.equal(getBytePlusTaskFailureCode(diagnostic, 'SensitiveContentDetected'), expected);
  }
  // An explicit output code still takes precedence over input wording in the message.
  assert.equal(getBytePlusTaskFailureCode(promptDiagnostic, 'OutputVideoSensitiveContentDetected'), 'seedance_content_blocked');
});

test('explicit reference diagnostics retain their specific media category', () => {
  for (const [kind, code, expected] of [
    ['image', 'InputImageSensitiveContentDetected', 'seedance_reference_image_blocked'],
    ['video', 'InputVideoSensitiveContentDetected', 'seedance_reference_video_blocked'],
    ['audio', 'InputAudioSensitiveContentDetected', 'seedance_reference_media_blocked'],
  ] as const) {
    assert.equal(getBytePlusTaskFailureCode(`The input ${kind} may contain sensitive information.`), expected);
    assert.equal(getBytePlusTaskFailureCode('Request failed.', code), expected);
  }
  assert.equal(getBytePlusTaskFailureCode('Quota exceeded: resource pack exhausted.'), null);
  assert.match(getBytePlusUserSafeErrorMessage('Quota exceeded: resource pack exhausted.'), /queue.*busy/);
});

test('historical coarse media refusals use neutral guidance without changing the stored record', () => {
  const snapshot = { providerFailure: {
    provider: 'byteplus_modelark', providerErrorCode: 'BYTEPLUS_PROVIDER_ERROR',
    failureCode: 'seedance_reference_media_blocked',
  } };
  assert.equal(getVideoFailureCodeFromSettingsSnapshot(snapshot), 'seedance_content_blocked');
  assert.equal(snapshot.providerFailure.failureCode, 'seedance_reference_media_blocked');
  assert.equal(getVideoFailureCodeFromSettingsSnapshot({ providerFailure: {
    ...snapshot.providerFailure, provider: 'unrelated',
  } }), 'seedance_reference_media_blocked');
  assert.equal(getVideoFailureCodeFromSettingsSnapshot({ providerFailure: {
    ...snapshot.providerFailure, providerErrorCode: 'InputAudioSensitiveContentDetected',
  } }), 'seedance_reference_media_blocked');
  assert.equal(getVideoFailureCodeFromSettingsSnapshot({ providerFailure: {
    ...snapshot.providerFailure, providerErrorCode: 'InputTextSensitiveContentDetected',
  } }), 'seedance_prompt_blocked');
});

for (const [locale, prompt, request, refund] of [
  ['en', /prompt.*blocked|blocked.*prompt/i, /blocked this request/i, /returned to your wallet/i],
  ['fr', /bloqué le prompt/i, /bloqué cette demande/i, /recrédit/i],
  ['es', /bloqueado el prompt/i, /bloqueado esta solicitud/i, /monedero/i],
] as const) {
  test(`prompt moderation stays precise through workspace and refund guidance in ${locale}`, () => {
    const message = getBytePlusUserSafeErrorMessage(promptDiagnostic);
    const reason = toUserFacingRefundReason(message);
    assert.equal(reason, 'Prompt was blocked by Seedance safety checks.');
    assert.equal(toUserFacingFailureMessage(message), message);
    const web = getWorkspaceGenerationFailureMessage({
      status: 'failed', failureCode: 'seedance_prompt_blocked', message,
      paymentStatus: 'refunded_wallet', finalPriceCents: 434, currency: 'USD',
    }, workspaceCopy, { locale })!;
    assert.match(web, prompt);
    assert.match(web, refund);
    assert.doesNotMatch(web, /reference|référence|referencia|recognizable|request id|private/i);
    const receipt = localizeGenerationRefundDescription(`Refund Seedance 2.5 - 30s - ${reason}`, locale)!;
    assert.match(receipt, prompt);
    assert.doesNotMatch(receipt, /reference|référence|referencia/i);
  });

  test(`historical ambiguous refusals use neutral localized copy and confirm only an established wallet refund in ${locale}`, () => {
    const failureCode = getVideoFailureCodeFromSettingsSnapshot({ providerFailure: {
      provider: 'byteplus_modelark', providerErrorCode: 'BYTEPLUS_PROVIDER_ERROR',
      failureCode: 'seedance_reference_media_blocked',
    } });
    for (const paymentStatus of ['paid_wallet', 'refunded', 'refunded_wallet']) {
      const web = getWorkspaceGenerationFailureMessage({
        status: 'failed', failureCode, message: legacyMediaMessage, paymentStatus,
      }, workspaceCopy, { locale })!;
      assert.match(web, request);
      assert.equal(refund.test(web), paymentStatus === 'refunded_wallet');
    }
    const receipt = localizeGenerationRefundDescription(
      'Refund Seedance 2.5 - 30s - Reference media was blocked by Seedance safety checks.', locale, failureCode
    )!;
    assert.match(receipt, request);
  });
}
