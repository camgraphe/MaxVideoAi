import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/server/admin';
import { listLegalDocuments } from '@/lib/legal';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
  } catch (response) {
    if (response instanceof Response) return response;
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  const documents = await listLegalDocuments();
  const mode = (process.env.LEGAL_RECONSENT_MODE ?? 'soft').toLowerCase();
  const graceDays = Number.parseInt(process.env.LEGAL_RECONSENT_GRACE_DAYS ?? '14', 10);

  return NextResponse.json({
    ok: true,
    documents: documents.map((doc) => ({
      key: doc.key,
      title: doc.title,
      version: doc.version,
      url: doc.url,
      publishedAt: doc.publishedAt ? doc.publishedAt.toISOString() : null,
    })),
    reconsent: {
      mode: mode === 'hard' ? 'hard' : 'soft',
      graceDays: Number.isNaN(graceDays) ? 0 : graceDays,
    },
  });
}
