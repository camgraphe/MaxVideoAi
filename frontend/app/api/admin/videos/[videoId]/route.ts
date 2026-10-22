import { deleteMarketingVideo } from '@/server/marketing-media/manage';
import { MarketingMediaError } from '@/server/marketing-media/snapshot';
import { NextRequest, NextResponse } from 'next/server';
import { isDatabaseConfigured, withDbTransaction } from '@/lib/db';
import { ensureBillingSchema } from '@/lib/schema';
import { requireAdmin, adminErrorToResponse } from '@/server/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(req: NextRequest, props: { params: Promise<{ videoId: string }> }) {
  const params = await props.params;
  try {
    await requireAdmin(req);
  } catch (error) {
    return adminErrorToResponse(error);
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: 'Database unavailable' }, { status: 503 });
  }

  const videoId = typeof params.videoId === 'string' ? params.videoId.trim() : '';
  if (!videoId) {
    return NextResponse.json({ ok: false, error: 'Missing videoId' }, { status: 400 });
  }

  try {
    if (await deleteMarketingVideo(videoId)) return NextResponse.json({ ok: true });
    await ensureBillingSchema();
    const removed = await withDbTransaction(async (executor) => {
      const owned = await executor.query<{ job_id: string }>(
        'SELECT job_id FROM app_jobs WHERE job_id = $1 FOR UPDATE', [videoId],
      );
      if (!owned.length) return false;
      await executor.query(`DELETE FROM playlist_items WHERE video_id = $1`, [videoId]);
      await executor.query(`UPDATE homepage_sections SET video_id = NULL WHERE video_id = $1`, [videoId]);

      const result = await executor.query<{ job_id: string }>(
        `UPDATE app_jobs
         SET visibility = 'private',
             indexable = FALSE,
             featured = FALSE,
             video_url = NULL,
             thumb_url = '',
             preview_frame = NULL,
             updated_at = NOW(),
             message = CASE
               WHEN message IS NULL OR message = '' THEN '[admin] Video removed via moderation'
               ELSE message || '\n[admin] Video removed via moderation'
             END
       WHERE job_id = $1
       RETURNING job_id`,
        [videoId]
      );
      if (result.length !== 1) throw new Error('Locked video was not updated');
      return true;
    });

    if (!removed) {
      return NextResponse.json({ ok: false, error: 'Video not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof MarketingMediaError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    console.error('[admin/videos] failed to delete video', error);
    return NextResponse.json({ ok: false, error: 'Failed to delete video' }, { status: 500 });
  }
}
