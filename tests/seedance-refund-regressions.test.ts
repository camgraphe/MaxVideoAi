import assert from 'node:assert/strict';
import test from 'node:test';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { validateGenerationMediaConstraints } from '../frontend/app/api/generate/_lib/generation-media-constraints';
import { getBytePlusTaskFailureCode, getBytePlusUserSafeErrorMessage } from '../frontend/src/server/video-providers/byteplus-modelark-response';
import { toUserFacingFailureMessage, toUserFacingRefundReason } from '../frontend/server/user-facing-failure-messages';
import { getWorkspaceGenerationFailureMessage, getWorkspaceGenerationRequestFailureMessage } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-failure-messages';
import { localizeSeedanceRefundDescription } from '../frontend/lib/seedance-failure-messages';

const copy = { messages: { seedanceCopyrightBlocked: 'Copyright blocked', seedanceCopyrightBlockedRefunded: 'Copyright blocked and refunded' } };
const durationError = 'The parameter video total duration (seconds) specified in the request must be less than or equal to 30.2 for model dreamina-seedance-2-5 in r2v.';

async function validateClips(durations: Array<number | null>, probeDuration: number | null = null, repeatSource = false) {
  const engine = getFalEngineById('seedance-2-5')!.engine;
  const urls = durations.map((_, i) => `https://media.maxvideoai.com/user-assets/user-1/clip-${repeatSource ? 0 : i}.mp4`);
  return validateGenerationMediaConstraints({
    engineId: engine.id, mode: 'extend', userId: 'user-1', inputSchema: engine.inputSchema,
    attachments: urls.map((url, i) => ({ url, assetId: `asset-${i}`, slotId: 'extension_source_videos', kind: 'video' as const, name: 'clip.mp4', type: 'video/mp4', size: 1, durationSec: 1 })),
    referenceMediaItems: urls.map(url => ({ url, fieldId: 'extension_source_videos', kind: 'video' as const })),
    deps: {
      queryFn: async <T>() => durations.map((duration, i) => ({ asset_id: `asset-${i}`, url: urls[i], origin_url: null, original_name: 'clip.mp4', mime_type: 'video/mp4', size_bytes: 1000, width: 1280, height: 720, duration_sec: duration })) as T[],
      detectMediaDurationFn: async () => probeDuration,
    },
  });
}

test('Seedance rejects individually valid clips whose combined input duration exceeds the provider limit', async () => {
  const result = await validateClips([22, 22]);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.body.error, 'MEDIA_COMBINED_DURATION_EXCEEDED');
  assert.equal(result.body.durationSec, 44);
  assert.match(result.body.message, /30/);
});

test('Seedance accepts a nominal 30 second input including container timing tolerance', async () => {
  assert.equal((await validateClips([15, 15.04])).ok, true);
});

test('repeating the same source clip in an extension counts each submitted occurrence', async () => {
  const result = await validateClips([22, 22], null, true);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.body.durationSec, 44);
});

test('Seedance measures missing legacy upload durations instead of trusting the browser', async () => {
  const result = await validateClips([null, 22], 22);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.body.error, 'MEDIA_COMBINED_DURATION_EXCEEDED');
  assert.equal(result.body.durationSec, 44);
});

test('Seedance stops before generation when a reference duration cannot be verified', async () => {
  const result = await validateClips([null]);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.body.error, 'MEDIA_DURATION_UNVERIFIED');
});

test('Seedance duration rejection retains actionable details through job and receipt sanitization', () => {
  const message = getBytePlusUserSafeErrorMessage(durationError);
  assert.match(message, /total|combined/i);
  assert.match(message, /30/);
  assert.match(message, /shorten|trim/i);
  assert.equal(toUserFacingFailureMessage(message), message);
  assert.match(toUserFacingRefundReason(message), /30/);
  assert.equal(getBytePlusTaskFailureCode(durationError), 'seedance_reference_video_duration_exceeded');
});

