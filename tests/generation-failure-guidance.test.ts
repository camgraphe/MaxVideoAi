import assert from 'node:assert/strict';
import test from 'node:test';
import { getWorkspaceGenerationFailureMessage, getWorkspaceGenerationRequestFailureMessage } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-failure-messages';

const copy = { messages: { seedanceCopyrightBlocked: 'Copyright blocked', seedanceCopyrightBlockedRefunded: 'Copyright blocked and refunded' } };
const duration = 'Video duration exceeds the maximum allowed. Maximum is 15.0 seconds.';
const safety = 'This request was blocked by safety checks. Review the prompt and any reference images, video, or audio before trying again.';

for (const [locale, reference, remedy, wallet] of [
  ['en', /reference video/i, /shorten|trim|replace/i, /returned to your wallet/i],
  ['fr', /vidéo.*référence/i, /raccourcissez|remplacez/i, /recrédit/i],
  ['es', /vídeo.*referencia/i, /recorta|sustituye/i, /monedero/i],
] as const) {
  test(`MiniMax reference duration guidance is safe and localized in ${locale}`, () => {
    const message = getWorkspaceGenerationFailureMessage({ message: duration, paymentStatus: 'refunded_wallet', finalPriceCents: 315, currency: 'USD' }, copy, { locale })!;
    assert.match(message, reference);
    assert.match(message, remedy);
    assert.match(message, /15/);
    assert.match(message, wallet);
    assert.doesNotMatch(message, /14|fal\.ai|provider|request_id|Maximum is|output.*too long/i);
  });
  test(`Veo safety guidance covers prompt and references in ${locale}`, () => {
    const message = getWorkspaceGenerationFailureMessage({ message: safety, paymentStatus: 'paid_wallet' }, copy, { locale })!;
    assert.match(message, /prompt/i);
    assert.match(message, /images|imágenes/i);
    assert.match(message, /video|vidéo|vídeo/i);
    assert.match(message, /audio/i);
    assert.doesNotMatch(message, wallet);
    if (locale !== 'en') assert.doesNotMatch(message, /This request|Review the prompt/);
  });
  test(`MiniMax unmeasured input is explicit before debit in ${locale}`, () => {
    const message = getWorkspaceGenerationRequestFailureMessage({ error: 'MEDIA_DURATION_UNVERIFIED', field: 'reference_video_urls' }, 'Fallback', copy, { locale, engineId: 'minimax-h3' });
    assert.match(message, /verify|vérifier|verificar/i);
    assert.match(message, /No credits|Aucun crédit|No se han descontado créditos/i);
    assert.doesNotMatch(message, /exceeds|dépasse|supera|recrédit|returned to your wallet|Fallback/i);
  });
}

test('known guidance confirms only an established wallet refund', () => {
  for (const paymentStatus of [undefined, 'paid_wallet', 'refunded', 'included_mcp_trial', 'pending_payment']) {
    const message = getWorkspaceGenerationFailureMessage({ message: duration, paymentStatus, finalPriceCents: 315, currency: 'USD' }, copy)!;
    assert.doesNotMatch(message, /returned to your wallet|refund/i);
  }
  assert.equal(getWorkspaceGenerationFailureMessage({ message: 'Unrelated customer guidance' }, copy), 'Unrelated customer guidance');
});

test('MiniMax preflight duration rejection distinguishes input and output durations', () => {
  const message = getWorkspaceGenerationRequestFailureMessage({ error: 'MEDIA_DURATION_UNSUPPORTED', field: 'reference_video_urls', durationSec: 15.001, maxDurationSec: 15 }, 'Fallback', copy, { locale: 'en', engineId: 'minimax-h3' });
  assert.match(message, /reference video/i);
  assert.match(message, /15\.001/);
  assert.match(message, /15 seconds/);
  assert.match(message, /output duration/i);
  assert.match(message, /No credits were charged/);
});

test('copyright copy does not claim a wallet refund from another payment status', () => {
  for (const paymentStatus of ['refunded', 'paid_wallet', 'included_mcp_trial']) {
    assert.equal(getWorkspaceGenerationFailureMessage({ failureCode: 'seedance_output_copyright_restricted', paymentStatus }, copy), copy.messages.seedanceCopyrightBlocked);
  }
  assert.equal(getWorkspaceGenerationFailureMessage({ failureCode: 'seedance_output_copyright_restricted', paymentStatus: 'refunded_wallet' }, copy), copy.messages.seedanceCopyrightBlockedRefunded);
});
