import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { subtitleRepository } from '@/server/subtitles/repository';
import { serializeSubtitles } from '@/lib/subtitles/serialize';
import { CREATOR_PRIVATE_HEADERS, runCreatorHttp } from '@/server/tools/creator-http';
export const runtime = 'nodejs';
export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  return runCreatorHttp(request, async actor => {
    const id = z.string().min(1).max(200).regex(/^[a-zA-Z0-9._:-]+$/).parse((await props.params).id);
    const format = z.enum(['srt', 'vtt']).parse(request.nextUrl.searchParams.get('format'));
    const revision = request.nextUrl.searchParams.get('revision');
    const document = await subtitleRepository.read(actor.userId, id, revision === null ? undefined : z.coerce.number().int().positive().parse(revision));
    if (!document) throw new Error('SUBTITLE_NOT_FOUND');
    return new NextResponse(serializeSubtitles(document, format), { headers: { ...CREATOR_PRIVATE_HEADERS,
      'Content-Type': format === 'vtt' ? 'text/vtt; charset=utf-8' : 'application/x-subrip; charset=utf-8',
      'Content-Disposition': `attachment; filename="subtitles-r${document.revision}.${format}"`,
      'X-Content-Type-Options': 'nosniff' } });
  });
}
