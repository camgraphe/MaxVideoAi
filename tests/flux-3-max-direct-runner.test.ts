import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createFalClient } from '../frontend/node_modules/@fal-ai/client';
import {
  prepareDirectQuote, submitDirectJob, recoverDirectJob, createSingleSubmissionFetch,
  assertDirectPricesUnchanged,
} from '../frontend/scripts/_lib/flux-3-max-direct-runner';

const now = new Date('2026-10-20T12:00:00Z');
const scene = { id: 'film-01', title: 'Approved film', mode: 't2v', prompt: 'A fictional film scene.',
  durationSec: 20, resolution: '720p', aspectRatio: '16:9', audio: true, reasoningLevel: 'high' };
async function fixture() {
  const dir = await mkdtemp(path.join(tmpdir(), 'max-direct-'));
  return { dir, dispose: () => rm(dir, { recursive: true, force: true }) };
}
test('quote binds exact prompt/settings/reference bytes and separates direct provider cost from retail', async () => {
  const f = await fixture();
  try {
    const p = path.join(f.dir, 'k1.png'); await writeFile(p, Buffer.from('synthetic reference'));
    const sha256 = createHash('sha256').update(await readFile(p)).digest('hex');
    const quote = await prepareDirectQuote({ schemaVersion: 1, jobs: [scene, { ...scene, id: 'film-02', mode: 'ref2v',
      references: [{ path: p, sha256, frameIndex: 480 }] }] }, now);
    assert.equal(quote.providerEstimateUsd, 1.7);
    assert.equal(quote.providerListUsd, 6.8);
    assert.equal(quote.jobs[1].references[0].sha256, sha256);
    const changed = await prepareDirectQuote({ schemaVersion: 1, jobs: [{ ...scene, prompt: 'Another approved film.' }] }, now);
    assert.notEqual(quote.quoteSha256, changed.quoteSha256);
    await writeFile(p, 'changed bytes');
    await assert.rejects(prepareDirectQuote({ schemaVersion: 1, jobs: [{ ...scene, mode: 'i2v', references: [{ path: p, sha256 }] }] }, now), /REFERENCE_HASH_MISMATCH/);
  } finally { await f.dispose(); }
});
test('submit refuses missing approval, insufficient cap and stale quote before provider calls', async () => {
  const f = await fixture(); let calls = 0;
  const provider = { submit: async () => { calls++; return { request_id: 'req-1' }; }, upload: async () => 'https://fal.media/ref.png' };
  try {
    const quote = await prepareDirectQuote({ schemaVersion: 1, jobs: [scene] }, now);
    const options = { quote, jobId: scene.id, stateDir: f.dir, approvedQuoteSha256: '', maxProviderUsd: 1, now };
    await assert.rejects(submitDirectJob(options, provider), /QUOTE_APPROVAL_REQUIRED/);
    await assert.rejects(submitDirectJob({ ...options, approvedQuoteSha256: quote.quoteSha256, maxProviderUsd: 0.8 }, provider), /BUDGET_TOO_SMALL/);
    await assert.rejects(submitDirectJob({ ...options, approvedQuoteSha256: quote.quoteSha256, now: new Date('2026-10-22') }, provider), /QUOTE_EXPIRED/);
    assert.equal(calls, 0);
  } finally { await f.dispose(); }
});
test('durable pre-submit intent prevents duplicate or concurrent attempts, including uncertain network errors', async () => {
  const f = await fixture(); let submits = 0;
  try {
    const quote = await prepareDirectQuote({ schemaVersion: 1, jobs: [scene] }, now);
    const args = { quote, jobId: scene.id, stateDir: f.dir, approvedQuoteSha256: quote.quoteSha256, maxProviderUsd: 1, now };
    const provider = { submit: async () => { submits++; throw new Error('connection lost secret-token'); }, upload: async () => '' };
    const outcomes = await Promise.allSettled([submitDirectJob(args, provider), submitDirectJob(args, provider)]);
    assert.equal(outcomes.every(value => value.status === 'rejected'), true);
    assert.equal(submits, 1);
    await assert.rejects(submitDirectJob(args, provider), /ATTEMPT_ALREADY_EXISTS/);
    const journal = await readFile(path.join(f.dir, scene.id + '.jsonl'), 'utf8');
    assert.match(journal, /submission_started/); assert.doesNotMatch(journal, /secret-token/);
  } finally { await f.dispose(); }
});
test('recovery uses persisted provider ID only and never repeats a paid submission', async () => {
  const f = await fixture(); let submits = 0; const reads: string[] = [];
  try {
    const quote = await prepareDirectQuote({ schemaVersion: 1, jobs: [scene] }, now);
    await submitDirectJob({ quote, jobId: scene.id, stateDir: f.dir, approvedQuoteSha256: quote.quoteSha256, maxProviderUsd: 1, now }, {
      upload: async () => '', submit: async () => { submits++; return { request_id: 'req-accepted' }; },
    });
    const response = await recoverDirectJob({ stateDir: f.dir, jobId: scene.id }, {
      status: async (_endpoint, id) => { reads.push(id); return { status: 'COMPLETED' }; },
      result: async (_endpoint, id) => { reads.push(id); return { data: { video: { url: 'https://v3.fal.media/output.mp4' }, seed: 17 }, requestId: id }; },
    });
    assert.equal(submits, 1); assert.deepEqual(reads, ['req-accepted', 'req-accepted']);
    assert.equal(response.requestId, 'req-accepted'); assert.equal(response.status, 'COMPLETED');
  } finally { await f.dispose(); }
});
test('actual Fal SDK cannot retry a queue POST after an ambiguous 503', async () => {
  let calls = 0;
  const client = createFalClient({ credentials: 'synthetic-key', fetch: createSingleSubmissionFetch(async () => {
    calls++; return new Response('{"detail":"unavailable"}', { status: 503 });
  }) });
  await assert.rejects(client.queue.submit('blackforestlabs/flux-3-max/text-to-video', { input: { prompt: 'synthetic' } }), /SUBMISSION_HTTP_503/);
  assert.equal(calls, 1);
});
test('live pricing guard refuses any rate increase, missing endpoint or unknown billing unit', async () => {
  const quote = await prepareDirectQuote({ schemaVersion: 1, jobs: [scene] }, now);
  const endpoint = quote.jobs[0].endpoint;
  const evidence = { checkedAt: now.toISOString(), prices: [{ endpoint_id: endpoint, unit_price: 0.02125, unit: 'seconds', currency: 'USD' }],
    publicRates: [{ endpoint, usdPerSecond720p: 0.0425, usdPerSecond1080p: 0.0725, sourceUrl: 'https://fal.ai/models/' + endpoint }] };
  assert.doesNotThrow(() => assertDirectPricesUnchanged(quote, evidence, evidence));
  assert.throws(() => assertDirectPricesUnchanged(quote, evidence, { ...evidence, prices: [{ ...evidence.prices[0], unit_price: 0.0425 }] }), /PROVIDER_PRICE_INCREASED/);
  assert.throws(() => assertDirectPricesUnchanged(quote, evidence, { ...evidence, prices: [] }), /PROVIDER_PRICE_UNVERIFIED/);
  assert.throws(() => assertDirectPricesUnchanged(quote, evidence, { ...evidence, prices: [{ ...evidence.prices[0], unit: 'video' }] }), /PROVIDER_PRICE_UNVERIFIED/);
  assert.throws(() => assertDirectPricesUnchanged(quote, evidence, { ...evidence, publicRates: [{ ...evidence.publicRates[0], usdPerSecond720p: 0.17 }] }), /PROVIDER_PRICE_INCREASED/);
});
