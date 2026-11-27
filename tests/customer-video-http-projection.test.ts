import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { customerPricingSnapshot } from '../frontend/src/lib/customer-pricing-snapshot';
import { customerGenerationResponse } from '../frontend/app/api/generate/_lib/customer-generation-response';
import { buildPersistedVideoJobResponse, type PersistedVideoJob } from '../frontend/app/api/generate/_lib/persisted-video-job';
import { resolveGenerateUserGate } from '../frontend/app/api/generate/_lib/auth-idempotency';
import { createPreflightPostHandler } from '../frontend/app/api/preflight/_lib/preflight-handler';
import { getGenerationFailureFallbackMessage } from '../frontend/lib/generation-failure-messages';
import type { PreflightResponse } from '../frontend/types/engines';

const internalPricing = {
  totalCents: 180, currency: 'usd', subtotalBeforeDiscountCents: 200, membershipTier: 'plus',
  discount: { amountCents: 20, percentApplied: 0.1, tier: 'plus', basedOnSupplierRate: 0.1 },
  taxes: [{ amountCents: 8, label: 'VAT', supplierTaxId: 'private-reference' }],
  customerFees: [{ amountCents: 2, label: 'Service' }],
  base: { amountCents: 32, rate: 0.032, seconds: 10 }, margin: { percent: 2 }, vendorShareCents: 32,
  platformFeeCents: 168, routing: { first: 'supplier' },
  meta: { pricingMode: 'manual_tariff', customerTariffRevision: 12, workflowStep: 'draft', providerCostUsd: 0.32 },
};
const customerPricing = {
  totalCents: 180, currency: 'USD', subtotalBeforeDiscountCents: 200, membershipTier: 'plus',
  discount: { amountCents: 20, percentApplied: 0.1, tier: 'plus' },
  taxes: [{ amountCents: 8, label: 'VAT' }], customerFees: [{ amountCents: 2, label: 'Service' }],
  meta: { pricingMode: 'manual_tariff', customerTariffRevision: 12, workflowStep: 'draft' },
};

test('current and historical snapshots expose only sale amounts and customer workflow metadata', () => {
  assert.deepEqual(customerPricingSnapshot(internalPricing), customerPricing);
  assert.deepEqual(customerPricingSnapshot({ totalCents: 0, currency: 'EUR', vendor: 'a' }), { totalCents: 0, currency: 'EUR' });
  for (const value of [null, {}, { totalCents: -1, currency: 'USD' }, { totalCents: 1, currency: 'invalid' }]) {
    assert.equal(customerPricingSnapshot(value), undefined);
  }
});

const row = {
  engine_id: 'wan-3-prime', job_id: 'public-job', status: 'completed', provider_job_id: 'private-reference',
  provider: 'apimart', message: 'private-reference, charged $0.192', pricing_snapshot: internalPricing,
  video_url: '/own-video', progress: 100, payment_status: 'paid_wallet', batch_id: 'batch', eta_seconds: 31,
} as unknown as PersistedVideoJob;

test('recovery and idempotency preserve the public job identity and redact stored transport strings, even when the request specifies another engine', async () => {
  const stored = customerGenerationResponse(buildPersistedVideoJobResponse(row, 'local-key'), row.engine_id);
  assert.equal(stored.jobId, 'public-job');
  assert.equal(stored.paymentStatus, 'paid_wallet');
  assert.equal(stored.videoUrl, '/own-video');
  assert.deepEqual(stored.pricing, customerPricing);
  assert.doesNotMatch(JSON.stringify(stored), /private-reference|apimart|providerJobId|0\.192|vendorShare/);
  let querySql = '';
  const gate = await resolveGenerateUserGate({
    req: new NextRequest('http://localhost/api/generate'), body: { engineId: 'legacy-engine', localKey: 'local-key' },
    deps: {
      resolveGenerateUserIdFn: async () => 'owner', getActiveAccountRestrictionFn: async () => null,
      queryFn: async <T>(sql: string) => { querySql = sql; return [row] as T[]; },
    },
  });
  assert.equal(gate.kind, 'response');
  assert.match(querySql, /engine_id/);
  assert.equal(gate.storedEngineId, row.engine_id);
  const result = customerGenerationResponse(gate.body, 'legacy-engine', undefined, gate.storedEngineId);
  assert.equal(result.jobId, row.job_id);
  assert.doesNotMatch(JSON.stringify(result), /private-reference|providerJobId|0\.192/);
});

