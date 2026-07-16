import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { Client, Pool } from 'pg';

import type { QueryExecutor, TransactionQueryExecutor } from '../frontend/src/lib/db';
import {
  getMcpSpendingSettings,
  updateMcpSpendingSettings,
} from '../frontend/src/server/agent-api/spending-limits';
import { listMcpActivityHistory } from '../frontend/src/server/agent-api/activity-history';
import {
  handleMcpSettingsGet,
  handleMcpSettingsPatch,
  type McpSettingsRouteDependencies,
} from '../frontend/app/api/account/mcp-settings/_lib/mcp-settings-route';
import { isSameOriginConsentRequest } from '../frontend/src/server/mcp/oauth-consent';

const settings = {
  paidGenerationEnabled: true,
  perGenerationCents: 250,
  dailyCents: 1000,
  webApprovalAboveCents: null,
  updatedAt: '2026-07-16T12:00:00.000Z',
};

function dependencies(
  overrides: Partial<McpSettingsRouteDependencies> = {},
): McpSettingsRouteDependencies {
  return {
    authenticate: async () => 'route-user',
    sameOrigin: () => true,
    getSettings: async () => settings,
    updateSettings: async (_userId, input) => ({ ...input, updatedAt: settings.updatedAt }),
    ...overrides,
  };
}

async function json(response: Response): Promise<Record<string, unknown>> {
  return await response.json() as Record<string, unknown>;
}

function assertPrivate(response: Response): void {
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
}

test('GET authenticates through the route owner and returns only the stable private DTO', async () => {
  let authenticated = 0;
  let readUserId = '';
  const response = await handleMcpSettingsGet(
    new Request('https://maxvideoai.com/api/account/mcp-settings'),
    dependencies({
      authenticate: async () => {
        authenticated += 1;
        return 'owner-user';
      },
      getSettings: async (userId) => {
        readUserId = userId;
        return settings;
      },
    }),
  );
  assert.equal(response.status, 200);
  assertPrivate(response);
  assert.equal(authenticated, 1);
  assert.equal(readUserId, 'owner-user');
  assert.deepEqual(await json(response), { ok: true, settings });
});

test('GET/PATCH use stable private failures for auth, origin, input, and repository outages', async () => {
  let originFailureAuthCalls = 0;
  const cases: Array<[string, Promise<Response>, number, string]> = [
    [
      'GET auth',
      handleMcpSettingsGet(new Request('https://maxvideoai.com/api/account/mcp-settings'), dependencies({
        authenticate: async () => null,
      })),
      401,
      'authentication_required',
    ],
    [
      'GET unavailable',
      handleMcpSettingsGet(new Request('https://maxvideoai.com/api/account/mcp-settings'), dependencies({
        getSettings: async () => { throw new Error('SELECT secret FROM private'); },
      })),
      503,
      'settings_unavailable',
    ],
    [
      'PATCH origin',
      handleMcpSettingsPatch(new Request('https://maxvideoai.com/api/account/mcp-settings', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          paidGenerationEnabled: true,
          perGenerationCents: null,
          dailyCents: null,
          webApprovalAboveCents: null,
        }),
      }), dependencies({
        sameOrigin: () => false,
        authenticate: async () => {
          originFailureAuthCalls += 1;
          return null;
        },
      })),
      403,
      'origin_forbidden',
    ],
    [
      'PATCH content',
      handleMcpSettingsPatch(new Request('https://maxvideoai.com/api/account/mcp-settings', {
        method: 'PATCH',
        headers: { origin: 'https://maxvideoai.com', 'content-type': 'text/plain' },
        body: '{}',
      }), dependencies()),
      400,
      'content_type_invalid',
    ],
    [
      'PATCH JSON',
      handleMcpSettingsPatch(new Request('https://maxvideoai.com/api/account/mcp-settings', {
        method: 'PATCH',
        headers: { origin: 'https://maxvideoai.com', 'content-type': 'application/json' },
        body: '{',
      }), dependencies()),
      400,
      'settings_invalid',
    ],
    [
      'PATCH unavailable',
      handleMcpSettingsPatch(new Request('https://maxvideoai.com/api/account/mcp-settings', {
        method: 'PATCH',
        headers: { origin: 'https://maxvideoai.com', 'content-type': 'application/json' },
        body: JSON.stringify({
          paidGenerationEnabled: false,
          perGenerationCents: 0,
          dailyCents: null,
          webApprovalAboveCents: 10,
        }),
      }), dependencies({
        updateSettings: async () => { throw new Error('private database failure'); },
      })),
      503,
      'settings_unavailable',
    ],
  ];
  for (const [label, pending, status, error] of cases) {
    const response = await pending;
    assert.equal(response.status, status, label);
    assertPrivate(response);
    const body = await json(response);
    assert.deepEqual(body, { ok: false, error }, label);
    assert.doesNotMatch(JSON.stringify(body), /SELECT|private database|email|token|prompt|https?:\/\//i);
  }
  assert.equal(originFailureAuthCalls, 0, 'origin rejection must happen before authentication work');
});

