import mcpPublication from '@/config/mcp-publication.json';
import {
  isDatabaseConfigured,
  query,
  withDbTransaction,
  type QueryExecutor,
  type TransactionQueryExecutor,
} from '@/lib/db';
import {
  consumeEntitlement,
  releaseEntitlement,
} from '@/server/agent-api/trial-entitlement-repository';
import {
  createTrialSupportOverrideService,
  type TrialJobOutcomeResult,
  type TrialSupportOverride,
} from '@/server/agent-api/trial-outcomes';

type AdminMcpTrialRelationsRow = {
  mcp_trial_entitlements: unknown;
  mcp_generation_quotes: unknown;
  mcp_trial_risk_events: unknown;
  mcp_trial_support_override_audit: unknown;
  admin_audit: unknown;
  app_jobs: unknown;
  provider_attempts: unknown;
};

type AdminMcpTrialSummaryRow = {
  accepted_count: unknown;
  reserved_count: unknown;
  consumed_count: unknown;
  released_count: unknown;
  provider_cost_cents: unknown;
  suspicious_velocity_count: unknown;
};

type AdminMcpTrialInspectionRow = {
  user_id: unknown;
  entitlement_state: unknown;
  job_id: unknown;
  quote_state: unknown;
  job_state: unknown;
  output_present: unknown;
  reserved_at: unknown;
};

type ManualReleasePreflightRow = {
  user_id: unknown;
  entitlement_state: unknown;
  job_id: unknown;
  reserved_quote_id: unknown;
  job_user_id: unknown;
  payment_status: unknown;
  job_state: unknown;
  output_present: unknown;
  quote_id: unknown;
  quote_user_id: unknown;
  quote_job_id: unknown;
  funding_mode: unknown;
  quote_state: unknown;
};

export type AdminMcpTrialOperations = {
  availability: 'available' | 'unavailable';
  reasonCode: 'loaded' | 'database_unavailable' | 'schema_unavailable' | 'query_unavailable';
  killSwitch: { checkedIn: boolean; runtime: boolean; effective: boolean };
  counts: { accepted: number; reserved: number; consumed: number; released: number } | null;
  providerCostCents: number | null;
  suspiciousVelocity: number | null;
  inspection: {
    userId: string;
    entitlementState: 'available' | 'reserved' | 'consumed' | 'released';
    jobId: string | null;
    quoteState: string | null;
    jobState: string | null;
    outputPresent: boolean;
    reservedAt: string | null;
  } | null;
};

export type ManualMcpTrialReleaseInput = {
  adminId: string;
  userId: string;
  jobId: string;
  reason: TrialSupportOverride['reason'];
};

type AdminMcpTrialOperationsDependencies = {
  executor: QueryExecutor;
  isDatabaseConfigured(): boolean;
  checkedInFlags: { trial: boolean };
  env: Record<string, string | undefined>;
  withTransaction<TResult>(
    callback: (executor: TransactionQueryExecutor) => Promise<TResult>,
  ): Promise<TResult>;
  applySupportOverride(
    executor: TransactionQueryExecutor,
    jobId: string,
    override: TrialSupportOverride,
  ): Promise<TrialJobOutcomeResult>;
};

const defaultDependencies: AdminMcpTrialOperationsDependencies = {
  executor: { query },
  isDatabaseConfigured,
  checkedInFlags: { trial: mcpPublication.trial },
  env: process.env,
  withTransaction: (callback) => withDbTransaction((executor) => callback(executor)),
  applySupportOverride: (executor, jobId, override) => createTrialSupportOverrideService({
    withTransaction: (callback) => callback(executor),
    consumeEntitlement,
    releaseEntitlement,
  })(jobId, override),
};

const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const ENTITLEMENT_STATES = new Set(['available', 'reserved', 'consumed', 'released']);
const SUPPORT_REASONS = new Set([
  'provider_confirmed_no_output',
  'support_verified_no_output',
]);
const LOAD_KEYS = new Set(['inspectionUserId']);
const RELEASE_KEYS = new Set(['adminId', 'userId', 'jobId', 'reason']);

function exactPlainRecord(
  value: unknown,
  expectedKeys: ReadonlySet<string>,
): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.getPrototypeOf(value) !== Object.prototype
    || Object.getOwnPropertySymbols(value).length !== 0) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Object.keys(descriptors);
  if (keys.length !== expectedKeys.size
    || !keys.every((key) => expectedKeys.has(key))
    || keys.some((key) => !descriptors[key]?.enumerable || !('value' in descriptors[key]!))) {
    return null;
  }
  return Object.fromEntries(
    keys.map((key) => [key, descriptors[key]!.value]),
  ) as Record<string, unknown>;
}

