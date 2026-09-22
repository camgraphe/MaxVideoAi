import {retryEditorialChecks} from '@/server/editorial/checks';
import { NextRequest, NextResponse } from 'next/server';
import { AdminAuthError, requireAdmin } from '@/server/admin';
import { requestEditorialPublication, retryEditorialPublication } from '@/server/editorial/publication-queue';
import { approveEditorialVersion } from '@/server/editorial/repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: Promise<{ articleId: string }> }) {
  const origin = request.headers.get('origin');
  let originHost: string | null = null;
  try { originHost = origin ? new URL(origin).host : null; } catch { /* Invalid origin */ }
  if (!originHost || originHost !== request.nextUrl.host) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  let actor: string;
  try {
    actor = await requireAdmin(request);
  } catch (error) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: error instanceof AdminAuthError ? error.status : 500 });
  }
  const { articleId } = await params;
  let input: { version?: unknown; digest?: unknown; intent?: unknown };
  try { input = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (!Number.isInteger(input.version) || Number(input.version) < 1 || typeof input.digest !== 'string' || !/^[a-f0-9]{64}$/.test(input.digest)) {
    return NextResponse.json({ error: 'Invalid approval target' }, { status: 400 });
  }
  try {
    if (input.intent === 'retry-checks') {
      await retryEditorialChecks(articleId, Number(input.version), input.digest, actor);
      return NextResponse.json({ ok: true, published: false });
    }
    if (input.intent === 'publish' || input.intent === 'retry-publication') {
      if (process.env.EDITORIAL_PUBLICATION_ENABLED !== '1') return NextResponse.json({ error: 'Automatic publication is not enabled.' }, { status: 503 });
      const publication = await (input.intent === 'retry-publication' ? retryEditorialPublication : requestEditorialPublication)({ articleId, version: Number(input.version), digest: input.digest, actor });
      return NextResponse.json({ ok: true, publication, published: publication.status === 'published' });
    }
    if (input.intent !== undefined) return NextResponse.json({ error: 'Invalid approval intent' }, { status: 400 });
    await approveEditorialVersion({ articleId, version: Number(input.version), digest: input.digest, actor });
    return NextResponse.json({ ok: true, published: false });
  } catch (error) {
    if (error instanceof Error && /not found|not the latest|already approved|incomplete|correction requires|correction|checks|exact version|no longer valid/.test(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error('[editorial-approval] failed', error);
    return NextResponse.json({ error: 'Approval failed' }, { status: 500 });
  }
}
