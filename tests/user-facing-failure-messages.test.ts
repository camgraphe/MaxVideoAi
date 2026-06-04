import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildUserFacingRefundDescription,
  toUserFacingFailureMessage,
  toUserFacingRefundReason,
} from '../frontend/server/user-facing-failure-messages';

const forbidden = /fal(?:\.ai)?|fail\.ai|byteplus|modelark|google\s+vertex|kling\s+direct|provider/i;

test('user-facing failure messages hide provider and internal wording', () => {
  const message = toUserFacingFailureMessage('Fal returned no result after timeout grace period.');

  assert.equal(
    message,
    'The render finished without a usable output. Please retry or contact support with your request ID if it happens again.'
  );
  assert.doesNotMatch(message, forbidden);
});

test('refund descriptions use product wording instead of raw provider failures', () => {
  const description = buildUserFacingRefundDescription({
    engineLabel: 'Seedance 2.0',
    durationSec: 10,
    reason: 'BytePlus start failed because provider credits are exhausted.',
  });

  assert.equal(description, 'Refund Seedance 2.0 - 10s - Render queue was temporarily busy.');
  assert.doesNotMatch(description, forbidden);
});

test('refund reasons classify storage preparation failures', () => {
  const reason = toUserFacingRefundReason(
    'The provider finished this render, but the video could not be copied to MaxVideoAI storage.'
  );

  assert.equal(reason, 'Output could not be prepared for download.');
  assert.doesNotMatch(reason, forbidden);
});
