import assert from 'node:assert/strict';
import test from 'node:test';

test('review projection removes media links and credential-shaped content while preserving the visible brief', async () => {
  const module = await import('../frontend/server/admin-studio-review/projection').catch(() => null);
  assert.ok(module?.redactReviewText, 'Review text needs an explicit redaction boundary');
  const text = module.redactReviewText('Make a warm scene. https://private.test/image?X-Amz-Signature=secret api_key=sk-testsecret password="my secret" Bearer eyJverylongtoken12345678901234567890', 4000);
  assert.match(text!, /Make a warm scene/);
  assert.doesNotMatch(text!, /private\.test|X-Amz|sk-testsecret|my secret|eyJvery/);
  assert.equal(module.redactReviewText(null, 4000), null);
  const variants = module.redactReviewText('The reference /media/private?token=SIGNED data:image/png;base64,RAW secret config {"client_secret":"PRIVATE_VALUE"}', 4000);
  assert.doesNotMatch(variants!, /SIGNED|base64|RAW|PRIVATE_VALUE/);
  assert.ok(module.redactReviewText('x'.repeat(6000), 4000)!.length <= 4000);
});

test('review scope and paging reject unbounded or ambiguous inputs', async () => {
  const module = await import('../frontend/server/admin-studio-review/contracts').catch(() => null);
  assert.ok(module?.reviewScopeSchema, 'Admin reads need an exact bounded account/project/turn scope');
  assert.equal(module.reviewScopeSchema.safeParse({ userId: 'owner', projectId: 'film', requestId: 'a1bd8c76-7171-4f53-92f7-b0d7e418f534' }).success, true);
  for (const value of [{ userId: '../owner' }, { projectId: 'x'.repeat(129) }, { requestId: 'not-a-uuid' }]) {
    assert.equal(module.reviewScopeSchema.safeParse({ userId: 'owner', projectId: 'film', requestId: 'a1bd8c76-7171-4f53-92f7-b0d7e418f534', ...value }).success, false);
  }
  for (const value of [{ limit: 1000 }, { page: -1 }, { page: 101 }, { userId: ['owner', 'foreign'] }, { state: 'any SQL' }]) {
    assert.equal(module.reviewListSchema.safeParse(value).success, false);
  }
});

test('usage projection excludes raw output and preserves unknown unsettled charges', async () => {
  const { projectUsage, projectAssistance } = await import('../frontend/server/admin-studio-review/projection');
  const common = {created_at: new Date('2026-10-03T12:00:00Z')};
  const usage = projectUsage({...common,state:'reported',model:'gpt-6.1-sol',usage:{input_tokens:12,output_tokens:8,input_tokens_details:{cached_tokens:0},output_tokens_details:{reasoning_tokens:3},raw:'secret'},output:'encrypted-hidden'},'conversation');
  assert.equal(usage.cachedTokens,0); assert.equal(usage.reasoningTokens,3);
  assert.doesNotMatch(JSON.stringify(usage),/encrypted|secret|raw/);
  const reserved = projectAssistance({...common,state:'unknown',reserved_cents:4,charged_cents:4,provider_min_nano_usd:null,provider_max_nano_usd:null});
  assert.equal(reserved.chargedCents,null); assert.equal(reserved.providerMaxNanoUsd,null);
  const waived = projectAssistance({...common,state:'unknown',reserved_cents:4,waived_cents:4,provider_min_nano_usd:null,provider_max_nano_usd:null});
  assert.equal(waived.waivedCents,4); assert.equal(waived.chargedCents,null); assert.equal(waived.providerMaxNanoUsd,null);
  assert.equal(reserved.waivedCents,null);
  const settled = projectAssistance({...common,state:'settled',charged_cents:0,provider_min_nano_usd:'12345',provider_max_nano_usd:'67890'});
  assert.equal(settled.chargedCents,0); assert.equal(settled.providerMinNanoUsd,'12345'); assert.equal(settled.providerMaxNanoUsd,'67890');
});

test('saved turn metadata identifies continuation without exposing its private payload or claiming preparation success', async () => {
  const { projectTurn } = await import('../frontend/server/admin-studio-review/projection');
  const row = { user_id: 'owner', project_id: 'film', request_id: 'a1bd8c76-7171-4f53-92f7-b0d7e418f534', state: 'ready', model_attempts: 1, created_at: new Date('2026-10-05T12:00:00Z'), quote_id: null };
  for (const reason of ['action_limit', 'output_limit']) {
    const turn = projectTurn({ ...row, incomplete: true, continuation_reason: reason, draft_json: { reply: 'NEVER_REPLY', continuation: { reason, lastError: { message: 'NEVER_ERROR', code: 'PARAMETER_INVALID' } } } });
    assert.equal(turn.state, 'ready');
    assert.equal(turn.incomplete, true);
    assert.equal(turn.continuationReason, reason);
    assert.equal(turn.quoteId, null);
    assert.doesNotMatch(JSON.stringify(turn), /NEVER|lastError|PARAMETER_INVALID|draft_json/);
  }
  const unknown = projectTurn({ ...row, incomplete: true, continuation_reason: 'NEVER_PRIVATE_REASON' });
  assert.equal(unknown.incomplete, true);
  assert.equal(unknown.continuationReason, null);
  assert.doesNotMatch(JSON.stringify(unknown), /NEVER_PRIVATE_REASON/);
  const ordinary = projectTurn(row);
  assert.equal(ordinary.incomplete, false);
  assert.equal(ordinary.continuationReason, null);
  assert.equal(ordinary.quoteId, null);
});

test('continuation filtering remains distinct from existing stored state filters and rejects ambiguous values', async () => {
  const { reviewListSchema } = await import('../frontend/server/admin-studio-review/contracts');
  const result = reviewListSchema.safeParse({ state: 'ready', completion: 'incomplete' });
  assert.equal(result.success, true);
  if (result.success) assert.deepEqual(result.data, { state: 'ready', completion: 'incomplete', page: 0, limit: 50 });
  for (const completion of ['complete', 'ready', ['incomplete'], 'x'.repeat(1000)]) assert.equal(reviewListSchema.safeParse({ completion }).success, false);
  assert.equal(reviewListSchema.safeParse({ state: 'ready' }).success, true);
});
