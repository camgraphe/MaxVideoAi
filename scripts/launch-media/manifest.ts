import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { isAbsolute, resolve } from 'node:path';

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const EXTENSIONS: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
const sharp = createRequire(resolve(__dirname, '../../frontend/package.json'))('sharp');

export type Reference = {
  id: string; role: string; key: string; sourcePath: string; sha256: string; size: number;
  mime: string; width: number; height: number; disposition: 'create' | 'preexisting';
  provenance: { provider: 'vertex'; model: 'gemini-nano-banana-2.1'; nativeResponsePath: string; nativeResponseSha256: string; promptSha256: string };
};
export type Manifest = {
  schemaVersion: 1; batchId: string; ownerId: string; ownerToken: string; targetFingerprintSha256: string;
  references: Reference[]; dependencies: { sceneId: string; referenceIds: string[] }[];
};
export type Registration = {
  account: 'Camgraph'; ownerId: string; ownerToken: string; batchId: string;
  targetFingerprintSha256: string; manifestSha256: string;
  referenceCount: number; dependencyCount: number;
};
export type Target = { bucket: string; region: string };
export const digest = (value: Buffer | string) => createHash('sha256').update(value).digest('hex');
export function check(value: unknown, code: string): asserts value {
  if (!value) throw new Error(`LAUNCH_${code}`);
}
export const isHash = (value: unknown) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
export function targetFingerprint(target: Target): string {
  check(typeof target?.bucket === 'string' && /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(target.bucket)
    && typeof target.region === 'string' && /^[a-z]{2}-[a-z]+-\d$/.test(target.region), 'TARGET');
  return digest(JSON.stringify([target.bucket, target.region]));
}

/** Local original/provenance only. No URLs, symlink leaves, devices or unbounded reads. */
export async function readLocalFile(path: string, code = 'BYTES'): Promise<Buffer> {
  check(typeof path === 'string' && isAbsolute(path) && !path.split('/').includes('..'), code);
  let handle;
  try {
    handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    const stat = await handle.stat();
    check(stat.isFile() && stat.size > 0 && stat.size <= MAX_FILE_BYTES, code);
    const bytes = await handle.readFile();
    check(bytes.length === stat.size, code);
    return bytes;
  } catch { throw new Error(`LAUNCH_${code}`); }
  finally { await handle?.close(); }
}

export async function verifyImage(bytes: Buffer, ref: Reference): Promise<void> {
  check(bytes.length === ref.size && digest(bytes) === ref.sha256, 'BYTES');
  try {
    const decoder = sharp(bytes, { failOn: 'warning', limitInputPixels: 40_000_000, animated: false });
    const meta = await decoder.metadata();
    check(meta.pages === undefined || meta.pages === 1, 'BYTES');
    const decoded = await decoder.raw().toBuffer({ resolveWithObject: true });
    const mime = ({ png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp' } as Record<string, string>)[meta.format];
    check(mime === ref.mime && decoded.info.width === ref.width && decoded.info.height === ref.height, 'BYTES');
  } catch { throw new Error('LAUNCH_BYTES'); }
}

export const validId = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,95}$/.test(value)
  && !['__proto__', 'constructor', 'prototype'].includes(value);

/** Eagerly verify the entire supplied lot before the first storage operation. */
export async function validateManifest(input: Manifest, registration: Registration, target: Target) {
  const manifest: Manifest = structuredClone(input);
  check(manifest && registration && registration.account === 'Camgraph'
    && typeof registration.ownerId === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(registration.ownerId)
    && manifest.ownerId === registration.ownerId && manifest.ownerToken === registration.ownerToken, 'OWNER');
  check(manifest.schemaVersion === 1 && isHash(registration.manifestSha256)
    && digest(JSON.stringify(manifest)) === registration.manifestSha256, 'MANIFEST_DIGEST');
  check(/^[a-z0-9][a-z0-9-]{0,62}$/.test(manifest.batchId)
    && /^[a-f0-9]{32}$/.test(manifest.ownerToken) && manifest.batchId === registration.batchId, 'PATH');
  check(isHash(manifest.targetFingerprintSha256)
    && manifest.targetFingerprintSha256 === registration.targetFingerprintSha256
    && targetFingerprint(target) === registration.targetFingerprintSha256, 'TARGET');
  check(Number.isSafeInteger(registration.referenceCount) && registration.referenceCount >= 0 && registration.referenceCount <= 64
    && Number.isSafeInteger(registration.dependencyCount) && registration.dependencyCount >= 1 && registration.dependencyCount <= 32
    && Array.isArray(manifest.references) && manifest.references.length === registration.referenceCount
    && manifest.references.every(ref => validId(ref?.id) && validId(ref?.role))
    && new Set(manifest.references.map(ref => ref.id)).size === manifest.references.length
    && Array.isArray(manifest.dependencies) && manifest.dependencies.length === registration.dependencyCount
    && new Set(manifest.dependencies.map(dep => dep.sceneId)).size === manifest.dependencies.length
    && manifest.dependencies.every(dep => validId(dep?.sceneId) && Array.isArray(dep.referenceIds)
      && dep.referenceIds.length <= manifest.references.length && new Set(dep.referenceIds).size === dep.referenceIds.length
      && dep.referenceIds.every(id => manifest.references.some(ref => ref.id === id))), 'REFERENCES');
  const buffers = new Map<string, Buffer>();
  for (const ref of manifest.references) {
    check(isHash(ref.sha256) && EXTENSIONS[ref.mime]
      && ref.key === `editorial/drafts/launch-media/${manifest.batchId}/${manifest.ownerToken}/${ref.id}-${ref.sha256}.${EXTENSIONS[ref.mime]}`, 'KEY');
    check((ref.disposition === 'create' || ref.disposition === 'preexisting')
      && Number.isSafeInteger(ref.size) && ref.size > 0 && ref.size <= MAX_FILE_BYTES
      && Number.isSafeInteger(ref.width) && ref.width > 0 && Number.isSafeInteger(ref.height) && ref.height > 0, 'BYTES');
    check(ref.provenance?.provider === 'vertex' && ref.provenance.model === 'gemini-nano-banana-2.1'
      && isHash(ref.provenance.nativeResponseSha256) && isHash(ref.provenance.promptSha256), 'PROVENANCE');
    const native = await readLocalFile(ref.provenance.nativeResponsePath, 'PROVENANCE');
    check(digest(native) === ref.provenance.nativeResponseSha256, 'PROVENANCE');
    const bytes = await readLocalFile(ref.sourcePath);
    await verifyImage(bytes, ref);
    buffers.set(ref.id, bytes);
  }
  return { manifest, buffers, manifestSha256: registration.manifestSha256 };
}
