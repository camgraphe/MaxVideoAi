import assert from 'node:assert/strict';
import test from 'node:test';
import * as guidance from '../frontend/lib/generation-failure-messages';
import { getVideoFailureCodeFromSettingsSnapshot } from '../frontend/lib/video-failure-codes';
import { localizeSeedanceRefundDescription } from '../frontend/lib/seedance-failure-messages';
import { getBytePlusTaskFailureCode, getBytePlusUserSafeTaskFailureMessage } from '../frontend/src/server/video-providers/byteplus-modelark-response';
import { toUserFacingFailureMessage, toUserFacingRefundReason } from '../frontend/server/user-facing-failure-messages';
import { getWorkspaceGenerationFailureMessage } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-failure-messages';

const outputAudioCode = 'seedance_output_audio_blocked';
const historicalAudioFailure = {
  providerFailure: {
    provider: 'byteplus_modelark',
    providerErrorCode: 'OutputAudioSensitiveContentDetected',
    failureCode: 'seedance_reference_media_blocked',
  },
};
const copyrightMessage = 'Seedance stopped this render after it started because its output checks detected possible copyright-restricted content. Change recognizable characters, brands, logos, franchise references, or source media before trying again.';
const workspaceCopy = { messages: { seedanceCopyrightBlocked: 'Copyright blocked', seedanceCopyrightBlockedRefunded: 'Copyright blocked and refunded' } };

test('output audio refusals take priority over generic reference policy diagnostics', () => {
  const raw = 'The generated audio was rejected by the content policy. Request id: private';
  assert.equal(getBytePlusTaskFailureCode(raw, 'OutputAudioSensitiveContentDetected'), outputAudioCode);
  const message = getBytePlusUserSafeTaskFailureMessage(raw, 'OutputAudioSensitiveContentDetected');
  assert.match(message, /generated audio.*blocked/i);
  assert.doesNotMatch(message, /reference media|private|request id/i);
  assert.match(toUserFacingFailureMessage(message), /generated audio.*blocked/i);
  assert.match(toUserFacingRefundReason(message), /generated audio.*blocked/i);
});

test('historical incorrect reference codes yield to the precise output audio evidence', () => {
  assert.equal(getVideoFailureCodeFromSettingsSnapshot(historicalAudioFailure), outputAudioCode);
  assert.equal(getVideoFailureCodeFromSettingsSnapshot({ providerFailure: {
    provider: 'unknown', providerErrorCode: 'OutputAudioSensitiveContentDetected', failureCode: 'seedance_reference_media_blocked',
  } }), 'seedance_reference_media_blocked');
});

test('Wan output image refusals do not expose the internal Green net checker', () => {
  const raw = 'Green net check rejected image (output)';
  assert.match(toUserFacingFailureMessage(raw), /generated image.*blocked/i);
  assert.match(toUserFacingRefundReason(raw), /generated image.*blocked/i);
  assert.doesNotMatch(toUserFacingFailureMessage(raw), /green net|reference|provider/i);
});

for (const [locale, audio, image, copyright, wallet] of [
  ['en', /generated audio/i, /generated image/i, /copyright/i, /returned to your wallet/i],
  ['fr', /audio généré/i, /image générée/i, /droits d’auteur/i, /recrédit/i],
  ['es', /audio generado/i, /imagen generada/i, /derechos de autor/i, /devuelto/i],
] as const) {
  test(`output guidance and receipt reasons identify the rejected output in ${locale}`, () => {
    for (const [failureCode, message, expected] of [
      [outputAudioCode, 'Seedance blocked reference media during its safety checks.', audio],
      [undefined, 'Green net check rejected image (output)', image],
      ['seedance_output_copyright_restricted', copyrightMessage, copyright],
    ] as const) {
      const known = guidance.getKnownGenerationFailureMessage({ failureCode, message, locale });
      assert.match(known ?? '', expected);
      assert.doesNotMatch(known ?? '', /Green net|provider|request_id/);
      if (failureCode !== 'seedance_output_copyright_restricted') {
        for (const paymentStatus of ['paid_wallet', 'refunded', 'included_mcp_trial', 'refunded_wallet']) {
          const web = getWorkspaceGenerationFailureMessage({ failureCode, message, paymentStatus }, workspaceCopy, { locale });
          assert.match(web ?? '', expected);
          assert.equal(wallet.test(web ?? ''), paymentStatus === 'refunded_wallet');
        }
      }
    }
    for (const [reason, expected] of [
      ['Generated audio was blocked by safety checks.', audio],
      ['Output was blocked for possible copyright-restricted content.', copyright],
    ] as const) {
      assert.match(localizeSeedanceRefundDescription(`Refund Seedance 2.5 - 10s - ${reason}`, locale) ?? '', expected);
    }
    assert.match(guidance.localizeGenerationRefundDescription('Refund Wan 3 Prime - 5s - Green net check rejected image (output)', locale) ?? '', image);
    assert.match(guidance.localizeGenerationRefundDescription('Refund Seedance 2.0 Fast - 5s - Reference media was blocked by Seedance safety checks.', locale, outputAudioCode) ?? '', audio);
  });

  test(`receipt API projection retains specific output guidance when displayed in ${locale}`, () => {
    for (const [model, reason, failureCode, expected] of [
      ['Wan 3 Prime', 'Green net check rejected image (output)', undefined, image],
      ['Wan 3 Prime', 'Generated image was blocked by safety checks.', undefined, image],
      ['Seedance 2.0 Fast', 'Generated audio was blocked by safety checks.', undefined, audio],
      ['Seedance 2.0 Fast', 'Reference media was blocked by Seedance safety checks.', outputAudioCode, audio],
      ['Seedance 2.5', 'Output was blocked for possible copyright-restricted content.', undefined, copyright],
    ] as const) {
      const apiDescription = guidance.localizeGenerationRefundDescription(`Refund ${model} - 5s - ${reason}`, 'en', failureCode);
      assert.match(apiDescription ?? '', locale === 'en' ? expected : /generated image|generated audio|copyright/i);
      const displayedDescription = guidance.localizeGenerationRefundDescription(apiDescription, locale);
      assert.match(displayedDescription ?? '', expected);
      assert.doesNotMatch(displayedDescription ?? '', /Green net|reference images, video, or audio/i);
    }
  });
}

test('bare Kling 422 remains an unknown failure rather than an invented content refusal', () => {
  assert.equal(guidance.getKnownGenerationFailureMessage({ message: 'Unexpected status code: 422', locale: 'fr' }), null);
  assert.doesNotMatch(toUserFacingFailureMessage('Unexpected status code: 422'), /safety|copyright|audio|reference/i);
});