function readUuid(value: unknown, message: string): string {
  if (typeof value !== 'string' || !UUID_V4_PATTERN.test(value)) throw new Error(message);
  return value;
}

function parseLoadInput(value: unknown): { inspectionUserId: string | null } {
  const input = exactPlainRecord(value, LOAD_KEYS);
  if (!input || !(input.inspectionUserId === null
    || (typeof input.inspectionUserId === 'string' && UUID_V4_PATTERN.test(input.inspectionUserId)))) {
    throw new Error('Invalid MCP trial inspection input.');
  }
  return { inspectionUserId: input.inspectionUserId } as { inspectionUserId: string | null };
}

function parseReleaseInput(value: unknown): ManualMcpTrialReleaseInput {
  const input = exactPlainRecord(value, RELEASE_KEYS);
  if (!input
    || typeof input.reason !== 'string'
    || !SUPPORT_REASONS.has(input.reason)) {
    throw new Error('Invalid MCP trial manual release input.');
  }
  return {
    adminId: readUuid(input.adminId, 'Invalid MCP trial manual release input.'),
    userId: readUuid(input.userId, 'Invalid MCP trial manual release input.'),
    jobId: readUuid(input.jobId, 'Invalid MCP trial manual release input.'),
    reason: input.reason as ManualMcpTrialReleaseInput['reason'],
  };
}

function killSwitch(dependencies: AdminMcpTrialOperationsDependencies) {
  const checkedIn = dependencies.checkedInFlags.trial === true;
  const runtime = dependencies.env.MCP_TRIAL_ENABLED === 'true';
  return { checkedIn, runtime, effective: checkedIn && runtime };
}

function unavailable(
  dependencies: AdminMcpTrialOperationsDependencies,
  reasonCode: AdminMcpTrialOperations['reasonCode'],
): AdminMcpTrialOperations {
  return {
    availability: 'unavailable',
    reasonCode,
    killSwitch: killSwitch(dependencies),
    counts: null,
    providerCostCents: null,
    suspiciousVelocity: null,
    inspection: null,
  };
}

function readCount(value: unknown): number {
  const parsed = typeof value === 'string' ? Number(value) : value;
  if (!Number.isSafeInteger(parsed) || (parsed as number) < 0) {
    throw new Error('Invalid admin MCP trial aggregate.');
  }
  return parsed as number;
}

function relationsAvailable(rows: AdminMcpTrialRelationsRow[]): boolean {
  const row = rows[0];
  if (rows.length !== 1 || !row) throw new Error('Invalid admin MCP trial relations result.');
  const values = [
    row.mcp_trial_entitlements,
    row.mcp_generation_quotes,
    row.mcp_trial_risk_events,
    row.mcp_trial_support_override_audit,
    row.admin_audit,
    row.app_jobs,
    row.provider_attempts,
  ];
  if (!values.every((value) => typeof value === 'boolean')) {
    throw new Error('Invalid admin MCP trial relations result.');
  }
  return values.every(Boolean);
}

function readInspection(
  rows: AdminMcpTrialInspectionRow[],
  userId: string,
): AdminMcpTrialOperations['inspection'] {
  if (rows.length === 0) return null;
  const row = rows[0];
  if (rows.length !== 1 || !row
    || row.user_id !== userId
    || typeof row.entitlement_state !== 'string'
    || !ENTITLEMENT_STATES.has(row.entitlement_state)
    || !(row.job_id === null
      || (typeof row.job_id === 'string' && UUID_V4_PATTERN.test(row.job_id)))
    || !(row.quote_state === null
      || (typeof row.quote_state === 'string' && row.quote_state.length <= 32))
    || !(row.job_state === null
      || (typeof row.job_state === 'string' && row.job_state.length <= 64))
    || typeof row.output_present !== 'boolean'
    || !(row.reserved_at === null
      || (typeof row.reserved_at === 'string' && Number.isFinite(Date.parse(row.reserved_at))))) {
    throw new Error('Invalid admin MCP trial inspection result.');
  }
  return {
    userId,
    entitlementState: row.entitlement_state as NonNullable<AdminMcpTrialOperations['inspection']>['entitlementState'],
    jobId: row.job_id,
    quoteState: row.quote_state,
    jobState: row.job_state,
    outputPresent: row.output_present,
    reservedAt: row.reserved_at,
  };
}

