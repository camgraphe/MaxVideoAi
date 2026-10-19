import { resolveStudioMedia } from '@/server/studio/media-resolver';
import { createConversationMediaReadAccess } from '@/server/studio/conversation-media-read-access';
import { toolAssetRefSchema } from '@/lib/toolbox/contract';

/** Preserve stored originals/identity while issuing fresh private read access for presentation. */
export async function withCreatorMediaReadAccess<T extends object>(userId: string, operation: T): Promise<T> {
  const value = operation as Record<string, unknown>;
  if (!value.result || typeof value.result !== 'object') return operation;
  const result = value.result as Record<string, unknown>;
  async function access(ref: unknown) {
    try {
      const media = await resolveStudioMedia(userId, toolAssetRefSchema.parse(ref));
      const readable = await createConversationMediaReadAccess(userId, media);
      return { readUrl: readable.url, thumbnailReadUrl: readable.thumbnailAccessUrl ?? null, readExpiresAt: readable.expires, artifactDelivery: 'available' };
    } catch {
      // Removed media or signing downtime must not change the completed paid operation.
      return { readUrl: null, thumbnailReadUrl: null, readExpiresAt: null, artifactDelivery: 'unavailable' };
    }
  }
  if (Array.isArray(result.outputs)) {
    const outputs = await Promise.all(result.outputs.map(async output => ({ ...output, ...await access(output.asset) })));
    return { ...operation, result: { ...result, outputs } };
  }
  if (result.ref) return { ...operation, result: { ...result, ...await access(result.ref) } };
  return operation;
}
