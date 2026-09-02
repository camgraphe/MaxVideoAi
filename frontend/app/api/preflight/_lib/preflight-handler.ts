import { NextRequest, NextResponse } from 'next/server';

import { getRouteAuthContext } from '@/lib/supabase-ssr';
import { resolveMediaAwarePreflight } from './media-aware-preflight';
import { readPreflightRequest } from './preflight-request';

type PreflightPostDependencies = {
  resolveMediaAwarePreflightFn?: typeof resolveMediaAwarePreflight;
  getRouteAuthContextFn?: typeof getRouteAuthContext;
};

export function createPreflightPostHandler(dependencies: PreflightPostDependencies = {}) {
  const resolveMediaAwarePreflightFn =
    dependencies.resolveMediaAwarePreflightFn ?? resolveMediaAwarePreflight;
  const getRouteAuthContextFn = dependencies.getRouteAuthContextFn ?? getRouteAuthContext;

  return async function preflightPost(req: NextRequest) {
    const parsed = await readPreflightRequest(req);
    if (!parsed.ok) {
      return NextResponse.json(parsed.response, {
        status: parsed.status,
        headers: { 'Cache-Control': 'private, no-store' },
      });
    }
    const response = await resolveMediaAwarePreflightFn({
      request: parsed.request,
      resolveUserId: async () => (await getRouteAuthContextFn(req)).userId,
    });
    return NextResponse.json(response, {
      status: response.ok ? 200 : 400,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  };
}
