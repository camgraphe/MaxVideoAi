import { NextRequest, NextResponse } from 'next/server';
import { isDatabaseConfigured } from '@/lib/db';
import { ensureBillingSchema } from '@/lib/schema';
import { listGalleryVideos, type GalleryTab } from '@/server/videos';

export const dynamic = 'force-dynamic';

function parseTab(value: string | null): GalleryTab {
  if (value === 'starter' || value === 'trending') return value;
  return 'latest';
}

export async function GET(req: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: 'Database unavailable' }, { status: 503 });
  }

  try {
    await ensureBillingSchema();
    const url = new URL(req.url);
    const tab = parseTab(url.searchParams.get('tab'));
    const limit = Math.min(60, Math.max(1, Number(url.searchParams.get('limit') ?? '24')));
    const videos = await listGalleryVideos(tab, limit);
    return NextResponse.json({ ok: true, videos });
  } catch (error) {
    console.error('[api/gallery] failed', error);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}
