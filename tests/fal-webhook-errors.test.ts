import assert from 'node:assert/strict';
import test from 'node:test';

import { extractFalErrorMessage } from '../frontend/server/fal-webhook-errors.ts';
import { toUserFacingFailureMessage, toUserFacingRefundReason } from '../frontend/server/user-facing-failure-messages.ts';

const contentError = {
  detail: [{ type: 'content_policy_violation', loc: ['body', 'image_url'],
    msg: 'The content could not be processed because it contained material flagged by a content checker.',
    input: 'https://private.test/reference?token=secret' }],
};

test('official Fal webhook payload keeps content refusal instead of the transport 422 wrapper', () => {
  const message = extractFalErrorMessage({ status: 'ERROR', error: 'Unexpected status code: 422', payload: contentError });
  assert.match(toUserFacingFailureMessage(message), /safety checks/);
  assert.match(toUserFacingRefundReason(message), /safety checks/);
  assert.doesNotMatch(message ?? '', /private|token|secret|422/);
});

test('SDK result failure body wins over its generic Error message', () => {
  const sdkError = Object.assign(new Error('Unprocessable Entity'), { status: 422, body: contentError });
  assert.match(toUserFacingFailureMessage(extractFalErrorMessage({ error: sdkError })), /safety checks/);
});

test('provider type alone can identify content refusal without echoing rejected input', () => {
  const message = extractFalErrorMessage({ status: 'ERROR', payload: {
    detail: [{ type: 'content_policy_violation', loc: ['body', 'prompt'], input: 'private rejected prompt' }],
  } });
  assert.match(toUserFacingFailureMessage(message), /safety checks/);
  assert.doesNotMatch(message ?? '', /private rejected prompt/);
});

test('422 validation without content evidence must not be labeled moderation', () => {
  const message = extractFalErrorMessage({ status: 'ERROR', error: 'Unexpected status code: 422', payload: {
    detail: [{ type: 'value_error', loc: ['body', 'duration'], msg: 'Unsupported duration.', input: 20 }],
  } });
  assert.match(toUserFacingFailureMessage(message), /not supported/);
  assert.doesNotMatch(toUserFacingFailureMessage(message), /safety/);
});

test('successful payload identifiers, metrics and media are never error messages', () => {
  assert.equal(extractFalErrorMessage({ request_id: 'request-identifier', status: 'OK', payload: {
    video: { url: 'https://private.test/output.mp4' }, seed: 12, metrics: { inference_time: 3 },
  } }), null);
});

test('nested diagnostic message wins over sibling type and location fields', () => {
  assert.equal(extractFalErrorMessage({ error: { type: 'validation_error', detail: [
    { type: 'value_error', loc: ['body', 'prompt'], msg: 'Unsupported duration.' },
  ] } }), 'Unsupported duration.');
});

test('cyclic and arbitrary context does not become an error or loop forever', () => {
  const cyclic: Record<string, unknown> = { input: 'secret', request_id: 'opaque' };
  cyclic.detail = cyclic;
  assert.equal(extractFalErrorMessage({ error: cyclic }), null);
});

test('Fal webhook diagnostics prefer a nested provider message over an error type token', () => {
  const message = extractFalErrorMessage({
    status: 'ERROR',
    error: {
      detail: [
        {
          type: 'value_error',
          loc: ['body', 'prompt'],
          msg: 'The provider rejected the rendered input.',
        },
      ],
    },
  });

  assert.equal(message, 'The provider rejected the rendered input.');
});