async function loadOperations(
  rawInput: unknown,
  dependencies: AdminMcpTrialOperationsDependencies,
): Promise<AdminMcpTrialOperations> {
  const input = parseLoadInput(rawInput);
  if (!dependencies.isDatabaseConfigured()) return unavailable(dependencies, 'database_unavailable');
  try {
    const relations = await dependencies.executor.query<AdminMcpTrialRelationsRow>(`
      /* admin-mcp-trial:relations */
      SELECT
        to_regclass('public.mcp_trial_entitlements') IS NOT NULL AS mcp_trial_entitlements,
        to_regclass('public.mcp_generation_quotes') IS NOT NULL AS mcp_generation_quotes,
        to_regclass('public.mcp_trial_risk_events') IS NOT NULL AS mcp_trial_risk_events,
        to_regclass('public.mcp_trial_support_override_audit') IS NOT NULL AS mcp_trial_support_override_audit,
        to_regclass('public.admin_audit') IS NOT NULL AS admin_audit,
        to_regclass('public.app_jobs') IS NOT NULL AS app_jobs,
        to_regclass('public.provider_attempts') IS NOT NULL AS provider_attempts`);
    if (!relationsAvailable(relations)) return unavailable(dependencies, 'schema_unavailable');

    const summaryRows = await dependencies.executor.query<AdminMcpTrialSummaryRow>(`
      /* admin-mcp-trial:summary */
      SELECT
        (SELECT count(*) FROM mcp_generation_quotes
          WHERE funding_mode = 'trial' AND state = 'accepted')::text AS accepted_count,
        (SELECT count(*) FROM mcp_trial_entitlements WHERE status = 'reserved')::text AS reserved_count,
        (SELECT count(*) FROM mcp_trial_entitlements WHERE status = 'consumed')::text AS consumed_count,
        (SELECT count(*) FROM mcp_trial_entitlements WHERE status = 'released')::text AS released_count,
        (SELECT CASE
           WHEN count(attempt.id) FILTER (WHERE attempt.id IS NOT NULL) = 0 THEN '0'
           WHEN count(attempt.id) FILTER (
             WHERE attempt.id IS NOT NULL AND attempt.provider_cost_usd IS NULL
           ) > 0 THEN NULL
           ELSE round(COALESCE(sum(attempt.provider_cost_usd), 0) * 100)::bigint::text
         END
           FROM mcp_trial_entitlements AS entitlement
           LEFT JOIN app_jobs AS job ON job.job_id = entitlement.job_id
           LEFT JOIN provider_attempts AS attempt ON attempt.job_id = job.id
          WHERE entitlement.job_id IS NOT NULL) AS provider_cost_cents,
        (SELECT count(*)::text
           FROM mcp_trial_risk_events
          WHERE outcome IN ('blocked', 'rate_limited')
            AND created_at >= clock_timestamp() - INTERVAL '24 hours') AS suspicious_velocity_count`);
    const summary = summaryRows[0];
    if (summaryRows.length !== 1 || !summary) throw new Error('Invalid admin MCP trial summary.');
    const inspection = input.inspectionUserId === null
      ? null
      : readInspection(await dependencies.executor.query<AdminMcpTrialInspectionRow>(`
          /* admin-mcp-trial:inspection */
          SELECT entitlement.user_id,
                 entitlement.status AS entitlement_state,
                 entitlement.job_id,
                 quote.state AS quote_state,
                 job.status AS job_state,
                 (NULLIF(btrim(job.video_url), '') IS NOT NULL) AS output_present,
                 entitlement.reserved_at::text AS reserved_at
            FROM mcp_trial_entitlements AS entitlement
            LEFT JOIN mcp_generation_quotes AS quote
              ON quote.quote_id = entitlement.reserved_quote_id
            LEFT JOIN app_jobs AS job
              ON job.job_id = entitlement.job_id
           WHERE entitlement.user_id = $1
           LIMIT 1`, [input.inspectionUserId]), input.inspectionUserId);
    return {
      availability: 'available',
      reasonCode: 'loaded',
      killSwitch: killSwitch(dependencies),
      counts: {
        accepted: readCount(summary.accepted_count),
        reserved: readCount(summary.reserved_count),
        consumed: readCount(summary.consumed_count),
        released: readCount(summary.released_count),
      },
      providerCostCents: summary.provider_cost_cents === null
        ? null
        : readCount(summary.provider_cost_cents),
      suspiciousVelocity: readCount(summary.suspicious_velocity_count),
      inspection,
    };
  } catch {
    return unavailable(dependencies, 'query_unavailable');
  }
}

