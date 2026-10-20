import { resolveStudioMedia } from '@/server/studio/media-resolver';
import { createConversationMediaReadAccess } from '@/server/studio/conversation-media-read-access';
import { toolAssetRefSchema } from '@/lib/toolbox/contract';
import { creatorOperationInputSchema } from '@/lib/toolbox/creator-tools';

/** Preserve stored originals/identity while issuing fresh private read access for presentation. */
export async function withCreatorMediaReadAccess<T extends object>(userId: string, operation: T): Promise<T> {
  const value = operation as Record<string, unknown>;
  async function access(ref: unknown) {
    try {
      const media = await resolveStudioMedia(userId, toolAssetRefSchema.parse(ref));
      const readable = await createConversationMediaReadAccess(userId, media);
      return { readUrl: readable.url, thumbnailReadUrl: readable.thumbnailAccessUrl ?? null, readExpiresAt: readable.expires, artifactDelivery: 'available', name: media.originalName ?? '', durationSec: media.durationSec ?? undefined };
    } catch {
      // Removed media or signing downtime must not change the completed paid operation.
      return { readUrl: null, thumbnailReadUrl: null, readExpiresAt: null, artifactDelivery: 'unavailable' };
    }
  }
  const input = creatorOperationInputSchema.safeParse(value.input);
  let presented = input.success ? { ...operation, sourceMedia: await Promise.all(input.data.inputs.map(async source => ({
    role: source.role, ref: source.source, segment: source.segment, ...await access(source.source),
  }))) } : operation;
  const subtitle = value.subtitle && typeof value.subtitle === 'object' ? value.subtitle as Record<string,unknown> : null;
  if (subtitle?.source) presented = {...presented,subtitle:{...subtitle,sourceMedia:await access(subtitle.source)}};
  if (!value.result || typeof value.result !== 'object') return presented;
  const result = value.result as Record<string, unknown>;
  if (Array.isArray(result.outputs)) {
    const outputs = await Promise.all(result.outputs.map(async output => ({ ...output, ...await access(output.asset) })));
    return { ...presented, result: { ...result, outputs } };
  }
  if (result.ref) return { ...presented, result: { ...result, ...await access(result.ref) } };
  return presented;
}
