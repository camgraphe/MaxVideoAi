import { getResolvedVideoSeoEditorialEntryByIdentifier } from '@/server/video-seo-editorial';
import { NextRequest } from 'next/server';
import { requireAdmin } from '@/server/admin';
import { marketingMediaEnabled } from '@/server/marketing-media/store';
import { listMarketingMedia } from '@/server/marketing-media/list';
import { promoteMarketingVideo } from '@/server/marketing-media/copy';
import { marketingApiError, marketingJson } from '@/server/marketing-media/api';
import { revalidateMarketingPublication } from '@/server/marketing-media/revalidate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 240;
export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    if (!marketingMediaEnabled())
      return marketingJson({ ok: false, error: 'Marketing media activation is pending.' }, 503);
    return marketingJson({
      ok: true,
      ...(await listMarketingMedia(Number(req.nextUrl.searchParams.get('offset') ?? 0))),
    });
  } catch (error) {
    return marketingApiError(error);
  }
}
export async function POST(req: NextRequest) {
  try {
    const actorId = await requireAdmin(req);
    if (!marketingMediaEnabled())
      return marketingJson({ ok: false, error: 'Marketing media activation is pending.' }, 503);
    const body = await req.json().catch(() => null);
    if (typeof body?.videoId !== 'string') return marketingJson({ ok: false, error: 'Choose a video ID.' }, 400);
    const requestedId = body.videoId.trim();
    const editorial = await getResolvedVideoSeoEditorialEntryByIdentifier(requestedId);
    const item = await promoteMarketingVideo({
      videoId: editorial?.id ?? requestedId,
      actorId,
      permissionConfirmed: body.permissionConfirmed === true,
    });
    await revalidateMarketingPublication(item.videoId);
    return marketingJson({ ok: true, item });
  } catch (error) {
    return marketingApiError(error);
  }
}
