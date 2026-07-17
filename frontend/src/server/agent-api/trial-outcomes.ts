import {
  query,
  withDbTransaction,
  type QueryExecutor,
  type TransactionQueryExecutor,
} from '@/lib/db';

import {
  consumeEntitlement,
  releaseEntitlement,
  type TrialEntitlement,
} from './trial-entitlement-repository';

export type NormalizedTrialJobOutcome =
  | { kind: 'accepted' }
  | { kind: 'completed' }
  | { kind: 'rejected' }
  | { kind: 'failed' }
  | { kind: 'timeout' }
  | { kind: 'unknown' }
  | { kind: 'canceled' }
  | {
      kind: 'support_release';
      reason: 'provider_confirmed_no_output' | 'support_verified_no_output';
    };

export type TrialJobOutcomeResult =
  | { funding: 'wallet' }
  | {
      funding: 'included_trial';
      entitlementState: 'reserved' | 'consumed' | 'released';
    };

export type TrialJobStatus = Extract<TrialJobOutcomeResult, { funding: 'included_trial' }>;

type JobRow = {
  job_id: unknown;
  user_id: unknown;
  payment_status: unknown;
  status: unknown;
  video_url: unknown;
};

type QuoteRow = {
  quote_id: unknown;
  user_id: unknown;
  funding_mode: unknown;
  job_id: unknown;
  state: unknown;
};

type EntitlementRow = {
  user_id: unknown;
  status: unknown;
  reserved_quote_id: unknown;
  job_id: unknown;
};

type TrialOutcomeDependencies = {
  withTransaction<TResult>(
    callback: (executor: TransactionQueryExecutor) => Promise<TResult>,
  ): Promise<TResult>;
  consumeEntitlement: typeof consumeEntitlement;
  releaseEntitlement: typeof releaseEntitlement;
};

const defaultDependencies: TrialOutcomeDependencies = {
  withTransaction: (callback) => withDbTransaction((executor) => callback(executor)),
  consumeEntitlement,
  releaseEntitlement,
};

const SIMPLE_OUTCOMES = new Set([
  'accepted',
  'completed',
  'rejected',
  'failed',
  'timeout',
  'unknown',
  'canceled',
]);
const SIMPLE_KEYS = new Set(['kind']);
const SUPPORT_KEYS = new Set(['kind', 'reason']);
const SUPPORT_REASONS = new Set([
  'provider_confirmed_no_output',
  'support_verified_no_output',
]);
const TRIAL_STATES = new Set(['reserved', 'consumed', 'released']);
const QUOTE_STATES = new Set(['claimed', 'accepted', 'failed']);
const FINAL_FAILURE_STATUSES = new Set([
  'aborted',
  'cancelled',
  'canceled',
  'error',
  'failed',
]);
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@|+-]*$/u;

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

function normalizeOutcome(value: unknown): NormalizedTrialJobOutcome {
  const simple = exactPlainRecord(value, SIMPLE_KEYS);
  if (simple && typeof simple.kind === 'string' && SIMPLE_OUTCOMES.has(simple.kind)) {
    return { kind: simple.kind } as NormalizedTrialJobOutcome;
  }
  const support = exactPlainRecord(value, SUPPORT_KEYS);
  if (support
    && support.kind === 'support_release'
    && typeof support.reason === 'string'
    && SUPPORT_REASONS.has(support.reason)) {
    return {
      kind: 'support_release',
      reason: support.reason as Extract<
        NormalizedTrialJobOutcome,
        { kind: 'support_release' }
      >['reason'],
    };
  }
  throw new Error('Invalid trial job outcome.');
}

function requireJobId(value: unknown): string {
  if (typeof value !== 'string'
    || value.length < 1
    || value.length > 256
    || value !== value.trim()
    || !IDENTIFIER_PATTERN.test(value)) {
    throw new Error('Invalid trial job id.');
  }
  return value;
}

function boundedIdentifier(value: unknown, maxLength: number): value is string {
  return typeof value === 'string'
    && value.length >= 1
    && value.length <= maxLength
    && value === value.trim()
    && IDENTIFIER_PATTERN.test(value);
}

function exactlyOne<T>(rows: T[], message: string): T {
  if (rows.length !== 1) throw new Error(message);
  return rows[0]!;
}

function readJob(row: JobRow, jobId: string): {
  jobId: string;
  userId: string;
  paymentStatus: string;
  status: string;
  videoUrl: string | null;
} {
  if (row.job_id !== jobId
    || !boundedIdentifier(row.user_id, 128)
    || typeof row.payment_status !== 'string'
    || typeof row.status !== 'string'
    || row.status.length < 1
    || row.status.length > 64
    || !(row.video_url === null
      || (typeof row.video_url === 'string'
        && row.video_url.length >= 1
        && row.video_url.length <= 2_048
        && row.video_url === row.video_url.trim()))) {
    throw new Error('Invalid trial job row.');
  }
  return {
    jobId,
    userId: row.user_id,
    paymentStatus: row.payment_status,
    status: row.status,
    videoUrl: row.video_url,
  };
}

