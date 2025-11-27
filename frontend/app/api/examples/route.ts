import { NextRequest, NextResponse } from 'next/server';
import { isDatabaseConfigured } from '@/lib/db';
import { ensureBillingSchema } from '@/lib/schema';
import { listExamples, type ExampleSort } from '@/server/videos';

export const dynamic = 'force-dynamic';

function parseSort(raw: string | null): ExampleSort {
  switch (raw) {
    case 'date-asc':
    case 'duration-asc':
    case 'duration-desc':
    case 'engine-asc':
      return raw;
    case 'date-desc':
    default:
      return 'date-desc';
  }
}

export async function GET(req: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: 'Database unavailable' }, { status: 503 });
  }

  try {
    await ensureBillingSchema();
    const url = new URL(req.url);
    const sort = parseSort(url.searchParams.get('sort'));
    const limit = Math.min(120, Math.max(1, Number(url.searchParams.get('limit') ?? '60')));
    const videos = await listExamples(sort, limit);
    return NextResponse.json({ ok: true, videos });
  } catch (error) {
    console.error('[api/examples] failed', error);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}
