import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { decodeImageUpload } from '@/server/uploads/store-image-upload';
import type { ExternalFalImport } from './contract';
const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
export type ExternalReferenceProof = { assetId: string; providerSha256: string; durableSha256: string;
  transform: 'none' | 'canonical-png-normalization-v1'; pixelEquivalence?: 'exact-rgba'; width?: number; height?: number; pixelSha256?: string };

/** A storage re-encode is admitted only by explicit manifest identity and exact normalized pixels. */
export async function verifyExternalReferenceCopies(reference: ExternalFalImport['references'][number], provider: Buffer, durable: Buffer): Promise<ExternalReferenceProof> {
  const providerSha256 = sha(provider); const durableSha256 = sha(durable);
  const expectedDurable = reference.storedRepresentation?.sha256 ?? reference.sha256;
  if (providerSha256 !== reference.sha256 || durableSha256 !== expectedDurable) throw new Error('IMPORT_REFERENCE_HASH_MISMATCH:' + reference.assetId);
  const base = { assetId: reference.assetId, providerSha256, durableSha256 };
  if (!reference.storedRepresentation) return { ...base, transform: 'none' };
  const pngHeader = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!provider.subarray(0, 8).equals(pngHeader) || !durable.subarray(0, 8).equals(pngHeader)) throw new Error('IMPORT_REFERENCE_PNG_REQUIRED');
  const decode = (bytes: Buffer) => sharp(bytes, { failOn: 'error', limitInputPixels: 40_000_000, page: 0, pages: 1 })
    .rotate().toColourspace('srgb').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const [originalPixels, storedPixels] = await Promise.all([decode(provider), decode(durable)]);
  if (originalPixels.info.width !== storedPixels.info.width || originalPixels.info.height !== storedPixels.info.height
    || originalPixels.info.channels !== storedPixels.info.channels || !originalPixels.data.equals(storedPixels.data)) throw new Error('IMPORT_REFERENCE_PIXELS_DIFFER');
  const normalized = await decodeImageUpload({ fileName: 'reference.png', declaredMime: 'image/png', bytes: provider });
  if (normalized.mimeType !== 'image/png' || sha(normalized.bytes) !== durableSha256) throw new Error('IMPORT_REFERENCE_NOT_CANONICAL_PNG');
  return { ...base, transform: reference.storedRepresentation.transform, pixelEquivalence: 'exact-rgba',
    width: storedPixels.info.width, height: storedPixels.info.height, pixelSha256: sha(storedPixels.data) };
}
