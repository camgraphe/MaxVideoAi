import { NextRequest, NextResponse } from 'next/server';
import { getMcpRequestHost } from '@/lib/mcp-host-routing';
import { createSupabaseRouteClient } from '@/lib/supabase-ssr';
import * as mcpFunnel from '@/server/agent-api/mcp-funnel';
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
  const requestHost = getMcpRequestHost(request.headers);
  if (!isMcpFoundationFeatureEnabled('oauth', process.env, requestHost)) {
    return jsonError('not_found', 404);
  }
  if (!isSameOriginConsentRequest(request)) return jsonError('origin_forbidden', 403);

  const form = await request.formData().catch(() => null);
  const authorizationId = form?.get('authorization_id');
  const decision = form?.get('decision');
  const connectionBindingToken = form?.get('mcp_binding');
  if (!isValidAuthorizationId(authorizationId)) return jsonError('authorization_invalid', 400);
  if (decision !== 'approve' && decision !== 'deny') return jsonError('decision_invalid', 400);

  const supabase = await createSupabaseRouteClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const subject = typeof claimsData?.claims?.sub === 'string' ? claimsData.claims.sub.trim() : '';
  if (claimsError || !subject) return jsonError('authentication_required', 401);
  const { data: userData, error: userError } = await supabase.auth.getUser();
  const user = userData.user;
  if (userError || !user || user.id !== subject) return jsonError('authentication_required', 401);

  const authorization = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
  if (authorization.error
    || !authorization.data
    || !('authorization_id' in authorization.data)) {
    return jsonError('authorization_failed', 400);
  }
  const oauthClientId = authorization.data.client.id;

  const result =
    decision === 'approve'
      ? await supabase.auth.oauth.approveAuthorization(authorizationId, { skipBrowserRedirect: true })
      : await supabase.auth.oauth.denyAuthorization(authorizationId, { skipBrowserRedirect: true });

  if (result.error || !result.data?.redirect_url) return jsonError('authorization_failed', 400);

  if (decision === 'approve') {
    await mcpFunnel.approveMcpOAuthConnectionBinding({
      token: connectionBindingToken,
      authorizationId,
      userId: user.id,
      oauthClientId,
      approvedAt: new Date(),
    });
  }

  const redirectUrl = resolveOAuthRedirectUrl(result.data.redirect_url);
  return NextResponse.redirect(redirectUrl, 303);
}
