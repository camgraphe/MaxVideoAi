import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase-ssr';
import { isMcpFoundationFeatureEnabled } from '@/server/mcp/feature-access';
import {
  isSameOriginConsentRequest,
  isValidAuthorizationId,
  resolveOAuthRedirectUrl,
} from '@/server/mcp/oauth-consent';

export const runtime = 'nodejs';

function jsonError(error: string, status: number) {
  return NextResponse.json(
    { ok: false, error },
    { status, headers: { 'Cache-Control': 'private, no-store' } }
  );
}

export async function POST(request: NextRequest) {
  if (!isMcpFoundationFeatureEnabled('oauth')) return jsonError('not_found', 404);
  if (!isSameOriginConsentRequest(request)) return jsonError('origin_forbidden', 403);

  const form = await request.formData().catch(() => null);
  const authorizationId = form?.get('authorization_id');
  const decision = form?.get('decision');
  if (!isValidAuthorizationId(authorizationId)) return jsonError('authorization_invalid', 400);
  if (decision !== 'approve' && decision !== 'deny') return jsonError('decision_invalid', 400);

  const supabase = await createSupabaseRouteClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claimsData?.claims?.sub) return jsonError('authentication_required', 401);

  const result =
    decision === 'approve'
      ? await supabase.auth.oauth.approveAuthorization(authorizationId, { skipBrowserRedirect: true })
      : await supabase.auth.oauth.denyAuthorization(authorizationId, { skipBrowserRedirect: true });

  if (result.error || !result.data?.redirect_url) return jsonError('authorization_failed', 400);

  const redirectUrl = resolveOAuthRedirectUrl(result.data.redirect_url);
  return NextResponse.redirect(redirectUrl, 303);
}
