import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import {
  resolveGenerateUserGate,
  resolveGenerateUserId,
} from '../frontend/app/api/generate/_lib/auth-idempotency';

const root = process.cwd();
const routePath = join(root, 'frontend/app/api/generate/route.ts');
const helperPath = join(root, 'frontend/app/api/generate/_lib/auth-idempotency.ts');
const routeSource = readFileSync(routePath, 'utf8');

test('generate route delegates auth and local-key idempotency', () => {
  assert.ok(existsSync(helperPath), 'auth and idempotency should live in the generate route _lib folder');
  assert.match(routeSource, /from '\.\/_lib\/auth-idempotency'/);
  assert.doesNotMatch(routeSource, /createSupabaseRouteClient/);
  assert.doesNotMatch(routeSource, /resolveLocalAdminBypassUserId/);
  assert.doesNotMatch(routeSource, /getActiveAccountRestriction/);
  assert.doesNotMatch(routeSource, /created_at > NOW\(\) - INTERVAL '30 minutes'/);

  const lineCount = routeSource.split('\n').length;
  assert.ok(lineCount <= 1110, `/api/generate route should stay below 1110 lines after auth extraction, got ${lineCount}`);
});

test('auth idempotency helper exposes the route contract', () => {
  const helperSource = readFileSync(helperPath, 'utf8');

  assert.match(helperSource, /export async function resolveGenerateUserId/);
  assert.match(helperSource, /export async function resolveGenerateUserGate/);
  assert.match(helperSource, /buildResponseFromExistingVideoJob/);
  assert.match(helperSource, /created_at > NOW\(\) - INTERVAL '30 minutes'/);
});

test('resolveGenerateUserId falls back to the local admin bypass after Supabase misses', async () => {
  const userId = await resolveGenerateUserId({} as never, {
    createSupabaseRouteClientFn: async () => ({
      auth: {
        getUser: async () => ({ data: { user: null } }),
      },
    }),
    resolveLocalAdminBypassUserIdFn: async () => 'admin_user_123',
  });

  assert.equal(userId, 'admin_user_123');
});

test('resolveGenerateUserGate returns an auth response before DB work when no user is available', async () => {
  let queried = false;
  const result = await resolveGenerateUserGate({
    req: {} as never,
    body: { localKey: 'abc' },
    deps: {
      resolveGenerateUserIdFn: async () => null,
      queryFn: async () => {
        queried = true;
        return [];
      },
    },
  });

  assert.equal(result.kind, 'response');
  assert.equal(result.status, 401);
  assert.equal(result.metric?.errorCode, 'AUTH_REQUIRED');
  assert.equal(queried, false);
});

test('resolveGenerateUserGate returns an existing local-key render response', async () => {
  const result = await resolveGenerateUserGate({
    req: {} as never,
    body: { localKey: ' local_render ' },
    deps: {
      resolveGenerateUserIdFn: async () => 'user_123',
      getActiveAccountRestrictionFn: async () => null,
      queryFn: async () => [
        {
          job_id: 'job_123',
          user_id: 'user_123',
          status: 'running',
          video_url: null,
          thumb_url: '/thumb.svg',
          provider_job_id: 'provider_123',
          progress: 35,
          message: 'Rendering',
          batch_id: null,
          group_id: null,
          iteration_index: null,
          iteration_count: null,
          render_ids: null,
          hero_render_id: null,
        },
      ],
    },
  });

  assert.equal(result.kind, 'response');
  assert.equal(result.status, 200);
  assert.equal(result.body.jobId, 'job_123');
  assert.equal(result.body.localKey, 'local_render');
});
