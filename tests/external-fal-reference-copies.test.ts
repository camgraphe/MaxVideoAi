import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import sharp from 'sharp';
import { decodeImageUpload } from '../frontend/src/server/uploads/store-image-upload';
import { verifyExternalReferenceCopies } from '../frontend/server/external-fal-import/reference-copies';
const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

test('canonical PNG import keeps exact decoded pixels and distinct byte identities', async () => {
  const original = await sharp({ create: { width: 8, height: 6, channels: 4, background: '#a23e40' } }).png().withMetadata().toBuffer();
  const normalized = await decodeImageUpload({ fileName: 'reference.png', declaredMime: 'image/png', bytes: original });
  assert.notEqual(sha(original), sha(normalized.bytes));
  const reference = { providerUrl: 'https://fal.media/k1.png', assetId: 'ma_' + 'a'.repeat(32), sha256: sha(original),
    storedRepresentation: { transform: 'canonical-png-normalization-v1' as const, sha256: sha(normalized.bytes) } };
  const proof = await verifyExternalReferenceCopies(reference, original, normalized.bytes);
  assert.equal(proof.providerSha256, sha(original)); assert.equal(proof.durableSha256, sha(normalized.bytes));
  assert.equal(proof.pixelEquivalence, 'exact-rgba'); assert.equal(proof.width, 8); assert.equal(proof.height, 6);
  const decoded = await sharp(normalized.bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  decoded.data[0] ^= 1;
  const changed = await sharp(decoded.data, { raw: decoded.info }).png().toBuffer();
  await assert.rejects(verifyExternalReferenceCopies({ ...reference,
    storedRepresentation: { ...reference.storedRepresentation, sha256: sha(changed) } }, original, changed), /PIXELS_DIFFER/);
  await assert.rejects(verifyExternalReferenceCopies({ ...reference, storedRepresentation: undefined }, original, normalized.bytes), /HASH_MISMATCH/);
});

test('byte-identical reference copies need no transformation allowance', async () => {
  const bytes = Buffer.from('identical original');
  const proof = await verifyExternalReferenceCopies({ providerUrl: 'https://fal.media/k1.png', assetId: 'ma_' + 'a'.repeat(32), sha256: sha(bytes) }, bytes, bytes);
  assert.equal(proof.transform, 'none'); assert.equal(proof.durableSha256, sha(bytes));
});
