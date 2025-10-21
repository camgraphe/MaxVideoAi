import { NextResponse } from 'next/server';
import { isDatabaseConfigured, query } from '@/lib/db';
import { ensureBillingSchema } from '@/lib/schema';

type SitemapRow = {
  job_id: string;
  thumb_url: string | null;
  video_url: string | null;
  engine_label: string;
  aspect_ratio: string | null;
  duration_sec: number;
  prompt: string;
  created_at: string;
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET() {
  if (!isDatabaseConfigured()) {
    return new NextResponse('Database unavailable', { status: 503 });
  }

  try {
    await ensureBillingSchema();
    const rows = await query<SitemapRow>(
      `
        SELECT job_id, thumb_url, video_url, engine_label, aspect_ratio, duration_sec, prompt, created_at
        FROM app_jobs
        WHERE visibility = 'public'
          AND indexable IS TRUE
        ORDER BY created_at DESC
        LIMIT 5000
      `
    );

    const urls = rows
      .map((row) => {
        const loc = `https://maxvideoai.com/v/${encodeURIComponent(row.job_id)}`;
        const summary = row.prompt.replace(/\s+/g, ' ').trim();
        const description = summary.length > 280 ? `${summary.slice(0, 279)}…` : summary;
        const duration = Math.max(0, Math.floor(row.duration_sec));
        const publicationDate = new Date(row.created_at).toISOString();
        const thumbUrl = row.thumb_url ?? row.video_url ?? loc;
        const keywords = [row.engine_label, row.aspect_ratio ?? 'auto', 'MaxVideoAI']
          .map((keyword) => `<video:tag>${escapeXml(keyword)}</video:tag>`)
          .join('');

        const parts = [
          '<url>',
          `<loc>${loc}</loc>`,
          '<video:video>',
          `<video:thumbnail_loc>${escapeXml(thumbUrl)}</video:thumbnail_loc>`,
          `<video:title>${escapeXml(`${row.engine_label} · ${duration}s`)}</video:title>`,
          `<video:description>${escapeXml(description)}</video:description>`,
          `<video:content_loc>${escapeXml(row.video_url ?? loc)}</video:content_loc>`,
          `<video:publication_date>${escapeXml(publicationDate)}</video:publication_date>`,
          `<video:duration>${duration}</video:duration>`,
          keywords,
          '</video:video>',
          '</url>',
        ];

        return parts.join('');
      })
      .join('');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
${urls}
</urlset>`;

    return new NextResponse(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      },
    });
  } catch (error) {
    console.error('[sitemap-video] failed', error);
    return new NextResponse('Server error', { status: 500 });
  }
}
