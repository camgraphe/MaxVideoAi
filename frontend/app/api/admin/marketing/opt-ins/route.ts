import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/server/admin';
import { isDatabaseConfigured } from '@/lib/db';
import { fetchMarketingOptIns } from '@/server/admin-marketing';

export const runtime = 'nodejs';

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  const stringValue = String(value);
  if (stringValue.includes('"') || stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('\r')) {
    return '"' + stringValue.replace(/"/g, '""') + '"';
  }
  return stringValue;
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
  } catch (response) {
    if (response instanceof Response) return response;
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: 'Database unavailable' }, { status: 503 });
  }

  try {
    const records = await fetchMarketingOptIns();
    const total = records.length;
    const format = req.nextUrl.searchParams.get('format');

    if (format === 'csv') {
      const header = ['email', 'user_id', 'opted_in_at'];
      const lines = [header.join(',')];
      for (const record of records) {
        lines.push(
          [csvEscape(record.email ?? ''), csvEscape(record.userId), csvEscape(record.optedInAt ?? '')].join(',')
        );
      }
      const csv = lines.join('\r\n');
      const filename = `marketing-opt-ins-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
      return new Response(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    return NextResponse.json({ ok: true, total, records });
  } catch (error) {
    console.error('[admin-marketing-optins] failed', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to load marketing opt-ins' },
      { status: 500 }
    );
  }
}
