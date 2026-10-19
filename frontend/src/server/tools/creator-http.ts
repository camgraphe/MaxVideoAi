import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { getRouteAuthContext } from '@/lib/supabase-ssr';
import { getActiveAccountRestriction } from '@/server/fraud-cleanup';
import { requireCurrentWebPricingPolicy } from '@/server/pricing/web-pricing-policy';
import { AgentApiError, toAgentApiFailure } from '@/server/agent-api/errors';
import type { ToolboxGenerationActor } from '@/server/agent-api/generation-actor';
import { isCreatorExecutionEnabled } from './creator-availability';

export const CREATOR_PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store' };
const errors: Record<string, number> = {
  SUBTITLE_NOT_FOUND: 404, SUBTITLE_OPERATION_NOT_FOUND: 404, SUBTITLE_TOOL_UNAVAILABLE: 503,
  SUBTITLE_QUOTE_EXPIRED: 409, SUBTITLE_REVISION_CONFLICT: 409, SUBTITLE_REQUEST_CONFLICT: 409,
  SUBTITLE_SOURCE_CHANGED: 409, SUBTITLE_SOURCE_HAS_NO_AUDIO: 422, SUBTITLE_VISUAL_BACKGROUND_REQUIRED: 422,
  SUBTITLE_DOCUMENT_EMPTY: 422, SUBTITLE_CONFIRMATION_REQUIRED: 422, SUBTITLE_PRICING_UNAVAILABLE: 503,
  SUBTITLE_WORKER_UNAVAILABLE: 503, TOOL_PRICING_UNAVAILABLE: 503, INSUFFICIENT_FUNDS: 402, CURRENCY_MISMATCH: 409,
  SUBTITLE_SEQUENCE_CHANGED: 409, STUDIO_SEQUENCE_CONFLICT: 409,
  SUBTITLE_SEQUENCE_SOURCE_REQUIRED: 422, SUBTITLE_MIX_TRANSITION_UNSUPPORTED: 422,
};
export function creatorHttpFailure(error: unknown): NextResponse {
  if (error instanceof AgentApiError) {
    const status = error.code === 'AUTH_REQUIRED' ? 401 : error.code === 'ACCOUNT_RESTRICTED' ? 403
      : error.code === 'INSUFFICIENT_FUNDS' ? 402 : error.code === 'RATE_LIMITED' ? 429
        : error.code === 'ENGINE_UNAVAILABLE' ? 503 : error.code.startsWith('QUOTE_') ? 409 : 422;
    return NextResponse.json(toAgentApiFailure(error), { status, headers: CREATOR_PRIVATE_HEADERS });
  }
  const code = error instanceof ZodError || error instanceof SyntaxError ? 'PARAMETER_INVALID'
    : error instanceof Error && Object.hasOwn(errors, error.message) ? error.message : 'TOOL_OPERATION_FAILED';
  return NextResponse.json({ ok: false, error: { code, message: code === 'TOOL_OPERATION_FAILED'
    ? 'The operation could not complete. Please retry or check its status.' : code } },
  { status: errors[code] ?? 422, headers: CREATOR_PRIVATE_HEADERS });
}
export async function readCreatorJson(request: NextRequest): Promise<unknown> {
  const limit = 2_000_000;
  const tooLarge = () => new AgentApiError('PARAMETER_INVALID', 'The request is too large.');
  if (Number(request.headers.get('content-length')) > limit) throw tooLarge();
  const reader = request.body?.getReader();
  if (!reader) throw new SyntaxError('Missing body');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw tooLarge(); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
export async function runCreatorHttp(
  request: NextRequest,
  action: (actor: ToolboxGenerationActor) => Promise<unknown>,
  options: { execution?: boolean; charge?: boolean } = {},
): Promise<NextResponse> {
  try {
    if (options.execution && !isCreatorExecutionEnabled()) {
      return NextResponse.json({ ok: false }, { status: 404, headers: CREATOR_PRIVATE_HEADERS });
    }
    if (!['GET', 'HEAD'].includes(request.method)) {
      const origin = request.headers.get('origin');
      if (request.headers.get('sec-fetch-site') === 'cross-site' || (origin && origin !== request.nextUrl.origin)) {
        return NextResponse.json({ ok: false }, { status: 403, headers: CREATOR_PRIVATE_HEADERS });
      }
    }
    const { userId } = await getRouteAuthContext(request);
    if (!userId) return NextResponse.json({ ok: false }, { status: 401, headers: CREATOR_PRIVATE_HEADERS });
    if (options.charge) {
      const policy = requireCurrentWebPricingPolicy(request, 'tool');
      if (policy) { Object.entries(CREATOR_PRIVATE_HEADERS).forEach(([key, value]) => policy.headers.set(key, value)); return policy; }
    }
    if (options.execution && await getActiveAccountRestriction(userId)) {
      throw new AgentApiError('ACCOUNT_RESTRICTED', 'This account cannot run paid tools.');
    }
    const result = await action({ authMethod: 'toolbox-session', userId, clientId: null });
    return result instanceof NextResponse ? result : NextResponse.json({ ok: true, ...Object(result) }, { headers: CREATOR_PRIVATE_HEADERS });
  } catch (error) { return creatorHttpFailure(error); }
}
