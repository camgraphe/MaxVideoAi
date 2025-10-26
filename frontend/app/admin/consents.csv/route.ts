import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/server/admin';
import { isDatabaseConfigured, query } from '@/lib/db';

export const runtime = 'nodejs';

type ConsentRow = {
  user_id: string;
  doc_key: string;
  doc_version: string;
  accepted: boolean;
  accepted_at: Date;
  ip: string | null;
  user_agent: string | null;
  locale: string | null;
  source: string | null;
};

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const dt = new Date(value);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

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

  const url = new URL(req.url);
  const fromParam = url.searchParams.get('from');
  const toParam = url.searchParams.get('to');
  const docKey = url.searchParams.get('doc');

  const fromDate = parseDate(fromParam);
  const toDate = parseDate(toParam);

  try {
    const rows = await query<ConsentRow>(
      `SELECT user_id, doc_key, doc_version, accepted, accepted_at, ip::text, user_agent, locale, source
       FROM user_consents
       WHERE ($1::timestamptz IS NULL OR accepted_at >= $1)
         AND ($2::timestamptz IS NULL OR accepted_at <= $2)
         AND ($3::text IS NULL OR doc_key = $3)
       ORDER BY accepted_at DESC`,
      [fromDate, toDate, docKey?.trim() || null]
    );

    const header = ['user_id', 'doc_key', 'doc_version', 'accepted', 'accepted_at', 'ip', 'user_agent', 'locale', 'source'];
    const lines = [header.join(',')];
    for (const row of rows) {
      lines.push(
        [
          csvEscape(row.user_id),
          csvEscape(row.doc_key),
          csvEscape(row.doc_version),
          csvEscape(row.accepted),
          csvEscape(row.accepted_at.toISOString()),
          csvEscape(row.ip),
          csvEscape(row.user_agent),
          csvEscape(row.locale),
          csvEscape(row.source),
        ].join(',')
      );
    }
    const csv = lines.join('\r\n');
    const filename = `consents-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;

    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[admin-consents-csv] export failed', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to export consents' },
      { status: 500 }
    );
  }
}
