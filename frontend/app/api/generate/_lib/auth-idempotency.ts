import type { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { createSupabaseRouteClient } from '@/lib/supabase-ssr';
import { resolveLocalAdminBypassUserId } from '@/server/admin';
import { buildRestrictedAccountPayload, getActiveAccountRestriction } from '@/server/fraud-cleanup';
import { buildResponseFromExistingVideoJob, type ExistingVideoJobRow } from './initial-video-job';

type GenerateAuthMetric = {
  errorCode: string;
};

type QueryFn = <T = unknown>(sql: string, params?: unknown[]) => Promise<T[]>;

export type GenerateUserGateResult =
  | {
      kind: 'ready';
      userId: string;
      localKey: string | null;
    }
  | {
      kind: 'response';
      status: number;
      body: Record<string, unknown>;
      metric?: GenerateAuthMetric;
    };

type ResolveGenerateUserIdDeps = {
  createSupabaseRouteClientFn?: typeof createSupabaseRouteClient;
  resolveLocalAdminBypassUserIdFn?: typeof resolveLocalAdminBypassUserId;
};

type ResolveGenerateUserGateDeps = ResolveGenerateUserIdDeps & {
  resolveGenerateUserIdFn?: (req?: NextRequest) => Promise<string | null>;
  getActiveAccountRestrictionFn?: typeof getActiveAccountRestriction;
  buildRestrictedAccountPayloadFn?: typeof buildRestrictedAccountPayload;
  buildResponseFromExistingVideoJobFn?: typeof buildResponseFromExistingVideoJob;
  queryFn?: QueryFn;
};

export async function resolveGenerateUserId(
  req?: NextRequest,
  deps: ResolveGenerateUserIdDeps = {}
): Promise<string | null> {
  const createSupabaseRouteClientFn = deps.createSupabaseRouteClientFn ?? createSupabaseRouteClient;
  const resolveLocalAdminBypassUserIdFn =
    deps.resolveLocalAdminBypassUserIdFn ?? resolveLocalAdminBypassUserId;

  try {
    const supabase = await createSupabaseRouteClientFn();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.id) {
      return user.id;
    }
  } catch {
    // Keep auth fallback tolerant so local admin bypass still works in dev.
  }

  const localAdminUserId = await resolveLocalAdminBypassUserIdFn(req);
  return localAdminUserId || null;
}

export async function resolveGenerateUserGate(params: {
  req: NextRequest;
  body: Record<string, unknown>;
  deps?: ResolveGenerateUserGateDeps;
}): Promise<GenerateUserGateResult> {
  const deps = params.deps ?? {};
  const resolveGenerateUserIdFn = deps.resolveGenerateUserIdFn ?? ((req?: NextRequest) => resolveGenerateUserId(req, deps));
  const userId = await resolveGenerateUserIdFn(params.req);

  if (!userId) {
    return {
      kind: 'response',
      status: 401,
      metric: { errorCode: 'AUTH_REQUIRED' },
      body: { ok: false, error: 'auth_required', message: 'Authentication required.' },
    };
  }

  const getActiveAccountRestrictionFn = deps.getActiveAccountRestrictionFn ?? getActiveAccountRestriction;
  const restriction = await getActiveAccountRestrictionFn(userId);
  if (restriction) {
    const buildRestrictedAccountPayloadFn = deps.buildRestrictedAccountPayloadFn ?? buildRestrictedAccountPayload;
    return {
      kind: 'response',
      status: 403,
      metric: { errorCode: 'ACCOUNT_RESTRICTED' },
      body: buildRestrictedAccountPayloadFn(),
    };
  }

  const localKey =
    typeof params.body.localKey === 'string' && params.body.localKey.trim().length
      ? params.body.localKey.trim()
      : null;
  if (localKey) {
    const queryFn = deps.queryFn ?? query;
    const existingJobs = await queryFn<ExistingVideoJobRow>(
      `
        SELECT job_id, user_id, status, video_url, thumb_url, provider_job_id, progress, message,
               batch_id, group_id, iteration_index, iteration_count, render_ids, hero_render_id
          FROM app_jobs
         WHERE user_id = $1
           AND local_key = $2
           AND created_at > NOW() - INTERVAL '30 minutes'
         ORDER BY created_at DESC
         LIMIT 1
      `,
      [userId, localKey]
    );
    const existing = existingJobs[0];
    if (existing) {
      const buildResponseFromExistingVideoJobFn =
        deps.buildResponseFromExistingVideoJobFn ?? buildResponseFromExistingVideoJob;
      return {
        kind: 'response',
        status: 200,
        body: buildResponseFromExistingVideoJobFn(existing, localKey),
      };
    }
  }

  return {
    kind: 'ready',
    userId,
    localKey,
  };
}
