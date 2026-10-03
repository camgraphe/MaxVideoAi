import {query} from '@/lib/db';
import {conversationReferencePreviewsSchema, type ConversationReferencePreview} from '@/lib/studio/conversation-reference-previews';
import type {createSignedDownloadUrl} from '@/server/storage';
import {resolveStudioMedia} from './media-resolver';
import {createConversationMediaReadAccess} from './conversation-media-read-access';

/** Exact, read-only owner lookups; selected references need not be inserted into a timeline. */
export async function readConversationReferencePreviews(
  actor: {userId: string; projectId: string},
  rawInput: unknown,
  dependencies: {execute?: typeof query; sign?: typeof createSignedDownloadUrl; now?: () => Date} = {},
): Promise<ConversationReferencePreview[]> {
  if (!actor.userId || actor.userId !== actor.userId.trim()) throw new Error('UNAUTHORIZED');
  if (!actor.projectId || actor.projectId.length > 128 || actor.projectId !== actor.projectId.trim()) throw new Error('INVALID_PROJECT');
  const input = conversationReferencePreviewsSchema.parse(rawInput);
  const execute = dependencies.execute ?? query;
  const projects = await execute<{id: string}>(
    'SELECT id FROM studio_projects WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
    [actor.projectId, actor.userId],
  );
  if (!projects[0]) throw new Error('STUDIO_PROJECT_NOT_FOUND');
  const refs = [...new Map(input.refs.map(ref => [`${ref.kind}:${ref.assetId}`, ref])).values()];
  const assets: ConversationReferencePreview[] = [];
  for (const ref of refs) {
    const media = await resolveStudioMedia(actor.userId, ref, (sql, values) => execute(sql, values));
    const access = await createConversationMediaReadAccess(actor.userId, media, dependencies);
    assets.push({
      assetId: ref.assetId,
      kind: media.kind,
      ...(media.originalName ? {name: media.originalName} : {}),
      url: access.url,
      thumbUrl: access.thumbnailAccessUrl ?? null,
      expiresAt: access.expires,
      durationSec: media.mediaFacts?.durationSec ?? null,
      mediaFacts: media.mediaFacts ?? null,
    });
  }
  return assets;
}
