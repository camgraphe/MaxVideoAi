import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { authorizeEditorialIngest, ingestEditorialDraft } from '@/server/editorial/ingest';
import { saveEditorialChecks } from '@/server/editorial/checks';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const MAX_BODY_BYTES = 1_000_000;

export async function POST(request: NextRequest) {
  if (!authorizeEditorialIngest(request.headers.get('authorization'), process.env.EDITORIAL_INGEST_TOKEN ?? null)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  if (process.env.EDITORIAL_DRAFT_MEDIA_PRIVATE_CONFIRMED !== '1') {
    return NextResponse.json({ ok: false, error: 'Private draft media policy is not confirmed' }, { status: 503 });
  }
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > MAX_BODY_BYTES) return NextResponse.json({ ok: false, error: 'Payload too large' }, { status: 413 });
  const body = await request.text();
  if (Buffer.byteLength(body) > MAX_BODY_BYTES) return NextResponse.json({ ok: false, error: 'Payload too large' }, { status: 413 });
  let input: unknown;
  try {
    input = JSON.parse(body);
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }
  try {
    if (typeof input === 'object' && input !== null && 'action' in input && input.action === 'record-checks') {
      const target = z.object({ action: z.literal('record-checks'), articleId: z.string().uuid(), version: z.number().int().positive(), digest: z.string().regex(/^[a-f0-9]{64}$/), report: z.unknown() }).strict().parse(input);
      const checks = await saveEditorialChecks(target.articleId, target.version, target.digest, target.report, 'n8n-editorial-checks');
      return NextResponse.json({ ok: true, ...checks, published: false });
    }
    const version = await ingestEditorialDraft(input, 'n8n-editorial');
    return NextResponse.json({ ok: true, ...version, previewPath: `/admin/editorial/${version.articleId}?version=${version.version}` }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ ok: false, error: 'Invalid editorial draft', issues: error.issues }, { status: 400 });
    }
    if (error instanceof Error && /run key|published slug|topic key|canonical slug/i.test(error.message)) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 409 });
    }
    console.error('[editorial-ingest] rejected', error);
    return NextResponse.json({ ok: false, error: 'Draft ingestion failed' }, { status: 422 });
  }
}
