import { timingSafeEqual } from 'node:crypto';
import { getContentEntries } from '@/lib/content/markdown';
import { parseEditorialDraft, type EditorialDraft } from '@/lib/editorial/schema';
import { getStorageObjectMetadata } from '@/server/storage';
import { saveEditorialDraft, type EditorialVersionRef } from './repository';

export function authorizeEditorialIngest(authorization: string | null, secret: string | null): boolean {
  const expected = (secret ?? '').trim();
  const provided = (authorization ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!expected || !provided) return false;
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

type IngestDependencies = {
  isPublishedSlug: (slug: string) => Promise<boolean>;
  getAssetMetadata: (key: string) => Promise<{ size: number | null; mime: string | null }>;
  save: (input: { draft: EditorialDraft; actor: string }) => Promise<EditorialVersionRef>;
};

const defaults: IngestDependencies = {
  isPublishedSlug: async (slug) => (await getContentEntries('content/en/blog')).some((entry) => entry.slug === slug || entry.canonicalSlug === slug),
  getAssetMetadata: (key) => getStorageObjectMetadata(key),
  save: saveEditorialDraft,
};

export async function ingestEditorialDraft(
  input: unknown,
  actor: string,
  dependencies: IngestDependencies = defaults,
): Promise<EditorialVersionRef> {
  const draft = parseEditorialDraft(input);
  if (await dependencies.isPublishedSlug(draft.canonicalSlug)) {
    throw new Error('Published slug cannot be ingested as a new draft');
  }
  for (const asset of draft.assets) {
    const extension = { 'image/webp': 'webp', 'image/png': 'png', 'image/jpeg': 'jpg' }[asset.mime];
    if (!asset.sha256 || asset.storageKey !== `editorial/drafts/${asset.sha256}.${extension}`) {
      throw new Error(`Draft media object requires the uploader's exact hash-derived media key: ${asset.id}`);
    }
    const metadata = await dependencies.getAssetMetadata(asset.storageKey);
    if (metadata.size !== asset.bytes || metadata.mime !== asset.mime) {
      throw new Error(`Draft media object is missing or does not match manifest: ${asset.id}`);
    }
  }
  return dependencies.save({ draft, actor });
}
