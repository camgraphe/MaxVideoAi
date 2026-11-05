import assert from 'node:assert/strict';
import test from 'node:test';
import type { QueryExecutor } from '../frontend/src/lib/db';
import type { CanonicalGenerationRequest } from '../frontend/src/server/agent-api/generation-types';
import { hashCanonicalGenerationRequest, normalizeGenerationRequest } from '../frontend/src/server/agent-api/generation-normalization';
import { getOwnedQuote } from '../frontend/src/server/agent-api/quote-repository';

// Frozen pre-Recast shape and hash. A current normalizer must not manufacture the baseline.
const historical: CanonicalGenerationRequest = {
  schemaVersion: 1, surface: 'video', engineId: 'wan-3-prime', mode: 'ref2v',
  prompt: 'Animate the portrait', settings: { durationSec: 5, resolution: '720p', aspectRatio: '16:9' },
  outputCount: 1,
  references: [{ kind: 'asset', assetId: 'ma_11111111111111111111111111111111', role: 'reference' }],
};
const oldHash = 'e555664c6403cfd6bb837eabc4375b5647ded2e26ad45dc9990a3ddda8e1d712';
const ordered = { ...historical, references: historical.references.map(reference => ({ ...reference, slot: 0 })) };
const orderedHash = '6efe05ba176a9c44e4460965bdac4bdbb40039ca8063b535f827472c3053672e';
const quoteId = '123e4567-e89b-42d3-a456-426614174000';
const now = new Date('2026-11-05T12:00:00Z');

test('Wan Prime retains historical unnumbered references and explicitly ordered preview requests byte-for-byte', () => {
  for (const [request, hash] of [[historical, oldHash], [ordered, orderedHash]] as const) {
    assert.deepEqual(normalizeGenerationRequest(request), request);
    assert.equal(hashCanonicalGenerationRequest(request), hash);
  }
  const references = [
    { kind: 'asset', assetId: 'z-portrait', role: 'reference' },
    { kind: 'asset', assetId: 'a-product', role: 'reference' },
  ];
  assert.deepEqual(normalizeGenerationRequest({ ...historical, references }).references.map(r => r.kind === 'asset' ? r.assetId : r.url), ['a-product', 'z-portrait']);
  const selected = references.map((reference, slot) => ({ ...reference, slot }));
  assert.deepEqual(normalizeGenerationRequest({ ...historical, references: selected }).references, selected);
  assert.throws(() => normalizeGenerationRequest({ ...historical, references: [...selected].reverse() }), /slot/);
});

test('prepared, claimed and accepted Wan quotes preserve both historical hashes and their existing paid job', async () => {
  for (const [request, hash] of [[historical, oldHash], [ordered, orderedHash]] as const) {
    for (const state of ['prepared', 'claimed', 'accepted'] as const) {
      const row = {
        quote_id: quoteId, user_id: 'owner', oauth_client_id: 'client',
        request_json: request, request_hash: hash, catalog_revision: 'historical',
        pricing_snapshot: { totalCents: 123 }, price_cents: 123, currency: 'USD', funding_mode: 'wallet', state,
        job_id: state === 'prepared' ? null : 'already-paid-job',
        claimed_at: state === 'prepared' ? null : now,
        created_at: now, updated_at: now, expires_at: new Date(now.getTime() + 45 * 60000),
      };
      const executor: QueryExecutor = { async query<T>(sql: string) {
        assert.match(sql, /^\s*SELECT/);
        return [row] as T[];
      } };
      const read = () => getOwnedQuote({ quoteId, userId: 'owner', oauthClientId: 'client' }, { executor });
      const quote = await read();
      assert.equal(quote?.requestHash, hash);
      assert.deepEqual(quote?.request, request);
      assert.equal(quote?.jobId, row.job_id);
      assert.equal(quote?.priceCents, 123);
      row.request_hash = '0'.repeat(64);
      await assert.rejects(read(), /Invalid quote row/);
    }
  }
});
