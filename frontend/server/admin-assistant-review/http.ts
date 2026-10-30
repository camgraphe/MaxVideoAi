import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin, AdminAuthError } from '@/server/admin';
import { assistantReviewScope, assistantReviewAnnotation, AssistantReviewError, type AssistantReviewScope, type AssistantReviewAnnotation, type AssistantReviewDetail, type Annotation } from './contracts';
import { revealAssistantReview, annotateAssistantReview } from './read-model';

type Dependencies = { authorize(request: NextRequest): Promise<string>; reveal(actor: string, scope: AssistantReviewScope): Promise<AssistantReviewDetail>; annotate(actor: string, input: AssistantReviewAnnotation): Promise<Annotation> };
const defaults: Dependencies = { authorize: requireAdmin, reveal: revealAssistantReview, annotate: annotateAssistantReview };
const json = (value: unknown, status = 200) => NextResponse.json(value, { status, headers: { 'Cache-Control': 'private, no-store, max-age=0', 'X-Content-Type-Options': 'nosniff' } });
export async function handleAssistantReviewRequest(request: NextRequest, deps: Dependencies = defaults) {
  let actor: string;
  try { actor = await deps.authorize(request); }
  catch (error) { return json({ error: 'admin_access_required' }, error instanceof AdminAuthError ? error.status : 403); }
  if (request.headers.get('origin') !== new URL(request.url).origin || request.headers.get('sec-fetch-site') === 'cross-site') return json({ error: 'origin_rejected' }, 403);
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return json({ error: 'invalid_request' }, 400);
  const reader = request.body?.getReader();
  if (!reader) return json({ error: 'invalid_request' }, 400);
  let body = '', bytes = 0; const decoder = new TextDecoder();
  try {
    for (;;) {
      const chunk = await reader.read(); if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 12288) { await reader.cancel(); return json({ error: 'request_too_large' }, 413); }
      body += decoder.decode(chunk.value, { stream: true });
    }
    body += decoder.decode();
    const raw = JSON.parse(body);
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return json({ error: 'invalid_request' }, 400);
    const { action, ...input } = raw;
    if (action === 'reveal') {
      const parsed = assistantReviewScope.safeParse(input);
      if (!parsed.success) return json({ error: 'invalid_request' }, 400);
      return json({ detail: await deps.reveal(actor, parsed.data) });
    }
    if (action === 'annotate') {
      const parsed = assistantReviewAnnotation.safeParse(input);
      if (!parsed.success) return json({ error: 'invalid_request' }, 400);
      return json({ annotation: await deps.annotate(actor, parsed.data) });
    }
    return json({ error: 'invalid_request' }, 400);
  } catch (error) {
    if (error instanceof SyntaxError) return json({ error: 'invalid_request' }, 400);
    if (error instanceof AssistantReviewError) return json({ error: error.code }, error.status);
    return json({ error: 'unavailable' }, 503);
  } finally { reader.releaseLock(); }
}
