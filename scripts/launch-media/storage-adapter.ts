import { check, targetFingerprint } from './manifest';
import type { StoragePorts } from './private-staging';

/** Loaded only by the operator CLI. No env loading, credential discovery or SDK call at import. */
export function createStoragePorts(): StoragePorts {
  const target = { bucket: (process.env.S3_BUCKET ?? '').trim(), region: (process.env.S3_REGION ?? '').trim() };
  const fingerprint = targetFingerprint(target);
  const currentTarget = () => {
    check(targetFingerprint({ bucket: (process.env.S3_BUCKET ?? '').trim(), region: (process.env.S3_REGION ?? '').trim() }) === fingerprint, 'TARGET');
    return { ...target };
  };
  const storage = async () => { currentTarget(); return import('../../frontend/server/storage'); };
  return {
    target: currentTarget,
    async put(input) { await (await storage()).uploadFileBufferToKey(input); },
    async read(key) {
      const owner = await storage();
      const meta = await owner.getStorageObjectMetadata(key);
      check(meta.size !== null && meta.size > 0 && meta.size <= 20 * 1024 * 1024 && meta.mime, 'BYTES');
      return { data: await owner.getStorageObjectBuffer(key), mime: meta.mime };
    },
    async sign(key, options) { return (await storage()).createSignedDownloadUrl(key, options); },
    async delete(key) { await (await storage()).deleteStorageObjectKey(key); },
  };
}
