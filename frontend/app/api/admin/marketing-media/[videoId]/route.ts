import { NextRequest } from 'next/server';
import { requireAdmin } from '@/server/admin';
import { marketingMediaEnabled } from '@/server/marketing-media/store';
import { deleteMarketingVideo } from '@/server/marketing-media/manage';
import { marketingApiError, marketingJson } from '@/server/marketing-media/api';
import { revalidateMarketingPublication } from '@/server/marketing-media/revalidate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function DELETE(req: NextRequest, props: { params: Promise<{ videoId: string }> }) {
  try {
    await requireAdmin(req);
    if (!marketingMediaEnabled())
      return marketingJson({ ok: false, error: 'Marketing media activation is pending.' }, 503);
    const { videoId } = await props.params;
    if (!(await deleteMarketingVideo(videoId)))
      return marketingJson({ ok: false, error: 'Marketing media not found.' }, 404);
    await revalidateMarketingPublication(videoId);
    return marketingJson({ ok: true });
  } catch (error) {
    return marketingApiError(error);
  }
}
