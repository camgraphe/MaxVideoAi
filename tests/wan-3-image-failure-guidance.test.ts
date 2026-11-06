import assert from 'node:assert/strict';
import test from 'node:test';
import { toUserFacingFailureMessage, buildUserFacingRefundDescription } from '../frontend/server/user-facing-failure-messages';
import { getKnownGenerationFailureMessage, localizeGenerationRefundDescription } from '../frontend/lib/generation-failure-messages';
import { getWorkspaceGenerationFailureMessage, getWorkspaceGenerationRequestFailureMessage } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-failure-messages';

const raw = 'Error validating image resolution: {"name":"InvalidParameter","code":400,"message":"image https://private.example/image.png?token=secret resolution must be at least 240x240, got 363x119","internal_name":"InvalidParameter"}';
const copy = { messages: { seedanceCopyrightBlocked: 'unused', seedanceCopyrightBlockedRefunded: 'unused' } };

test('Wan dimension failure retains only validated measurements and actionable copy', () => {
  const message = toUserFacingFailureMessage(raw);
  assert.match(message, /363.*119/);
  assert.match(message, /240/);
  assert.match(message, /larger image|another image/);
  assert.doesNotMatch(message, /https|secret|private|InvalidParameter|retry in a few moments|safety|refund|No credits/i);
});

test('Wan dimension cause takes precedence over incidental provider URL words', () => {
  for (const word of ['copyright', 'safety', 'moderation', 'nsfw', 'timeout']) {
    const message = toUserFacingFailureMessage(raw.replace('image.png', `${word}-image.png`));
    assert.match(message, /363.*119/);
    assert.match(message, /240/);
    assert.doesNotMatch(message, /https|private|secret|copyright|safety|moderation|nsfw|timeout/i);
  }
});

for (const [locale, action, noCharge, refund] of [
  ['en', /larger image|another image/i, /No credits were charged/, /returned to your wallet/],
  ['fr', /plus grande|autre image/i, /Aucun crédit n’a été débité/, /recrédit/],
  ['es', /más grande|otra imagen/i, /No se han descontado créditos/, /devuelto/],
] as const) {
  test(`Wan preflight explains cause, remedy and no charge in ${locale}`, () => {
    for (const engineId of ['wan-3', 'wan-3-prime']) for (const error of ['MEDIA_DIMENSIONS_TOO_SMALL', 'IMAGE_DIMENSIONS_TOO_SMALL']) {
      const message = getWorkspaceGenerationRequestFailureMessage({ error, field: 'reference_image_urls',
        actualWidth: 363, actualHeight: 119, minimumSidePx: 240, minimumWidth: 240, minimumHeight: 240 },
      'Fallback', copy, { locale, engineId });
      assert.match(message, /363.*119/);
      assert.match(message, /240/);
      assert.match(message, action);
      assert.match(message, noCharge);
      assert.doesNotMatch(message, refund);
    }
  });

  test(`Wan polling and history confirm only established wallet refunds in ${locale}`, () => {
    const persisted = toUserFacingFailureMessage(raw);
    for (const paymentStatus of ['paid_wallet', 'refunded', 'refunded_wallet', 'included_mcp_trial', 'pending_payment']) {
      const message = getWorkspaceGenerationFailureMessage({ status: 'failed', message: persisted,
        paymentStatus, finalPriceCents: 401, currency: 'USD' }, copy, { locale })!;
      assert.match(message, /363.*119/);
      assert.match(message, /240/);
      assert.match(message, action);
      assert.equal(refund.test(message), paymentStatus === 'refunded_wallet');
      assert.doesNotMatch(message, noCharge);
      if (paymentStatus === 'paid_wallet') assert.match(message, /not been confirmed|pas encore confirmé|no se ha confirmado/);
      if (paymentStatus === 'refunded_wallet') assert.match(message, /4[,.]01/);
    }
    for (const engineLabel of ['Wan 3', 'Wan 3 Prime']) {
      const stored = buildUserFacingRefundDescription({ engineLabel, durationSec: 22, reason: persisted });
      const api = localizeGenerationRefundDescription(stored, 'en');
      const displayed = localizeGenerationRefundDescription(api, locale)!;
      assert.match(displayed, /363.*119/);
      assert.match(displayed, /240/);
      assert.match(displayed, action);
      assert.doesNotMatch(displayed, /https|private|secret|InvalidParameter/);
    }
  });
}

test('unknown or malformed diagnostics do not invent the Wan dimension incident', () => {
  for (const message of ['Unexpected status code: 422', raw.replace('240x240', '256x256'),
    raw.replace('363x119', '363x240'), raw.replace('363x119', '0x119'), raw.replace('363x119', '363x119.5'),
    raw.replace('363x119', '999999999999999999x119')]) {
    assert.equal(getKnownGenerationFailureMessage({ message, locale: 'fr' }), null);
  }
});
