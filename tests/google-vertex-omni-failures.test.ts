import assert from 'node:assert/strict';
import test from 'node:test';

import { allowGenerationPoll } from './helpers/generation-poll-claim';
import { getKnownGenerationFailureMessage } from '../frontend/lib/generation-failure-messages';
import { runGoogleVertexOmniPoll } from '../frontend/server/google-vertex-omni-poll';
import { toUserFacingFailureMessage } from '../frontend/server/user-facing-failure-messages';
import { normalizeGoogleVertexOmniInteraction } from '../frontend/src/server/video-providers/google-vertex-omni/response';

const supplierMessage = "The prompt could not be submitted. This prompt contains sensitive words that violate Google's Responsible AI practices. Try rephrasing the prompt. If you think this was an error, send feedback.";
const publicMessage = 'Google blocked this request during safety checks. Review the prompt and reference media before trying again.';
const failedInteraction = {
  id: 'omni_failure_fixture',
  status: 'failed',
  object: 'interaction',
  model: 'gemini-omni-1.1-flash-preview',
  service_tier: 'standard',
  errors: [{ code: 'safety', message: supplierMessage }],
  steps: [{ type: 'user_input', content: [
    { type: 'text', text: 'PRIVATE_PROMPT_FIXTURE' },
    ...[1, 2, 3].map(index => ({ type: 'image', uri: `gs://private-fixture/reference-${index}.png`, mime_type: 'image/png' })),
  ] }],
  usage: { total_tokens: 4156, total_input_tokens: 3683, total_thought_tokens: 473 },
};

test('Omni normalizes the terminal errors array returned by Google moderation', () => {
  const task = normalizeGoogleVertexOmniInteraction(failedInteraction);
  assert.equal(task.status, 'failed');
  assert.equal(task.errorCode, 'safety');
  assert.equal(task.message, supplierMessage);
  assert.equal(task.videoUrl, null);
});

test('Omni skips malformed errors and retains singular and legacy failure messages', () => {
  for (const [payload, code, message] of [
    [{ errors: [null, {}, { message: ' ' }, { code: 'safety', message: supplierMessage }] }, 'safety', supplierMessage],
    [{ error: { code: 'invalid_request', message: 'Unsupported setting.' } }, 'invalid_request', 'Unsupported setting.'],
    [{ message: 'Legacy failure.' }, null, 'Legacy failure.'],
    [{ errors: [{ code: 'safety' }] }, 'safety', null],
  ] as const) {
    const task = normalizeGoogleVertexOmniInteraction({ id: 'failure_fixture', status: 'failed', ...payload });
    assert.equal(task.status, 'failed');
    assert.equal(task.errorCode ?? null, code);
    assert.equal(task.message, message);
  }
  for (const errors of [undefined, null, 'invalid', [], [null, {}, { message: ' ' }]]) {
    const task = normalizeGoogleVertexOmniInteraction({ status: 'in_progress', errors });
    assert.equal(task.status, 'running');
    assert.equal(task.message, null);
  }
});

