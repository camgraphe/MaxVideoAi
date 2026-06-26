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

test('Seedance recognizable-person failures explain reference-image limits', () => {
  const message = toUserFacingFailureMessage(
    'Seedance blocked a reference image because it may contain a recognizable person or private content.'
  );
  const reason = toUserFacingRefundReason(
    'Seedance blocked a reference image because it may contain a recognizable person or private content.'
  );

  assert.equal(
    message,
    'Seedance blocked a reference image because it may contain a recognizable person or private content. Use a non-identifiable, stylized, or generated reference image and try again.'
  );
  assert.equal(reason, 'Reference image was blocked by Seedance safety checks.');
  assert.doesNotMatch(message, forbidden);
  assert.doesNotMatch(reason, forbidden);
});

test('Seedance start failures keep actionable customer guidance', () => {
  const message = toUserFacingFailureMessage(
    'Seedance could not start this render. Check that reference images do not show recognizable people, reduce reference complexity, then retry.'
  );

  assert.equal(
    message,
    'Seedance could not start this render. Remove recognizable people from reference images, reduce media complexity, or retry in a few moments.'
  );
  assert.doesNotMatch(message, forbidden);
});
