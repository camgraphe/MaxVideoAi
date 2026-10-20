import { NextRequest } from 'next/server';
import { z } from 'zod';
import { subtitleRepository } from '@/server/subtitles/repository';
import { toolAssetRefSchema } from '@/lib/toolbox/contract';
import { runCreatorHttp } from '@/server/tools/creator-http';
export const runtime = 'nodejs';
export async function GET(request: NextRequest) {
  return runCreatorHttp(request, async actor => {
    const source = request.nextUrl.searchParams.get('source');
    if (source && source.length > 2048) throw new Error('SUBTITLE_SOURCE_INVALID');
    const sequence = request.nextUrl.searchParams.get('sequence');
    const limit = request.nextUrl.searchParams.get('limit');
    const pageSize = limit ? z.coerce.number().int().min(1).max(49).parse(limit) : 30;
    const cursor = request.nextUrl.searchParams.get('cursor');
    const before = cursor ? z.object({ updatedAt: z.string().datetime(), id: z.string().min(1).max(200) }).strict()
      .parse(JSON.parse(Buffer.from(z.string().max(1024).parse(cursor), 'base64url').toString('utf8'))) : undefined;
    const rows = await subtitleRepository.list(actor.userId, {
      source: source ? toolAssetRefSchema.parse(JSON.parse(source)) : undefined,
      sequenceId: sequence ? z.string().min(1).max(200).parse(sequence) : undefined,
      limit: pageSize + 1, before,
    });
    const documents = rows.slice(0, pageSize), last = documents.at(-1), hasMore = rows.length > pageSize;
    return { documents, hasMore, nextCursor: hasMore && last
      ? Buffer.from(JSON.stringify({ updatedAt: last.updatedAt, id: last.id })).toString('base64url') : null };
  });
}