for (const [locale, moderation] of [['en', /safety checks/], ['fr', /modération/], ['es', /moderación/]] as const) {
  test(`Google moderation guidance survives sanitization and localizes in ${locale}`, () => {
    const stored = toUserFacingFailureMessage(publicMessage);
    const localized = getKnownGenerationFailureMessage({ message: stored, locale });
    assert.ok(localized);
    assert.match(localized, /Google/);
    assert.match(localized, moderation);
    assert.match(localized, /prompt/);
    assert.doesNotMatch(localized, /Responsible AI|sensitive words|PRIVATE_|gs:\/\//);
  });
}

for (const [label, errors, expectedCode, expectedPublicMessage, expectedProviderMessage] of [
  ['moderation', failedInteraction.errors, 'safety', publicMessage, supplierMessage],
  ['moderation without a message', [{ code: 'safety' }], 'safety', publicMessage, null],
  ['another terminal failure', [{ code: 'invalid_request', message: 'Unsupported setting.' }], 'invalid_request',
    'This request is not supported with the selected inputs. Adjust the prompt, media, or settings and try again.', 'Unsupported setting.'],
] as const) {
  test(`Omni poll records ${label}, refunds once and never submits another generation`, async () => {
    const queries: Array<{ sql: string; params?: unknown[] }> = [];
    const job = {
      job_id: 'job_omni_failure_fixture', user_id: 'user_fixture', engine_id: 'gemini-omni-flash',
      engine_label: 'Gemini Omni Flash 1.1', provider_job_id: failedInteraction.id, status: 'running',
      duration_sec: 10, thumb_url: null, preview_video_url: null, keyframe_urls: null,
      aspect_ratio: '16:9', has_audio: true, final_price_cents: 45, currency: 'USD',
      pricing_snapshot: {}, settings_snapshot: {}, payment_status: 'paid_wallet',
      updated_at: new Date(Date.now() - 20_000).toISOString(),
      created_at: new Date(Date.now() - 60_000).toISOString(),
    };
    let submissions = 0;
    let downloads = 0;
    const deps = {
      claimPollFn: allowGenerationPoll,
      queryFn: async (sql: string, params?: unknown[]) => {
        queries.push({ sql, params });
        if (/FROM app_jobs/.test(sql) && /provider = \$1/.test(sql)) {
          return (job.status === 'running' ? [{ ...job }] : []) as never;
        }
        if (/FROM provider_attempts/.test(sql)) return [{ id: 42, attempt_index: 1 }] as never;
        if (/SET status = 'failed'/.test(sql) && /RETURNING job_id/.test(sql)) {
          job.status = 'failed';
          return [{ job_id: job.job_id }] as never;
        }
        if (/INSERT INTO app_receipts/.test(sql)) return [{ id: 'refund_fixture' }] as never;
        return [] as never;
      },
      getGoogleVertexOmniClientFn: () => ({
        createInteraction: async () => { submissions += 1; throw new Error('A refused request must never be resubmitted.'); },
        fetchInteraction: async () => ({ ...failedInteraction, errors }),
        downloadOutputUri: async () => { downloads += 1; throw new Error('A refused request has no output.'); },
      }),
    };

    const first = await runGoogleVertexOmniPoll({ deps });
    assert.equal((await first.json()).updates, 1);
    const jobUpdate = queries.find(entry => /SET status = 'failed'/.test(entry.sql));
    assert.equal(jobUpdate?.params?.[1], expectedPublicMessage);
    const attemptUpdate = queries.find(entry => /UPDATE provider_attempts/.test(entry.sql));
    assert.equal(attemptUpdate?.params?.[2], expectedCode);
    assert.equal(attemptUpdate?.params?.[4], false, 'a refusal cannot fall back to another provider');
    const snapshot = JSON.parse(String(attemptUpdate?.params?.[5]));
    assert.equal(snapshot.providerStatus, 'failed');
    assert.equal(snapshot.message, expectedPublicMessage);
    assert.equal(snapshot.errorCode, expectedCode);
    assert.equal(snapshot.providerMessage, expectedProviderMessage);
    assert.doesNotMatch(JSON.stringify(snapshot), /PRIVATE_PROMPT_FIXTURE|gs:\/\/private-fixture|steps|usage/);

    const second = await runGoogleVertexOmniPoll({ deps });
    assert.equal((await second.json()).checked, 0);
    const refunds = queries.filter(entry => /INSERT INTO app_receipts/.test(entry.sql));
    assert.equal(refunds.length, 1);
    assert.equal(refunds[0].params?.[1], 45);
    assert.equal(refunds[0].params?.[4], job.job_id);
    assert.ok(queries.some(entry => /SET payment_status = 'refunded_wallet'/.test(entry.sql)));
    assert.equal(submissions, 0);
    assert.equal(downloads, 0);
  });
}
