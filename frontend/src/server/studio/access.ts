import type { NextRequest } from 'next/server';
import { FEATURES } from '@/content/feature-flags';
import { getRouteAuthContext } from '@/lib/supabase-ssr';
import {
  getUserIdFromCookies,
  isUserAdmin,
  resolveLocalAdminBypassUserId,
} from '@/server/admin';

export type StudioAccessPolicy = Readonly<{
  enabled: boolean;
  adminOnly: boolean;
}>;

export type StudioAccessDecision =
  | Readonly<{ ok: true; userId: string }>
  | Readonly<{
      ok: false;
      status: 401 | 403 | 404 | 500;
      error: 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'ACCESS_CHECK_FAILED';
    }>;

export type StudioAccessDependencies = Readonly<{
  resolveRequestUserId(request: NextRequest): Promise<string | null>;
  resolvePageUserId(): Promise<string | null>;
  resolveLocalBypassUserId(request?: NextRequest): Promise<string | null>;
  isAdmin(userId: string): Promise<boolean>;
}>;

const DEFAULT_STUDIO_ACCESS_POLICY: StudioAccessPolicy = {
  enabled: FEATURES.studio.maxVideoAiEditor,
  adminOnly: FEATURES.studio.adminOnly,
};

const DEFAULT_STUDIO_ACCESS_DEPENDENCIES: StudioAccessDependencies = {
  async resolveRequestUserId(request) {
    return (await getRouteAuthContext(request)).userId;
  },
  resolvePageUserId: getUserIdFromCookies,
  resolveLocalBypassUserId: resolveLocalAdminBypassUserId,
  isAdmin: isUserAdmin,
};

async function resolveStudioAccess(
  request: NextRequest | undefined,
  resolveUserId: () => Promise<string | null>,
  policy: StudioAccessPolicy,
  dependencies: StudioAccessDependencies,
): Promise<StudioAccessDecision> {
  if (!policy.enabled) {
    return { ok: false, status: 404, error: 'NOT_FOUND' };
  }

  let userId: string | null;
  try {
    userId = await resolveUserId();
  } catch {
    try {
      const bypassUserId = await dependencies.resolveLocalBypassUserId(request);
      return bypassUserId
        ? { ok: true, userId: bypassUserId }
        : { ok: false, status: 500, error: 'ACCESS_CHECK_FAILED' };
    } catch {
      return { ok: false, status: 500, error: 'ACCESS_CHECK_FAILED' };
    }
  }

  if (!userId) {
    try {
      const bypassUserId = await dependencies.resolveLocalBypassUserId(request);
      return bypassUserId
        ? { ok: true, userId: bypassUserId }
        : { ok: false, status: 401, error: 'UNAUTHORIZED' };
    } catch {
      return { ok: false, status: 500, error: 'ACCESS_CHECK_FAILED' };
    }
  }

  if (!policy.adminOnly) {
    return { ok: true, userId };
  }

  try {
    if (await dependencies.isAdmin(userId)) {
      return { ok: true, userId };
    }
    const bypassUserId = await dependencies.resolveLocalBypassUserId(request);
    return bypassUserId
      ? { ok: true, userId: bypassUserId }
      : { ok: false, status: 403, error: 'FORBIDDEN' };
  } catch {
    return { ok: false, status: 500, error: 'ACCESS_CHECK_FAILED' };
  }
}

export function resolveStudioApiAccess(
  request: NextRequest,
  policy: StudioAccessPolicy = DEFAULT_STUDIO_ACCESS_POLICY,
  dependencies: StudioAccessDependencies = DEFAULT_STUDIO_ACCESS_DEPENDENCIES,
): Promise<StudioAccessDecision> {
  return resolveStudioAccess(
    request,
    () => dependencies.resolveRequestUserId(request),
    policy,
    dependencies,
  );
}

export function resolveStudioPageAccess(
  policy: StudioAccessPolicy = DEFAULT_STUDIO_ACCESS_POLICY,
  dependencies: StudioAccessDependencies = DEFAULT_STUDIO_ACCESS_DEPENDENCIES,
): Promise<StudioAccessDecision> {
  return resolveStudioAccess(
    undefined,
    dependencies.resolvePageUserId,
    policy,
    dependencies,
  );
}