test('PATCH accepts only the exact complete four-field body and trusts no user/client identity', async () => {
  const base = {
    paidGenerationEnabled: false,
    perGenerationCents: 0,
    dailyCents: 2_147_483_647,
    webApprovalAboveCents: null,
  };
  let updateInput: unknown;
  let updateUserId = '';
  const response = await handleMcpSettingsPatch(new Request(
    'https://maxvideoai.com/api/account/mcp-settings?userId=attacker',
    {
      method: 'PATCH',
      headers: {
        origin: 'https://maxvideoai.com',
        'content-type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(base),
    },
  ), dependencies({
    authenticate: async () => 'trusted-user',
    updateSettings: async (userId, input) => {
      updateUserId = userId;
      updateInput = input;
      return { ...input, updatedAt: settings.updatedAt };
    },
  }));
  assert.equal(response.status, 200);
  assertPrivate(response);
  assert.equal(updateUserId, 'trusted-user');
  assert.deepEqual(updateInput, base);
  assert.deepEqual(await json(response), {
    ok: true,
    settings: { ...base, updatedAt: settings.updatedAt },
  });

  for (const invalid of [
    {},
    { ...base, userId: 'attacker' },
    { ...base, clientId: 'attacker' },
    { ...base, dailyCents: undefined },
    { ...base, perGenerationCents: 0.1 },
    { ...base, webApprovalAboveCents: '10' },
  ]) {
    const invalidResponse = await handleMcpSettingsPatch(new Request(
      'https://maxvideoai.com/api/account/mcp-settings',
      {
        method: 'PATCH',
        headers: { origin: 'https://maxvideoai.com', 'content-type': 'application/json' },
        body: JSON.stringify(invalid),
      },
    ), dependencies());
    assert.equal(invalidResponse.status, 400);
    assertPrivate(invalidResponse);
    assert.deepEqual(await json(invalidResponse), { ok: false, error: 'settings_invalid' });
  }
});

test('trusted same-origin mutation helper rejects missing, opaque, credentialed, foreign, and forwarded-host tricks', () => {
  const url = 'https://internal.vercel/api/account/mcp-settings';
  const request = (headers: HeadersInit) => new Request(url, { method: 'PATCH', headers });
  assert.equal(isSameOriginConsentRequest(request({ origin: 'https://internal.vercel' })), true);
  assert.equal(isSameOriginConsentRequest(request({
    origin: 'https://maxvideoai.com',
    'x-forwarded-host': 'maxvideoai.com',
    'x-forwarded-proto': 'https',
  })), true);
  for (const headers of [
    {},
    { origin: 'null' },
    { origin: 'https://evil.example' },
    { origin: 'https://user:pass@internal.vercel' },
    { origin: 'https://internal.vercel/path' },
    { origin: 'https://maxvideoai.com', 'x-forwarded-host': 'maxvideoai.com, evil.example', 'x-forwarded-proto': 'https' },
    { origin: 'https://maxvideoai.com', host: 'maxvideoai.com', 'x-forwarded-host': 'maxvideoai.com, evil.example', 'x-forwarded-proto': 'https' },
    { origin: 'https://maxvideoai.com', 'x-forwarded-host': 'user:pass@maxvideoai.com', 'x-forwarded-proto': 'https' },
    { origin: 'https://maxvideoai.com', 'x-forwarded-host': 'maxvideoai.com/path', 'x-forwarded-proto': 'https' },
    { origin: 'https://maxvideoai.com', 'x-forwarded-host': 'maxvideoai.com', 'x-forwarded-proto': 'javascript' },
  ]) assert.equal(isSameOriginConsentRequest(request(headers)), false, JSON.stringify(headers));
});

function commandExists(command: string): boolean {
  return spawnSync('sh', ['-c', `command -v ${command}`], { encoding: 'utf8' }).status === 0;
}

function asExecutor(client: Pick<Client, 'query'>): QueryExecutor {
  return {
    async query<TRecord>(sql: string, params?: ReadonlyArray<unknown>) {
      return (await client.query<TRecord>(sql, params as unknown[] | undefined)).rows;
    },
  };
}

test('settings repository round-trip and PATCH-versus-confirm lock serialize on disposable PostgreSQL', async (t) => {
  for (const command of ['initdb', 'pg_ctl', 'psql']) {
    if (!commandExists(command)) {
      t.skip(`${command} is unavailable`);
      return;
    }
  }
  const temporaryRoot = mkdtempSync(join(tmpdir(), 'mcp-settings-pg-'));
  const dataDirectory = join(temporaryRoot, 'data');
  const socketDirectory = join(temporaryRoot, 'socket');
  mkdirSync(socketDirectory);
  const init = spawnSync('initdb', [
    '-A', 'trust', '-U', 'postgres', '-D', dataDirectory, '--no-locale', '--encoding=UTF8',
  ], { encoding: 'utf8' });
  assert.equal(init.status, 0, `${init.stdout}\n${init.stderr}`);
  const start = spawnSync('pg_ctl', [
    '-D', dataDirectory, '-o', `-F -k ${socketDirectory} -c listen_addresses=''`, '-w', 'start',
  ], { encoding: 'utf8', stdio: 'ignore' });
  assert.equal(start.status, 0);
  t.after(() => {
    spawnSync('pg_ctl', ['-D', dataDirectory, '-m', 'immediate', '-w', 'stop'], {
      encoding: 'utf8', stdio: 'ignore',
    });
    rmSync(temporaryRoot, { recursive: true, force: true });
  });
  const migration = spawnSync('psql', [
    '-X', '-h', socketDirectory, '-U', 'postgres', '-d', 'postgres',
    '--single-transaction', '-v', 'ON_ERROR_STOP=1', '-f',
    join(process.cwd(), 'neon/migrations/30_mcp_paid_generation.sql'),
  ], { encoding: 'utf8' });
  assert.equal(migration.status, 0, `${migration.stdout}\n${migration.stderr}`);

  const connection = { host: socketDirectory, user: 'postgres', database: 'postgres' };
  const pool = new Pool(connection);
  const patchClient = new Client(connection);
  const confirmClient = new Client(connection);
  await Promise.all([patchClient.connect(), confirmClient.connect()]);
  t.after(async () => Promise.allSettled([pool.end(), patchClient.end(), confirmClient.end()]));

  await pool.query(`
    CREATE TABLE app_jobs (
      job_id text PRIMARY KEY,
      user_id text,
      status text,
      payment_status text
    );
    WITH activity_clock AS (SELECT clock_timestamp() AS created_at)
    INSERT INTO mcp_generation_quotes (
      quote_id, user_id, oauth_client_id, request_json, request_hash, catalog_revision,
      pricing_snapshot, price_cents, currency, funding_mode, state,
      expires_at, created_at, updated_at
    ) SELECT
      '00000000-0000-4000-8000-000000000071', 'activity-pg-user', 'activity-pg-client',
      '{"schemaVersion":1,"engineId":"seedance-2-0-mini"}', repeat('a', 64), 'activity-catalog',
      '{}', 125, 'USD', 'wallet', 'prepared',
      created_at + INTERVAL '10 minutes', created_at, created_at
    FROM activity_clock;
    UPDATE mcp_generation_quotes
       SET state = 'claimed', job_id = 'activity-pg-job',
           claimed_at = created_at + INTERVAL '1 second',
           updated_at = created_at + INTERVAL '1 second'
     WHERE user_id = 'activity-pg-user';
    UPDATE mcp_generation_quotes
       SET state = 'accepted', updated_at = created_at + INTERVAL '2 seconds'
     WHERE user_id = 'activity-pg-user';
    INSERT INTO app_jobs (job_id, user_id, status, payment_status)
    VALUES ('activity-pg-job', 'activity-pg-user', 'failed', 'refunded_wallet');
  `);
  const pgActivity = await listMcpActivityHistory({
    userId: 'activity-pg-user',
    clientLabels: { 'activity-pg-client': 'Claude Desktop' },
  }, { executor: asExecutor(patchClient) });
  assert.deepEqual(pgActivity, [{
    clientLabel: 'Claude Desktop',
    tool: 'confirm_generation',
    model: 'seedance-2-0-mini',
    amountCents: 125,
    currency: 'USD',
    outcome: 'refunded',
    timestamp: pgActivity[0]?.timestamp,
  }]);

  const initial = await getMcpSpendingSettings('pg-user', { executor: asExecutor(patchClient) });
  assert.equal(initial.paidGenerationEnabled, true);
  assert.equal(initial.dailyCents, null);
  const roundTrip = await updateMcpSpendingSettings('pg-user', {
    paidGenerationEnabled: true,
    perGenerationCents: 0,
    dailyCents: 2_147_483_647,
    webApprovalAboveCents: null,
  }, { executor: asExecutor(patchClient) });
  assert.equal(roundTrip.perGenerationCents, 0);
  assert.equal(roundTrip.dailyCents, 2_147_483_647);

  await patchClient.query('BEGIN');
  const patchResponse = await handleMcpSettingsPatch(new Request(
    'https://maxvideoai.com/api/account/mcp-settings',
    {
      method: 'PATCH',
      headers: { origin: 'https://maxvideoai.com', 'content-type': 'application/json' },
      body: JSON.stringify({
        paidGenerationEnabled: false,
        perGenerationCents: null,
        dailyCents: null,
        webApprovalAboveCents: null,
      }),
    },
  ), dependencies({
    authenticate: async () => 'pg-user',
    updateSettings: (userId, input) => updateMcpSpendingSettings(
      userId,
      input,
      { executor: asExecutor(patchClient) },
    ),
  }));
  assert.equal(patchResponse.status, 200);

  await confirmClient.query('BEGIN');
  let settled = false;
  const confirmationCheck = import('../frontend/src/server/agent-api/spending-limits').then(
    ({ checkMcpConfirmationSpendingLimits }) => checkMcpConfirmationSpendingLimits({
      userId: 'pg-user', priceCents: 1, currency: 'USD',
    }, { executor: asExecutor(confirmClient) as TransactionQueryExecutor }),
  );
  void confirmationCheck.finally(() => { settled = true; }).catch(() => undefined);
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(settled, false, 'confirmation must wait for the PATCH row lock');
  await patchClient.query('COMMIT');
  const decision = await confirmationCheck;
  assert.equal(decision.allowed, false);
  if (!decision.allowed) assert.equal(decision.reason, 'paid_generation_disabled');
  await confirmClient.query('ROLLBACK');

  const persisted = await pool.query(`
    SELECT paid_generation_enabled, per_generation_cents, daily_cents, web_approval_above_cents
      FROM mcp_spending_limits WHERE user_id = 'pg-user'
  `);
  assert.deepEqual(persisted.rows[0], {
    paid_generation_enabled: false,
    per_generation_cents: null,
    daily_cents: null,
    web_approval_above_cents: null,
  });
});

test('route file keeps thin exported GET/PATCH adapters and no service-role secret', () => {
  const source = readFileSync('frontend/app/api/account/mcp-settings/route.ts', 'utf8');
  assert.match(source, /export async function GET/);
  assert.match(source, /export async function PATCH/);
  assert.doesNotMatch(source, /export\s+(?:async\s+)?function\s+handleMcpSettings(?:Get|Patch)/);
  assert.doesNotMatch(source, /export\s+(?:type|interface)\s+McpSettingsRouteDependencies/);
  assert.match(source, /\.\/_lib\/mcp-settings-route/);
  const owner = readFileSync(
    'frontend/app/api/account/mcp-settings/_lib/mcp-settings-route.ts',
    'utf8',
  );
  assert.match(owner, /getRouteAuthContext/);
  assert.match(owner, /isSameOriginConsentRequest/);
  assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE|service_role|userId\s*=\s*body/i);
});
