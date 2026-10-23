import { z } from 'zod';
import { toolAssetRefSchema } from '@/lib/toolbox/contract';
import { resolveStudioMedia } from '@/server/studio/media-resolver';
import { createConversationMediaReadAccess } from '@/server/studio/conversation-media-read-access';
import { VideoExcerptError } from './media';

const schema = z.object({ source: toolAssetRefSchema.refine(value => value.kind === 'video') }).strict();
/** Resolve ownership before granting short-lived access to the full original timeline. */
export async function readVideoExcerptSource(userId: string, value: unknown, dependencies = {
  resolve: resolveStudioMedia, readAccess: createConversationMediaReadAccess,
}): Promise<{previewUrl: string}> {
  if (!userId) throw new VideoExcerptError('AUTH_REQUIRED', 'Authenticate before reading the source.');
  const input = schema.safeParse(value);
  if (!input.success) throw new VideoExcerptError('PARAMETER_INVALID', 'Choose an owned video source.');
  try {
    const media = await dependencies.resolve(userId, input.data.source);
    if (media.kind !== 'video') throw new Error('MEDIA_NOT_AVAILABLE');
    const access = await dependencies.readAccess(userId, media);
    return { previewUrl: access.url };
  } catch {
    throw new VideoExcerptError('SOURCE_UNAVAILABLE', 'The source video is no longer available.');
  }
}