function readManualPreflight(
  rows: ManualReleasePreflightRow[],
  input: ManualMcpTrialReleaseInput,
): void {
  const row = rows[0];
  if (rows.length !== 1 || !row) throw new Error('MCP trial reservation was not found.');
  if (row.entitlement_state !== 'reserved') {
    throw new Error('MCP trial entitlement must be reserved for manual release.');
  }
  if (row.user_id !== input.userId
    || row.job_id !== input.jobId
    || row.reserved_quote_id !== input.jobId
    || row.job_user_id !== input.userId
    || row.payment_status !== 'included_mcp_trial'
    || typeof row.job_state !== 'string'
    || row.job_state.length < 1
    || row.job_state.length > 64
    || row.output_present !== false
    || row.quote_id !== input.jobId
    || row.quote_user_id !== input.userId
    || row.quote_job_id !== input.jobId
    || row.funding_mode !== 'trial'
    || (row.quote_state !== 'claimed' && row.quote_state !== 'accepted')) {
    throw new Error('MCP trial reservation is inconsistent and cannot be released.');
  }
}

async function manualRelease(
  rawInput: unknown,
  dependencies: AdminMcpTrialOperationsDependencies,
): Promise<{ released: true }> {
  const input = parseReleaseInput(rawInput);
  if (!dependencies.isDatabaseConfigured()) throw new Error('MCP trial operations are unavailable.');
  return dependencies.withTransaction(async (executor) => {
    const preflight = await executor.query<ManualReleasePreflightRow>(`
      /* admin-mcp-trial:manual-preflight */
      SELECT entitlement.user_id,
             entitlement.status AS entitlement_state,
             entitlement.job_id,
             entitlement.reserved_quote_id::text AS reserved_quote_id,
             job.user_id AS job_user_id,
             job.payment_status,
             job.status AS job_state,
             (NULLIF(btrim(job.video_url), '') IS NOT NULL) AS output_present,
             quote.quote_id::text AS quote_id,
             quote.user_id AS quote_user_id,
             quote.job_id AS quote_job_id,
             quote.funding_mode,
             quote.state AS quote_state
        FROM mcp_trial_entitlements AS entitlement
        INNER JOIN app_jobs AS job ON job.job_id = entitlement.job_id
        INNER JOIN mcp_generation_quotes AS quote
          ON quote.quote_id = entitlement.reserved_quote_id
       WHERE entitlement.user_id = $1
         AND entitlement.job_id = $2
       FOR UPDATE OF entitlement, job, quote`, [input.userId, input.jobId]);
    readManualPreflight(preflight, input);
    const result = await dependencies.applySupportOverride(executor, input.jobId, {
      kind: 'release',
      reason: input.reason,
    });
    if (result.funding !== 'included_trial' || result.entitlementState !== 'released') {
      throw new Error('MCP trial release did not reach the required terminal state.');
    }
    const auditRows = await executor.query<{ id: unknown }>(`
      INSERT INTO admin_audit (
        admin_id, target_user_id, action, route, metadata, created_at
      ) VALUES (
        $1::uuid, $2::uuid, 'mcp_trial_manual_release', '/admin/mcp', $3::jsonb, clock_timestamp()
      )
      RETURNING id`, [
      input.adminId,
      input.userId,
      JSON.stringify({ reasonCode: input.reason, jobId: input.jobId }),
    ]);
    if (auditRows.length !== 1
      || !auditRows[0]
      || !(typeof auditRows[0].id === 'number' || typeof auditRows[0].id === 'string')) {
      throw new Error('Admin audit entry was not persisted.');
    }
    return { released: true };
  });
}

export function createAdminMcpTrialOperationsService(
  dependencies: Partial<AdminMcpTrialOperationsDependencies> = {},
) {
  const resolved = { ...defaultDependencies, ...dependencies };
  return {
    load: (input: unknown) => loadOperations(input, resolved),
    manualRelease: (input: unknown) => manualRelease(input, resolved),
  };
}

const defaultService = createAdminMcpTrialOperationsService();

export async function loadAdminMcpTrialOperations(
  input: { inspectionUserId: string | null },
): Promise<AdminMcpTrialOperations> {
  return defaultService.load(input);
}

export async function manualReleaseMcpTrial(
  input: ManualMcpTrialReleaseInput,
): Promise<{ released: true }> {
  return defaultService.manualRelease(input);
}
