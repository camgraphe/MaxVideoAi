import { NextRequest, NextResponse } from 'next/server';
import { isDatabaseConfigured, query } from '@/lib/db';
import { ensureBillingSchema } from '@/lib/schema';
import { requireAdmin, adminErrorToResponse } from '@/server/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(req: NextRequest, { params }: { params: { videoId: string } }) {
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

  await ensureBillingSchema();

  await query('BEGIN');
  try {
    await query(`DELETE FROM playlist_items WHERE video_id = $1`, [videoId]);
    await query(`UPDATE homepage_sections SET video_id = NULL WHERE video_id = $1`, [videoId]);

    const result = await query<{ job_id: string }>(
      `UPDATE app_jobs
         SET visibility = 'private',
             indexable = FALSE,
             featured = FALSE,
             video_url = NULL,
             thumb_url = NULL,
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

    if (!result.length) {
      await query('ROLLBACK');
      return NextResponse.json({ ok: false, error: 'Video not found' }, { status: 404 });
    }

    await query('COMMIT');
    return NextResponse.json({ ok: true });
  } catch (error) {
    await query('ROLLBACK').catch(() => undefined);
    console.error('[admin/videos] failed to delete video', error);
    return NextResponse.json({ ok: false, error: 'Failed to delete video' }, { status: 500 });
  }
}
