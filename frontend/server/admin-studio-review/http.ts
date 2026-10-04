import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdmin, AdminAuthError } from '@/server/admin';
import { reviewScopeSchema, StudioReviewError, type ReviewDetail, type ReviewScope } from './contracts';
import { revealStudioReview } from './read-model';

type Dependencies = { authorize: (request: NextRequest) => Promise<string>; reveal: (actor: string, scope: ReviewScope) => Promise<ReviewDetail> };
const defaults: Dependencies = { authorize: requireAdmin, reveal: revealStudioReview };
const json = (value: unknown, status = 200) => NextResponse.json(value, { status, headers: { 'Cache-Control': 'private, no-store, max-age=0', 'X-Content-Type-Options': 'nosniff' } });

export async function handleStudioReviewRequest(request: NextRequest, dependencies: Dependencies = defaults) {
  let actorId: string;
  try { actorId = await dependencies.authorize(request); }
  catch (error) { return json({ error: 'admin_access_required' }, error instanceof AdminAuthError ? error.status : 403); }
  if (request.headers.get('origin') !== new URL(request.url).origin || request.headers.get('sec-fetch-site') === 'cross-site') return json({ error: 'origin_rejected' }, 403);
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return json({ error: 'invalid_request' }, 400);
  const reader = request.body?.getReader();
  if (!reader) return json({ error: 'invalid_request' }, 400);
  let body = '';
  let bytes = 0;
  const decoder = new TextDecoder();
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 2048) { await reader.cancel(); return json({ error: 'request_too_large' }, 413); }
      body += decoder.decode(chunk.value, { stream: true });
    }
    body += decoder.decode();
    const parsed = reviewScopeSchema.safeParse(JSON.parse(body));
    if (!parsed.success) return json({ error: 'invalid_request' }, 400);
    return json({ detail: await dependencies.reveal(actorId, parsed.data) });
  } catch (error) {
    if (error instanceof SyntaxError) return json({ error: 'invalid_request' }, 400);
    if (error instanceof StudioReviewError) return json({ error: error.code }, error.status);
    return json({ error: 'unavailable' }, 503);
  } finally { reader.releaseLock(); }
}
