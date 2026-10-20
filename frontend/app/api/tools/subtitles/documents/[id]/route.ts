import { NextRequest } from 'next/server';
import { z } from 'zod';
import { subtitleRepository } from '@/server/subtitles/repository';
import { readCreatorJson, runCreatorHttp } from '@/server/tools/creator-http';
import { resolveStudioMedia } from '@/server/studio/media-resolver';
import { createConversationMediaReadAccess } from '@/server/studio/conversation-media-read-access';
export const runtime = 'nodejs';
type Props = { params: Promise<{ id: string }> };
const documentId = z.string().min(1).max(200).regex(/^[a-zA-Z0-9._:-]+$/);
export async function GET(request: NextRequest, props: Props) {
  return runCreatorHttp(request, async actor => {
    const revision = request.nextUrl.searchParams.get('revision');
    const document = await subtitleRepository.read(actor.userId, documentId.parse((await props.params).id),
      revision === null ? undefined : z.coerce.number().int().positive().parse(revision));
    if (!document) throw new Error('SUBTITLE_NOT_FOUND');
    let sourceMedia: { url: string; thumbnailUrl?: string; name?: string; expiresAt: string | null } | null = null;
    try {
      const media = await resolveStudioMedia(actor.userId, document.source.ref);
      const access = await createConversationMediaReadAccess(actor.userId, media);
      sourceMedia = { url: access.url, thumbnailUrl: access.thumbnailAccessUrl, name: media.originalName, expiresAt: access.expires };
    } catch { /* Saved text remains editable when its original was removed or cannot be read. */ }
    return { document, sourceMedia };
  });
}
export async function PATCH(request: NextRequest, props: Props) {
  return runCreatorHttp(request, async actor => {
    const input = z.object({ expectedRevision: z.number().int().positive(), requestId: z.string().uuid(), change: z.unknown() }).strict().parse(await readCreatorJson(request));
    return { document: await subtitleRepository.update(actor.userId, documentId.parse((await props.params).id),
      input.expectedRevision, input.requestId, input.change) };
  });
}
