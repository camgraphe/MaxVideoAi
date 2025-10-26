import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { isDatabaseConfigured, query } from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/user';

export const runtime = 'nodejs';

type ConsentRecord = {
  doc_key: string;
  doc_version: string;
  accepted: boolean;
  accepted_at: Date;
  ip: string | null;
  user_agent: string | null;
  locale: string | null;
  source: string | null;
};

export async function GET(req: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: 'Database unavailable' }, { status: 503 });
  }

  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const rows = await query<ConsentRecord>(
      `SELECT doc_key, doc_version, accepted, accepted_at, ip::text, user_agent, locale, source
       FROM user_consents
       WHERE user_id = $1
       ORDER BY accepted_at DESC`,
      [userId]
    );
    return NextResponse.json({
      ok: true,
      consents: rows.map((row) => ({
        docKey: row.doc_key,
        docVersion: row.doc_version,
        accepted: row.accepted,
        acceptedAt: row.accepted_at.toISOString(),
        ip: row.ip,
        userAgent: row.user_agent,
        locale: row.locale,
        source: row.source,
      })),
    });
  } catch (error) {
    console.error('[account-consents] query failed', error);
    return NextResponse.json({ ok: false, error: 'Unable to load consent history' }, { status: 500 });
  }
}