test('a blocked reference video is never described as an image', () => {
  const message = getBytePlusUserSafeErrorMessage("The input video 'content[1]' may contain real person.");
  assert.match(message, /reference video/i);
  assert.doesNotMatch(message, /reference image/i);
  assert.match(toUserFacingFailureMessage(message), /reference video/i);
  assert.match(toUserFacingRefundReason(message), /video/i);
});

test('generic media safety rejections do not turn into an image failure on the receipt', () => {
  const message = getBytePlusUserSafeErrorMessage('The input audio may contain private information.');
  const reason = toUserFacingRefundReason(message);
  assert.equal(reason, 'Reference media was blocked by Seedance safety checks.');
  const translated = localizeSeedanceRefundDescription(`Refund Seedance 2.5 - 10s - ${reason}`, 'fr');
  assert.match(translated!, /un média de référence/);
  assert.doesNotMatch(translated!, /personne reconnaissable/);
});

test('unrelated provider messages do not acquire a new refund claim', () => {
  assert.equal(getWorkspaceGenerationFailureMessage({ message: 'Unrelated provider failure', paymentStatus: 'refunded_wallet' }, copy, { locale: 'fr' }), 'Unrelated provider failure');
});

test('French customer guidance includes a verified wallet refund amount', () => {
  const message = getWorkspaceGenerationFailureMessage({
    failureCode: 'seedance_reference_video_duration_exceeded',
    message: 'English fallback', paymentStatus: 'refunded_wallet', finalPriceCents: 346, currency: 'USD',
  }, copy, { locale: 'fr' });
  assert.match(message!, /durée cumulée/i);
  assert.match(message!, /3,46/);
  assert.match(message!, /recrédit/i);
  assert.doesNotMatch(message!, /quote|English/);
});

test('unconfirmed or card refunds never claim credits have returned to the wallet', () => {
  for (const paymentStatus of ['paid_wallet', 'pending_payment', 'refunded']) {
    const message = getWorkspaceGenerationFailureMessage({
      failureCode: 'seedance_reference_video_blocked', message: 'English fallback', paymentStatus,
    }, copy, { locale: 'fr' });
    assert.match(message!, /vidéo/i);
    assert.doesNotMatch(message!, /recrédit|returned to your wallet/i);
  }
});

test('pre-debit duration rejection names reference videos, measured total, limit, remedy and no charge', () => {
  const message = getWorkspaceGenerationRequestFailureMessage({
    error: 'MEDIA_COMBINED_DURATION_EXCEEDED', field: 'extension_source_videos', durationSec: 44, maxDurationSec: 30.2,
  }, 'Fallback', copy, { locale: 'fr', engineId: 'seedance-2-5' });
  assert.match(message, /vidéos de référence/);
  assert.match(message, /44/);
  assert.match(message, /30 secondes/);
  assert.match(message, /Raccourcissez/);
  assert.match(message, /Aucun crédit.*débité/);
  assert.doesNotMatch(message, /30[.,]2|recrédit/);
});

test('unverified reference duration does not tell the customer that the clip is too long', () => {
  const message = getWorkspaceGenerationRequestFailureMessage({ error: 'MEDIA_DURATION_UNVERIFIED', field: 'video_urls' }, 'Fallback', copy, { locale: 'fr', engineId: 'seedance-2-5' });
  assert.match(message, /vérifier la durée/);
  assert.match(message, /Aucun crédit.*débité/);
  assert.doesNotMatch(message, /dépasse|trop longue/);
});

test('reference video refund descriptions are localized without exposing provider errors', () => {
  const description = 'Refund Seedance 2.5 - 30s - The combined reference video duration exceeded the Seedance limit of 30 seconds.';
  assert.match(localizeSeedanceRefundDescription(description, 'fr-FR')!, /Remboursement Seedance 2.5.*durée cumulée/);
  assert.match(localizeSeedanceRefundDescription(description, 'es-ES')!, /Reembolso Seedance 2.5.*duración total/);
  assert.equal(localizeSeedanceRefundDescription('Refund Kling - 5s - Provider failed.', 'fr'), 'Refund Kling - 5s - Provider failed.');
});