function readQuote(
  row: QuoteRow,
  jobId: string,
  userId: string,
): 'claimed' | 'accepted' | 'failed' {
  if (row.quote_id !== jobId
    || row.job_id !== jobId
    || row.user_id !== userId
    || row.funding_mode !== 'trial'
    || typeof row.state !== 'string'
    || !QUOTE_STATES.has(row.state)) {
    throw new Error('Invalid trial quote relationship.');
  }
  return row.state as 'claimed' | 'accepted' | 'failed';
}

function readEntitlement(
  row: EntitlementRow,
  jobId: string,
  userId: string,
): 'reserved' | 'consumed' | 'released' {
  if (row.user_id !== userId
    || row.reserved_quote_id !== jobId
    || row.job_id !== jobId
    || typeof row.status !== 'string'
    || !TRIAL_STATES.has(row.status)) {
    throw new Error('Invalid trial entitlement relationship.');
  }
  return row.status as 'reserved' | 'consumed' | 'released';
}

async function markQuoteAccepted(
  executor: TransactionQueryExecutor,
  jobId: string,
  userId: string,
): Promise<void> {
  const rows = await executor.query<{ state: unknown }>(
    `UPDATE mcp_generation_quotes
        SET state = 'accepted', updated_at = clock_timestamp()
      WHERE quote_id = $1::uuid
        AND job_id = $1::text
        AND user_id = $2
        AND funding_mode = 'trial'
        AND state = 'claimed'
    RETURNING state`,
    [jobId, userId],
  );
  if (rows.length !== 1 || rows[0]?.state !== 'accepted') {
    throw new Error('Trial quote acceptance was not persisted.');
  }
}

async function markQuoteFailed(
  executor: TransactionQueryExecutor,
  jobId: string,
  userId: string,
): Promise<void> {
  const rows = await executor.query<{ state: unknown }>(
    `UPDATE mcp_generation_quotes
        SET state = 'failed', updated_at = clock_timestamp()
      WHERE quote_id = $1::uuid
        AND job_id = $1::text
        AND user_id = $2
        AND funding_mode = 'trial'
        AND state IN ('claimed', 'accepted')
    RETURNING state`,
    [jobId, userId],
  );
  if (rows.length !== 1 || rows[0]?.state !== 'failed') {
    throw new Error('Trial quote failure was not persisted.');
  }
}

async function recordSupportOverride(
  executor: TransactionQueryExecutor,
  jobId: string,
  userId: string,
  reason: Extract<NormalizedTrialJobOutcome, { kind: 'support_release' }>['reason'],
): Promise<void> {
  await executor.query(
    `INSERT INTO mcp_audit_events (
       event_type, user_id, oauth_client_id, tool_name, outcome,
       surface, engine_id, error_code
     ) VALUES (
       'trial_support_override', $1, NULL, 'trial_support_override:' || $3,
       'success', 'video', 'seedance-2-0-mini', $2
     )`,
    [userId, reason, jobId],
  );
}

function publicResult(
  entitlementState: 'reserved' | 'consumed' | 'released',
): TrialJobOutcomeResult {
  return { funding: 'included_trial', entitlementState };
}

export async function readTrialJobStatus(
  input: { userId: string; jobId: string },
  dependencies: { executor: QueryExecutor } = { executor: { query } },
): Promise<TrialJobStatus | null> {
  const record = exactPlainRecord(input, new Set(['userId', 'jobId']));
  if (!record
    || !boundedIdentifier(record.userId, 128)
    || requireJobId(record.jobId) !== record.jobId) {
    throw new Error('Invalid trial status input.');
  }
  const rows = await dependencies.executor.query<{
    funding: unknown;
    entitlement_state: unknown;
  }>(
    `SELECT 'included_trial'::text AS funding,
            entitlement.status AS entitlement_state
       FROM app_jobs AS job
       JOIN mcp_generation_quotes AS quote
         ON quote.quote_id::text = job.job_id
        AND quote.job_id = job.job_id
        AND quote.user_id = job.user_id
        AND quote.funding_mode = 'trial'
       JOIN mcp_trial_entitlements AS entitlement
         ON entitlement.reserved_quote_id = quote.quote_id
        AND entitlement.job_id = job.job_id
        AND entitlement.user_id = job.user_id
      WHERE job.job_id = $1
        AND job.user_id = $2
        AND job.payment_status = 'included_mcp_trial'
      LIMIT 1`,
    [record.jobId, record.userId],
  );
  if (rows.length === 0) return null;
  if (rows.length !== 1
    || rows[0]?.funding !== 'included_trial'
    || typeof rows[0]?.entitlement_state !== 'string'
    || !TRIAL_STATES.has(rows[0].entitlement_state)) {
    throw new Error('Invalid trial status result.');
  }
  return publicResult(
    rows[0].entitlement_state as 'reserved' | 'consumed' | 'released',
  ) as TrialJobStatus;
}