test('unknown submission diagnostics never echo transport IDs or dollar amounts, while known validation remains actionable', () => {
  const details = { ok: false, error: 'X7723', message: 'private-reference was charged $0.192', detail: 'private-reference' };
  assert.deepEqual(customerGenerationResponse(details, 'minimax-h3', 'submission'),
    { ok: false, error: 'GENERATION_UNAVAILABLE', message: getGenerationFailureFallbackMessage() });
  const accepted = customerGenerationResponse({ ok: true, jobId: 'public', video: { url: '/own-video', tags: ['private-reference'] },
    provider: 'alibaba', providerJobId: 'private-reference', purchaseRouting: { route: 'alibaba' } }, 'wan-3');
  assert.deepEqual(accepted, { ok: true, jobId: 'public', video: { url: '/own-video', tags: [] } });
  const validation = { ok: false, error: 'MEDIA_DURATION_UNSUPPORTED', message: 'Choose a shorter reference.', field: 'reference_video_urls', durationSec: 18, maxDurationSec: 15 };
  assert.deepEqual(customerGenerationResponse(validation, 'minimax-h3'), validation);
  const moderation = customerGenerationResponse({ ...details, failureCode: 'seedance_reference_image_blocked' }, 'seedance-2-5', 'submission');
  assert.equal(moderation.failureCode, 'seedance_reference_image_blocked');
  assert.match(String(moderation.message), /image/i);
  const pending = customerGenerationResponse({ ...details, error: 'SEEDANCE_WORKFLOW_SUBMISSION_UNCERTAIN', jobId: row.job_id }, 'seedance-2-5', 'submission');
  assert.match(String(pending.message), /do not submit/i);
  assert.equal(pending.jobId, row.job_id);
  assert.equal(pending.error, 'SEEDANCE_WORKFLOW_SUBMISSION_UNCERTAIN');
  for (const error of ['BYTEPLUS_SUBMISSION_UNCERTAIN', 'BYTEPLUS_RECONCILIATION_PENDING', 'SUBMISSION_UNCONFIRMED']) {
    const result = customerGenerationResponse({ ...details, error }, 'wan-3-prime', 'submission');
    assert.equal(result.error, 'GENERATION_PENDING');
    assert.match(String(result.message), /do not submit/i);
  }
  assert.equal(customerGenerationResponse(details, 'seedance-2-0', 'submission'), details);
});

test('preflight HTTP preserves visible quote, revision and workflow while omitting acquisition itemization', async () => {
  const fixture = {
    ok: true, total: 180, currency: 'USD', pricing: internalPricing,
    itemization: { base: { subtotal: 32, rate: 0.032 }, fees: [{ subtotal: 168, type: 'platform_fee' }], addons: [],
      discounts: [{ subtotal: -20, tier: 'plus' }], taxes: [{ subtotal: 8 }] },
    caps: { id: 'wan-3', label: 'Wan 3', resolutions: ['720p'], pricingDetails: { vendor: 'private-reference' } },
  };
  const request = (engine: string) => new NextRequest('http://localhost/api/preflight', {
    method: 'POST', body: JSON.stringify({ engine, durationSec: 5, mode: 't2v', resolution: '720p' }),
  });
  async function preflight(engine: string, fixture: unknown) {
    const handler = createPreflightPostHandler({ resolveMediaAwarePreflightFn: async () => fixture as PreflightResponse });
    const response = await handler(request(engine));
    return { body: await response.json(), status: response.status };
  }
  const { body, status } = await preflight('wan-3', fixture);
  assert.equal(status, 200);
  assert.equal(body.total, 180);
  assert.deepEqual(body.pricing, customerPricing);
  assert.deepEqual(body.itemization, { base: { type: 'base', subtotal: 190 }, addons: [], fees: [{ type: 'customer_fee', subtotal: 2 }],
    discounts: [{ type: 'discount', subtotal: -20, tier: 'plus' }], taxes: [{ type: 'tax', subtotal: 8 }] });
  assert.deepEqual(body.caps, { id: 'wan-3', label: 'Wan 3', resolutions: ['720p'] });
  assert.doesNotMatch(JSON.stringify(body), /vendorShare|platform_fee|private-reference|0\.032/);
  const failure = await preflight('wan-3', { ok: false, messages: ['private-reference'], error: { code: 'PRICING_ERROR', message: 'rate is 0.032' } });
  assert.equal(failure.status, 400);
  assert.equal(failure.body.error.code, 'PRICING_ERROR');
  assert.doesNotMatch(JSON.stringify(failure), /private-reference|0\.032/);
  const legacy = { ...fixture, caps: { ...fixture.caps, id: 'seedance-2-0' } };
  assert.deepEqual((await preflight('seedance-2-0', legacy)).body, legacy);
});
