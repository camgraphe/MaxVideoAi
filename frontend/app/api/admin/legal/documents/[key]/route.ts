import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/server/admin';
import { isLegalDocumentKey, listLegalDocuments } from '@/lib/legal';
import { query } from '@/lib/db';

export const runtime = 'nodejs';

type UpdateBody = {
  version?: string;
  title?: string;
  url?: string;
  publishedAt?: string | null;
};

export async function POST(req: NextRequest, { params }: { params: { key: string } }) {
  try {
    await requireAdmin(req);
  } catch (response) {
    if (response instanceof Response) return response;
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  const key = params.key;
  if (!isLegalDocumentKey(key)) {
    return NextResponse.json({ ok: false, error: 'Invalid document key' }, { status: 400 });
  }

  let body: UpdateBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON payload' }, { status: 400 });
  }

  const version = (body.version ?? '').trim();
  if (!version) {
    return NextResponse.json({ ok: false, error: 'version is required' }, { status: 400 });
  }

  const title = body.title?.trim();
  const url = body.url?.trim();
  const publishedAt = body.publishedAt ? new Date(body.publishedAt) : new Date();
  if (Number.isNaN(publishedAt.getTime())) {
    return NextResponse.json({ ok: false, error: 'Invalid publishedAt value' }, { status: 400 });
  }

  try {
    await query(
      `UPDATE legal_documents
       SET version = $2,
           title = COALESCE($3, title),
           url = COALESCE($4, url),
           published_at = $5
       WHERE key = $1`,
      [key, version, title ?? null, url ?? null, publishedAt]
    );

    const documents = await listLegalDocuments();
    const updated = documents.find((doc) => doc.key === key);

    return NextResponse.json({
      ok: true,
      document: updated
        ? {
            key: updated.key,
            version: updated.version,
            title: updated.title,
            url: updated.url,
            publishedAt: updated.publishedAt ? updated.publishedAt.toISOString() : null,
          }
        : null,
    });
  } catch (error) {
    console.error('[admin-legal] update failed', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to update legal document' },
      { status: 500 }
    );
  }
}
