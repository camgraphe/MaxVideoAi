import { NextResponse } from 'next/server';
import { isDatabaseConfigured } from '@/lib/db';
import { ensureBillingSchema } from '@/lib/schema';
import { listExamples } from '@/server/videos';

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
    const videos = await listExamples('date-desc', 5000);

    const urls = videos
      .filter((video) => Boolean(video.videoUrl))
      .map((video) => {
        const loc = `https://maxvideoai.com/video/${encodeURIComponent(video.id)}`;
        const summary = video.prompt.replace(/\s+/g, ' ').trim();
        const description = summary.length > 280 ? `${summary.slice(0, 279)}…` : summary;
        const duration = Math.max(0, Math.floor(video.durationSec ?? 0));
        const publicationDate = new Date(video.createdAt).toISOString();
        const thumbUrl = video.thumbUrl ?? video.videoUrl ?? loc;
        const keywords = [video.engineLabel, video.aspectRatio ?? 'auto', 'MaxVideoAI']
          .map((keyword) => `<video:tag>${escapeXml(keyword)}</video:tag>`)
          .join('');

        const parts = [
          '<url>',
          `<loc>${loc}</loc>`,
          '<video:video>',
          `<video:thumbnail_loc>${escapeXml(thumbUrl)}</video:thumbnail_loc>`,
          `<video:title>${escapeXml(`${video.engineLabel} · ${duration}s`)}</video:title>`,
          `<video:description>${escapeXml(description)}</video:description>`,
          `<video:content_loc>${escapeXml(video.videoUrl ?? loc)}</video:content_loc>`,
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
