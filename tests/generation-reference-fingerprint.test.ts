import assert from 'node:assert/strict';
import test from 'node:test';
import { bindStudioReferenceSnapshot, studioReferenceFingerprint } from '../frontend/src/server/agent-api/generation-actor';
import { stableJson } from '../frontend/src/server/agent-api/generation-normalization';
import { buildGenerationPricingSnapshot } from '../frontend/src/server/agent-api/generation-pricing-read';
import type { CanonicalGenerationRequest } from '../frontend/src/server/agent-api/generation-types';
import type { ResolvedReference } from '../frontend/src/server/agent-api/reference-types';

const original: ResolvedReference = {
  assetId: 'owned-original', role: 'reference', mediaKind: 'image',
  storageUrl: 'https://media.example.test/original.png', width: 1280, height: 720,
  durationSec: null, mimeType: 'image/png',
};
const optionalFields = ['slot', 'sizeBytes', 'fps', 'decodedFrameCount', 'constantFrameRate', 'sourceSha256', 'originalName'] as const;

// All fixtures are owned execution facts, with no network or financial side effects.
test('absent optional reference facts and explicitly undefined optional facts have the same fingerprint', () => {
  const expected = studioReferenceFingerprint([original]);
  for (const key of optionalFields) {
    const reference = Object.freeze({ ...original, [key]: undefined });
    assert.equal(studioReferenceFingerprint([reference]), expected, key);
    assert.ok(Object.hasOwn(reference, key), 'Fingerprinting must not mutate the resolver result.');
  }
  assert.equal(studioReferenceFingerprint([{ ...original, ...Object.fromEntries(optionalFields.map(key => [key, undefined])) }]), expected);
});

test('existing JSON reference facts retain their fingerprint bytes', () => {
  assert.equal(studioReferenceFingerprint([original]), '34c75831464d2979e2381e73844e28ea60466dd5c582d904439aaebe71293113');
});

test('every defined optional reference fact remains bound, including zero, false and null', () => {
  const expected = studioReferenceFingerprint([original]);
  const cases: Partial<ResolvedReference>[] = [
    { slot: 0 }, { sizeBytes: 0 }, { sizeBytes: null }, { fps: 0 }, { fps: 24 },
    { decodedFrameCount: 0 }, { decodedFrameCount: 48 }, { constantFrameRate: false },
    { constantFrameRate: true }, { sourceSha256: 'a'.repeat(64) }, { originalName: null },
    { originalName: 'original.png' },
  ];
  for (const facts of cases) assert.notEqual(studioReferenceFingerprint([{ ...original, ...facts }]), expected, JSON.stringify(facts));
});

test('changed original URL and required media facts remain bound', () => {
  const expected = studioReferenceFingerprint([original]);
  for (const facts of [
    { assetId: 'another-original' }, { role: 'first_frame' as const }, { storageUrl: 'https://media.example.test/replaced.png' },
    { width: 1920 }, { height: 1080 }, { durationSec: 5 }, { mimeType: 'image/jpeg' }, { mediaKind: 'video' as const },
  ]) assert.notEqual(studioReferenceFingerprint([{ ...original, ...facts }]), expected, JSON.stringify(facts));
});

test('reference order, slots and repeated references remain bound', () => {
  const second: ResolvedReference = { ...original, assetId: 'second-original', slot: 1 };
  const expected = studioReferenceFingerprint([original, second]);
  assert.notEqual(studioReferenceFingerprint([second, original]), expected);
  assert.notEqual(studioReferenceFingerprint([original, second, original]), expected);
  assert.notEqual(studioReferenceFingerprint([original, { ...second, slot: 2 }]), expected);
  assert.equal(studioReferenceFingerprint([{ ...original, originalName: undefined }, second]), expected);
});

test('fingerprints still reject invalid numbers, undefined required facts and unknown undefined facts', () => {
  for (const value of [NaN, Infinity, -Infinity]) {
    assert.throws(() => studioReferenceFingerprint([{ ...original, width: value }]), /finite numbers/);
    assert.throws(() => studioReferenceFingerprint([{ ...original, fps: value }]), /finite numbers/);
  }
  for (const key of ['assetId', 'role', 'mediaKind', 'storageUrl', 'width', 'height', 'durationSec', 'mimeType']) {
    assert.throws(() => studioReferenceFingerprint([{ ...original, [key]: undefined } as unknown as ResolvedReference]), /JSON values/, key);
  }
  assert.throws(() => studioReferenceFingerprint([{ ...original, unrecognizedFact: undefined } as ResolvedReference]), /JSON values/);
  assert.throws(() => stableJson({ optional: undefined }), /JSON values/, 'The general serializer must remain strict.');
});

test('shared quote pricing binds the same originals when resolvers omit or spell out absent facts', () => {
  const request: CanonicalGenerationRequest = { schemaVersion: 1, surface: 'image', engineId: 'gpt-image-2', mode: 'i2i',
    prompt: 'Use the owned original', settings: {}, references: [{ kind: 'asset', assetId: original.assetId, role: 'reference' }], outputCount: 1 };
  const pricing = { priceCents: 100, currency: 'USD', membershipTier: 'member' as const,
    pricingSnapshot: { totalCents: 100, currency: 'USD', membershipTier: 'member' } };
  const membership = { tier: 'member' as const, source: 'app_receipts_rolling_30d' as const, spent30Cents: 0, thresholdCents: 0, discountPercent: 0 };
  const snapshot = (references: ResolvedReference[]) => buildGenerationPricingSnapshot(pricing, request, 'catalog', membership, references);
  assert.deepEqual(snapshot([{ ...original, originalName: undefined, slot: undefined }]), snapshot([original]));
  assert.notDeepEqual(snapshot([{ ...original, sizeBytes: 1000 }]), snapshot([{ ...original, sizeBytes: 1001 }]));
  assert.equal(Object.hasOwn(buildGenerationPricingSnapshot(pricing, { ...request, mode: 't2i', references: [] }, 'catalog', membership), 'ownedReferenceFingerprint'), false);
});

test('Studio and Toolbox approval snapshots use the same optional-fact normalization', () => {
  for (const actor of [
    { authMethod: 'studio-session' as const, userId: 'owner', clientId: null, projectId: 'film' },
    { authMethod: 'toolbox-session' as const, userId: 'owner', clientId: null },
  ]) {
    assert.deepEqual(bindStudioReferenceSnapshot({}, actor, [{ ...original, originalName: undefined }]), bindStudioReferenceSnapshot({}, actor, [original]));
    assert.notDeepEqual(bindStudioReferenceSnapshot({}, actor, [{ ...original, originalName: null }]), bindStudioReferenceSnapshot({}, actor, [original]));
  }
});
