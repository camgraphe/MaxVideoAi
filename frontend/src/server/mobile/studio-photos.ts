import { z } from 'zod';
import { query } from '@/lib/db';
import { STUDIO_CONVERSATION_MAX_ATTACHMENTS } from '@/lib/studio/conversation-creation-contract';
import type { StudioPhotoRead } from '@/lib/mobile-studio';
import { readConversationReferencePreviews } from '@/server/studio/conversation-reference-previews';
import { MobileHttpError } from './errors';

const readInput = z.object({
  assetIds: z.array(z.string().regex(/^ma_[a-f0-9]{32}$/)).min(1).max(STUDIO_CONVERSATION_MAX_ATTACHMENTS),
  requestId: z.string().uuid().nullable(),
  original: z.boolean(),
});

export async function readMobileStudioPhotos(
  actor: { userId: string; projectId: string },
  search: URLSearchParams,
  dependencies: { execute?: typeof query; read?: typeof readConversationReferencePreviews } = {},
) {
  const input = readInput.safeParse({
    assetIds: search.getAll('asset'),
    requestId: search.get('requestId'),
    original: search.get('original') === '1',
  });
  if (!input.success || (input.data.original && input.data.assetIds.length !== 1))
    throw new SyntaxError('Invalid photo reference.');
  const { requestId, original } = input.data;
  const kind = search.get('view') === 'video-previews' ? 'video' : 'image';
  if (kind === 'video' && !requestId) throw new SyntaxError('Select a video from a Studio turn.');
  const assetIds = [...new Set(input.data.assetIds)];
  if (requestId) {
    const execute = dependencies.execute ?? query;
    const rows = await execute<{ assets: string[] }>(`SELECT ARRAY(
      SELECT jsonb_array_elements_text(turn.input_json->'references') WHERE $4 = 'image'
      UNION SELECT attachment->>'assetId'
        FROM jsonb_array_elements(turn.input_json->'attachments') attachment
        WHERE attachment->>'type'='asset' AND attachment->>'kind'=$4
    ) AS assets FROM (
      SELECT input_json FROM studio_image_turns WHERE user_id=$1 AND project_id=$2 AND request_id=$3
      UNION ALL SELECT input_json FROM studio_tasks WHERE user_id=$1 AND project_id=$2 AND segment_request_id=$3
    ) turn`, [actor.userId, actor.projectId, requestId, kind]);
    if (!rows.some(row => assetIds.every(assetId => row.assets.includes(assetId))))
      throw new MobileHttpError('REFERENCE_UNAVAILABLE', 404, 'This Studio attachment is unavailable.');
  }
  const read = dependencies.read ?? readConversationReferencePreviews;
  const results = await read(actor, { refs: assetIds.map(assetId => ({ type: 'asset', assetId, kind })) });
  const items = results.map((asset): StudioPhotoRead => 'mediaAccessError' in asset
    ? { assetId: asset.assetId, state: 'unavailable' }
    : {
        assetId: asset.assetId,
        state: 'ready',
        ...(asset.name ? { name: asset.name } : {}),
        ...(asset.thumbUrl ? { thumbnail: asset.thumbUrl } : {}),
        ...((original || (kind === 'video' && !asset.thumbUrl)) ? { original: asset.url } : {}),
      });
  return { projectId: actor.projectId, requestId, items };
}
