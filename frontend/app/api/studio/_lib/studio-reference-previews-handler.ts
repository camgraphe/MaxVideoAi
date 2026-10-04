import type {NextRequest} from 'next/server';
import {resolveStudioApiAccess} from '@/server/studio/access';
import {conversationReferencePreviewsSchema} from '@/lib/studio/conversation-reference-previews';
import {readConversationReferencePreviews} from '@/server/studio/conversation-reference-previews';
import {studioJson} from './studio-route-utils';

export async function handleStudioReferencePreviews(req: NextRequest, projectId: string, dependencies: {
  enabled?: boolean;
  resolveAccess?: typeof resolveStudioApiAccess;
  read?: typeof readConversationReferencePreviews;
} = {}) {
  const access = await (dependencies.resolveAccess ?? resolveStudioApiAccess)(req);
  if (!access.ok) return studioJson({ok: false, error: access.error}, {status: access.status});
  if (!(dependencies.enabled ?? process.env.STUDIO_IMAGE_CONVERSATION_ENABLED === 'true')) return studioJson({ok: false, error: 'STUDIO_IMAGE_PILOT_UNAVAILABLE'}, {status: 404});
  if (!projectId || projectId.length > 128 || projectId !== projectId.trim()) return studioJson({ok: false, error: 'INVALID_PROJECT'}, {status: 400});
  if (req.headers.get('origin') !== req.nextUrl.origin || req.headers.get('sec-fetch-site') === 'cross-site') return studioJson({ok: false, error: 'SAME_ORIGIN_REQUIRED'}, {status: 403});
  try {
    const reader = req.body?.getReader();
    if (!reader) return studioJson({ok: false, error: 'INVALID_REQUEST'}, {status: 400});
    let size = 0;
    const chunks: Uint8Array[] = [];
    try {
      while (true) {
        const next = await reader.read();
        if (next.done) break;
        size += next.value.byteLength;
        if (size > 12000) {await reader.cancel(); return studioJson({ok: false, error: 'BODY_TOO_LARGE'}, {status: 413});}
        chunks.push(next.value);
      }
    } finally {reader.releaseLock();}
    const parsed = conversationReferencePreviewsSchema.safeParse(JSON.parse(Buffer.concat(chunks).toString('utf8')));
    if (!parsed.success) return studioJson({ok: false, error: 'INVALID_REQUEST'}, {status: 400});
    const assets = await (dependencies.read ?? readConversationReferencePreviews)({userId: access.userId, projectId}, parsed.data);
    return studioJson({ok: true, assets});
  } catch (error) {
    if (error instanceof SyntaxError) return studioJson({ok: false, error: 'INVALID_REQUEST'}, {status: 400});
    const missing = error instanceof Error && ['STUDIO_PROJECT_NOT_FOUND', 'MEDIA_NOT_AVAILABLE'].includes(error.message);
    return studioJson({ok: false, error: missing ? error.message : 'STUDIO_REFERENCE_PREVIEW_UNAVAILABLE'}, {status: missing ? 404 : 503});
  }
}
