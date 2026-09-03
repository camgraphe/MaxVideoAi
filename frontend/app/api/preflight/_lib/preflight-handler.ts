import { NextRequest, NextResponse } from 'next/server';

import { getRouteAuthContext } from '@/lib/supabase-ssr';
import { resolveMediaAwarePreflight } from './media-aware-preflight';
import { readPreflightRequest } from './preflight-request';
import { isPrivateRuntimeEngineId } from '@/server/video-generation/private-engine-registry';
import { resolveLaunchCanaryRequestContext } from '@/server/model-launch-canary-request';

type PreflightPostDependencies = {
  resolveMediaAwarePreflightFn?: typeof resolveMediaAwarePreflight;
  getRouteAuthContextFn?: typeof getRouteAuthContext;
  resolveLaunchCanaryRequestContextFn?: typeof resolveLaunchCanaryRequestContext;
  mediaAwarePreflightDependencies?: Parameters<typeof resolveMediaAwarePreflight>[1];
};

export function createPreflightPostHandler(dependencies: PreflightPostDependencies = {}) {
  const resolveMediaAwarePreflightFn =
    dependencies.resolveMediaAwarePreflightFn ?? resolveMediaAwarePreflight;
  const getRouteAuthContextFn = dependencies.getRouteAuthContextFn ?? getRouteAuthContext;
  const resolveLaunchCanaryRequestContextFn =
    dependencies.resolveLaunchCanaryRequestContextFn ?? resolveLaunchCanaryRequestContext;

  return async function preflightPost(req: NextRequest) {
    const parsed = await readPreflightRequest(req);
    if (!parsed.ok) {
      return NextResponse.json(parsed.response, {
        status: parsed.status,
        headers: { 'Cache-Control': 'private, no-store' },
      });
    }
    const launchCanaryContext = isPrivateRuntimeEngineId(parsed.request.engine)
      ? await resolveLaunchCanaryRequestContextFn(req)
      : null;
    const response = await resolveMediaAwarePreflightFn({
      request: parsed.request,
      launchCanaryContext,
      resolveUserId: async () => launchCanaryContext?.principal.userId
        ?? (await getRouteAuthContextFn(req)).userId,
    }, dependencies.mediaAwarePreflightDependencies);
    return NextResponse.json(response, {
      status: response.ok ? 200 : 400,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  };
}