export async function applyTrialJobOutcome(
  rawJobId: string,
  rawOutcome: NormalizedTrialJobOutcome,
  dependencies: TrialOutcomeDependencies = defaultDependencies,
): Promise<TrialJobOutcomeResult> {
  const jobId = requireJobId(rawJobId);
  const outcome = normalizeOutcome(rawOutcome);
  return dependencies.withTransaction(async (executor) => {
    const job = readJob(exactlyOne(await executor.query<JobRow>(
      `SELECT job_id, user_id, payment_status, status, video_url
         FROM app_jobs
        WHERE job_id = $1
        FOR UPDATE`,
      [jobId],
    ), 'Trial job was not found.'), jobId);
    if (job.paymentStatus !== 'included_mcp_trial') return { funding: 'wallet' };

    const quoteState = readQuote(exactlyOne(await executor.query<QuoteRow>(
      `SELECT quote_id::text AS quote_id, user_id, funding_mode, job_id, state
         FROM mcp_generation_quotes
        WHERE quote_id = $1::uuid
          AND job_id = $1::text
        FOR UPDATE`,
      [jobId],
    ), 'Trial quote was not found.'), jobId, job.userId);
    const entitlementState = readEntitlement(exactlyOne(
      await executor.query<EntitlementRow>(
        `SELECT user_id, status, reserved_quote_id::text AS reserved_quote_id, job_id
           FROM mcp_trial_entitlements
          WHERE job_id = $1
          FOR UPDATE`,
        [jobId],
      ),
      'Trial entitlement was not found.',
    ), jobId, job.userId);
    const lifecycleConsistent = entitlementState === 'reserved'
      ? quoteState === 'claimed' || quoteState === 'accepted'
      : entitlementState === 'consumed'
        ? quoteState === 'accepted'
        : quoteState === 'failed';
    if (!lifecycleConsistent) throw new Error('Inconsistent trial lifecycle state.');

    if (outcome.kind === 'accepted') {
      if (entitlementState === 'reserved' && quoteState === 'claimed') {
        await markQuoteAccepted(executor, jobId, job.userId);
      }
      return publicResult(entitlementState);
    }
    if (outcome.kind === 'timeout' || outcome.kind === 'unknown') {
      return publicResult(entitlementState);
    }
    if (outcome.kind === 'completed') {
      if (job.status !== 'completed' || !job.videoUrl) {
        throw new Error('Trial consumption requires a durable completed output.');
      }
      if (entitlementState !== 'reserved') return publicResult(entitlementState);
      const consumed = await dependencies.consumeEntitlement({
        userId: job.userId,
        quoteId: jobId,
        jobId,
        reasonCode: 'output_completed',
      }, { executor });
      if (!consumed) return publicResult(entitlementState);
      if (consumed.status !== 'consumed') {
        throw new Error('Invalid consumed trial entitlement result.');
      }
      if (quoteState === 'claimed') await markQuoteAccepted(executor, jobId, job.userId);
      return publicResult('consumed');
    }

    if (job.videoUrl) throw new Error('A trial cannot release after an output exists.');
    if (entitlementState !== 'reserved') return publicResult(entitlementState);
    if (outcome.kind !== 'support_release'
      && !FINAL_FAILURE_STATUSES.has(job.status.trim().toLowerCase())) {
      throw new Error('Trial release requires a durable definitive failure.');
    }
    const reasonCode = outcome.kind === 'support_release'
      ? outcome.reason
      : outcome.kind === 'canceled'
        ? 'provider_canceled'
        : outcome.kind === 'rejected'
          ? 'provider_rejected'
          : 'provider_failed';
    const released: TrialEntitlement | null = await dependencies.releaseEntitlement({
      userId: job.userId,
      quoteId: jobId,
      jobId,
      reasonCode,
    }, { executor });
    if (!released) return publicResult(entitlementState);
    if (released.status !== 'released') {
      throw new Error('Invalid released trial entitlement result.');
    }
    if (outcome.kind === 'support_release') {
      await recordSupportOverride(executor, jobId, job.userId, outcome.reason);
    }
    await markQuoteFailed(executor, jobId, job.userId);
    return publicResult('released');
  });
}
