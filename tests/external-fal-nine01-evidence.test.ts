import assert from 'node:assert/strict';
import test from 'node:test';
import { writeFile, readFile } from 'node:fs/promises';
import { parseExternalFalImport } from '../frontend/server/external-fal-import/contract';
import { verifyExternalFalEvidence } from '../frontend/server/external-fal-import/evidence';
import { loadNine01NativeEvidence } from '../frontend/server/external-fal-import/nine01-evidence';
import { readPrivateStagingReference } from '../frontend/server/external-fal-import/private-staging-source';
import * as privateSource from '../frontend/server/external-fal-import/private-staging-source';
import { nine01Fixture, RECOVERY_TIME, signedFixtureUrl, SOURCE_TARGET } from './helpers/nine01-native-evidence-fixture';

test('real native Kling evidence recovers expired private references by exact retained object without rewriting the accepted input', async () => {
  const f = await nine01Fixture();
  try {
    const input = parseExternalFalImport(f.input);
    const immutableInput = JSON.stringify(input.providerInput);
    const verified = await verifyExternalFalEvidence(input, f.assets, { journal: f.bundleBytes, fetcher: f.fetcher,
      readUrl: async ({ url }) => url,
      provider: { status: async () => ({ status: 'COMPLETED', request_id: f.requestId }), result: async () => ({ requestId: '', data: f.result }) },
      nativeSource: { target: SOURCE_TARGET, now: () => RECOVERY_TIME,
        sign: async (key: string) => signedFixtureUrl(key, RECOVERY_TIME, 300) },
    });
    assert.equal(verified.video.sha256, f.input.videoSha256);
    assert.equal(verified.referenceProofs?.length, 2);
    assert.equal(JSON.stringify(input.providerInput), immutableInput);
    assert.ok(f.calls.some(url => url.includes('.s3.')));
    assert.ok(f.grants.every(grant => !f.calls.includes(grant.url)), 'historical grants are evidence, never fetch targets');
  } finally { await f.cleanup(); }
});

test('the real optional bank operation is admitted independently with its own dependency and native acceptance', async () => {
  const f = await nine01Fixture({ optional: true });
  try {
    const input = parseExternalFalImport(f.input);
    if (input.engineId !== 'kling-v4') throw new Error('fixture');
    const result = await loadNine01NativeEvidence(input, f.bundleBytes, SOURCE_TARGET);
    assert.equal(result.summary.operationId, 'NINE-01-FAL-OPTION-01');
    assert.equal(result.summary.sceneId, 'K4-JANITOR-US');
    assert.equal(result.summary.dependencyId, 'K4-JANITOR-US-OPTION-01');
  } finally { await f.cleanup(); }
});

test('a dedicated source signer ignores the unrelated owned-media storage environment without changing it', async () => {
  const oldBucket = process.env.S3_BUCKET, oldRegion = process.env.S3_REGION;
  process.env.S3_BUCKET = 'unrelated-owned-bucket'; process.env.S3_REGION = 'auto';
  try {
    await assert.doesNotReject(async () => {
      const ports = privateSource.createNine01PrivateSourcePorts({ ...SOURCE_TARGET,
        accessKeyId: 'ABCDEFGHIJKLMNOPQRST', secretAccessKey: 'test-only-secret-key' });
      try {
        const key = `editorial/drafts/launch-media/nine-01/${'a'.repeat(32)}/REF01-${'b'.repeat(64)}.png`;
        const url = await ports.sign(key, { method: 'GET', expiresInSeconds: 300 });
        assert.equal(new URL(url).hostname, `${SOURCE_TARGET.bucket}.s3.${SOURCE_TARGET.region}.amazonaws.com`);
        assert.equal(process.env.S3_BUCKET, 'unrelated-owned-bucket');
        assert.equal(process.env.S3_REGION, 'auto');
      } finally { ports.close?.(); }
    });
  } finally {
    if (oldBucket === undefined) delete process.env.S3_BUCKET; else process.env.S3_BUCKET = oldBucket;
    if (oldRegion === undefined) delete process.env.S3_REGION; else process.env.S3_REGION = oldRegion;
  }
});

test('a substituted local reference master cannot borrow a valid staging manifest and accepted input', async () => {
  const f = await nine01Fixture();
  try {
    const input = parseExternalFalImport(f.input);
    if (input.engineId !== 'kling-v4') throw new Error('fixture');
    const manifest = JSON.parse(await readFile(f.files.stagingManifest.path, 'utf8'));
    await writeFile(manifest.references[0].sourcePath, Buffer.from('substituted master'));
    await assert.rejects(loadNine01NativeEvidence(input, f.bundleBytes, SOURCE_TARGET), /REFERENCE_MASTER_HASH/);
  } finally { await f.cleanup(); }
});

test('a changed native image receipt cannot certify the reference source provenance', async () => {
  const f = await nine01Fixture();
  try {
    const input = parseExternalFalImport(f.input);
    if (input.engineId !== 'kling-v4') throw new Error('fixture');
    const manifest = JSON.parse(await readFile(f.files.stagingManifest.path, 'utf8'));
    await writeFile(manifest.references[0].provenance.nativeResponsePath, JSON.stringify({ changed: true }));
    await assert.rejects(loadNine01NativeEvidence(input, f.bundleBytes, SOURCE_TARGET), /REFERENCE_PROVENANCE_HASH/);
  } finally { await f.cleanup(); }
});

test('a signer cannot switch the trusted target while signing an exact private object', async () => {
  const f = await nine01Fixture();
  try {
    const target = { ...SOURCE_TARGET };
    await assert.rejects(readPrivateStagingReference({ slotId: 'image_urls.0', key: f.grants[0].key,
      sha256: f.input.references[0].sha256, size: f.image.length, mime: 'image/png' }, {
      target, now: () => RECOVERY_TIME,
      sign: async () => { target.bucket = 'other-private-bucket'; return signedFixtureUrl(f.grants[0].key, RECOVERY_TIME, 300)
        .replace(SOURCE_TARGET.bucket, target.bucket); },
    }, f.fetcher), /GRANT_TARGET|TARGET_CHANGED/);
    assert.equal(f.calls.length, 0);
  } finally { await f.cleanup(); }
});

test('validated native bindings cannot be changed by later mutation of the supplied identity', async () => {
  const f = await nine01Fixture();
  try {
    const input = parseExternalFalImport(f.input);
    if (input.engineId !== 'kling-v4') throw new Error('fixture');
    const verified = await loadNine01NativeEvidence(input, f.bundleBytes, SOURCE_TARGET);
    input.references[0].providerUrl = 'https://example.test/replacement.png';
    await assert.rejects(verified.readReference(input.references[0], { target: SOURCE_TARGET,
      now: () => RECOVERY_TIME, sign: async key => signedFixtureUrl(key, RECOVERY_TIME, 300) }, f.fetcher), /REFERENCE_BINDING/);
    assert.equal(f.calls.length, 0);
  } finally { await f.cleanup(); }
});
