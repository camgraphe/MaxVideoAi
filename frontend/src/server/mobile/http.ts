import { MobileHttpError } from './errors';
export { MobileHttpError } from './errors';
import { NextRequest, NextResponse } from 'next/server';
import { getRouteAuthContext } from '@/lib/supabase-ssr';
import { AgentApiError } from '@/server/agent-api/errors';
import { RecentGenerationInputError } from '@/server/generations/recent-generations';

const headers = { 'Cache-Control': 'private, no-store' };

export async function mobileResponse<T>(action: () => Promise<T>) {
  try {
    return NextResponse.json(await action(), { headers });
  } catch (error) {
    if (error instanceof MobileHttpError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status, headers },
      );
    }
    if (error instanceof AgentApiError) {
      const status =
        error.code === 'AUTH_REQUIRED'
          ? 401
          : error.code === 'INSUFFICIENT_FUNDS'
            ? 402
            : ['ACCOUNT_RESTRICTED', 'SPENDING_LIMIT_EXCEEDED'].includes(error.code)
              ? 403
              : error.code.startsWith('QUOTE_')
                ? 409
                : error.code === 'RATE_LIMITED'
                  ? 429
                  : ['INTERNAL_ERROR', 'ENGINE_UNAVAILABLE'].includes(error.code)
                    ? 503
                    : 422;
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status, headers },
      );
    }
    if (error instanceof RecentGenerationInputError || error instanceof SyntaxError) {
      return NextResponse.json(
        { error: { code: 'PARAMETER_INVALID', message: 'Invalid request.' } },
        { status: 400, headers },
      );
    }
    console.error('[mobile] request failed', error instanceof Error ? error.name : 'unknown');
    return NextResponse.json(
      { error: { code: 'SERVICE_UNAVAILABLE', message: 'MaxVideoAI is temporarily unavailable.' } },
      { status: 503, headers },
    );
  }
}

/** Explicit bearer mode prevents a revoked phone token from falling through to a browser cookie. */
export async function mobileUser(request: NextRequest, enforceConsent = false): Promise<string> {
  if (
    request.headers.get('x-maxvideoai-auth-mode') !== 'bearer' ||
    !request.headers.get('authorization')?.startsWith('Bearer ')
  ) {
    throw new AgentApiError('AUTH_REQUIRED', 'Sign in to continue.');
  }
  const { userId } = await getRouteAuthContext(request);
  if (!userId) throw new AgentApiError('AUTH_REQUIRED', 'Sign in to continue.');
  if (enforceConsent) {
    const { computeReconsentStatus } = await import('@/server/legal-reconsent-status');
    if ((await computeReconsentStatus(userId)).shouldBlock) {
      throw new MobileHttpError(
        'LEGAL_CONSENT_REQUIRED',
        403,
        'Open Account to review the current terms and age confirmation.',
      );
    }
  }
  return userId;
}
