import { NextResponse, type NextRequest } from 'next/server';

import { query } from '@/lib/db';
import { getRouteAuthContext } from '@/lib/supabase-ssr';
import {
  getMcpSpendingSettings,
  McpSpendingSettingsInputError,
  normalizeMcpSpendingSettingsUpdate,
  updateMcpSpendingSettings,
  type McpSpendingSettings,
  type McpSpendingSettingsUpdate,
} from '@/server/agent-api/spending-limits';
import { isSameOriginConsentRequest } from '@/server/mcp/oauth-consent';

export type McpSettingsRouteDependencies = {
  authenticate(request: Request): Promise<string | null>;
  sameOrigin(request: Pick<Request, 'headers' | 'url'>): boolean;
  getSettings(userId: string): Promise<McpSpendingSettings>;
  updateSettings(userId: string, input: McpSpendingSettingsUpdate): Promise<McpSpendingSettings>;
};

const defaultDependencies: McpSettingsRouteDependencies = {
  authenticate: async (request) => {
    const auth = await getRouteAuthContext(request as NextRequest);
    const userId = auth.userId?.trim() ?? '';
    return userId && userId.length <= 128 ? userId : null;
  },
  sameOrigin: isSameOriginConsentRequest,
  getSettings: (userId) => getMcpSpendingSettings(userId, { executor: { query } }),
  updateSettings: (userId, input) => updateMcpSpendingSettings(userId, input, { executor: { query } }),
};

function json(body: Record<string, unknown>, status: number): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'private, no-store' },
  });
}

async function authenticate(
  request: Request,
  dependencies: McpSettingsRouteDependencies,
): Promise<string | NextResponse> {
  try {
    const userId = await dependencies.authenticate(request);
    if (!userId) return json({ ok: false, error: 'authentication_required' }, 401);
    return userId;
  } catch {
    return json({ ok: false, error: 'settings_unavailable' }, 503);
  }
}

export async function handleMcpSettingsGet(
  request: Request,
  dependencies: McpSettingsRouteDependencies = defaultDependencies,
): Promise<NextResponse> {
  const userId = await authenticate(request, dependencies);
  if (typeof userId !== 'string') return userId;
  try {
    const settings = await dependencies.getSettings(userId);
    return json({ ok: true, settings }, 200);
  } catch {
    return json({ ok: false, error: 'settings_unavailable' }, 503);
  }
}

export async function handleMcpSettingsPatch(
  request: Request,
  dependencies: McpSettingsRouteDependencies = defaultDependencies,
): Promise<NextResponse> {
  if (!dependencies.sameOrigin(request)) {
    return json({ ok: false, error: 'origin_forbidden' }, 403);
  }
  const userId = await authenticate(request, dependencies);
  if (typeof userId !== 'string') return userId;
  const contentType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
  if (contentType !== 'application/json') {
    return json({ ok: false, error: 'content_type_invalid' }, 400);
  }
  let input: McpSpendingSettingsUpdate;
  try {
    input = normalizeMcpSpendingSettingsUpdate(await request.json());
  } catch {
    return json({ ok: false, error: 'settings_invalid' }, 400);
  }
  try {
    const settings = await dependencies.updateSettings(userId, input);
    return json({ ok: true, settings }, 200);
  } catch (error) {
    if (error instanceof McpSpendingSettingsInputError) {
      return json({ ok: false, error: 'settings_invalid' }, 400);
    }
    return json({ ok: false, error: 'settings_unavailable' }, 503);
  }
}
