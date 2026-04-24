import { NextResponse, type NextRequest } from 'next/server';
import { createRouteHandler } from '@fal-ai/server-proxy/nextjs';
import { FAL_PROXY_ALLOWED_ENDPOINTS, isFalProxyTargetAllowed } from '@/lib/fal-model-policy';
import { getRouteAuthContext } from '@/lib/supabase-ssr';

export const runtime = 'nodejs';

const apiKey = process.env.FAL_KEY ?? process.env.FAL_API_KEY;
if (!apiKey) {
  throw new Error('Missing FAL API key. Set FAL_KEY or FAL_API_KEY in your environment.');
}

const falRoute = createRouteHandler({
  allowedEndpoints: FAL_PROXY_ALLOWED_ENDPOINTS,
  allowUnauthorizedRequests: false,
  isAuthenticated: async () => true,
  resolveFalAuth: async () => `Key ${apiKey}`,
});

function guardFalProxyRequest(request: NextRequest) {
  if (request.method !== 'GET' && request.method !== 'OPTIONS') {
    return NextResponse.json({ error: 'fal_proxy_read_only' }, { status: 403 });
  }

  const targetUrl = request.headers.get('x-fal-target-url');
  if (isFalProxyTargetAllowed(targetUrl)) {
    return null;
  }

  console.warn('[fal/proxy] blocked disallowed target', {
    method: request.method,
    targetUrl,
  });
  return NextResponse.json({ error: 'fal_target_blocked' }, { status: 403 });
}

async function runWithGuard(request: NextRequest, handler: (request: NextRequest) => Promise<Response>) {
  const { userId } = await getRouteAuthContext(request);
  if (!userId) {
    return NextResponse.json({ error: 'auth_required' }, { status: 401 });
  }

  const blocked = guardFalProxyRequest(request);
  if (blocked) {
    return blocked;
  }
  return handler(request);
}

export async function GET(request: NextRequest) {
  return runWithGuard(request, falRoute.GET);
}

export async function POST(request: NextRequest) {
  return runWithGuard(request, falRoute.POST);
}

export async function PUT(request: NextRequest) {
  return runWithGuard(request, falRoute.PUT);
}

export async function OPTIONS(request: NextRequest) {
  return runWithGuard(request, async () => new Response(null, { status: 204 }));
}
