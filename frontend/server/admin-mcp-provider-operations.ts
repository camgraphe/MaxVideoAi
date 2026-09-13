import type { QueryExecutor } from '@/lib/db';
import {
  PROVIDER_COST_SQL,
  PROVIDER_OPERATIONS_SQL,
} from '@/server/admin-mcp-metrics-queries';

export type AdminMcpProviderCosts = {
  attempts: number;
  trialAttempts: number;
  missingCostAttempts: number;
  providerCostCents: number;
  trialCostCents: number;
};

export type AdminMcpProviderOperation = {
  provider: string;
  attempts: number;
  accepted: number;
  completed: number;
  failed: number;
  fallbacks: number;
  stalledPolling: number;
  providerCostCents: number | null;
  averageAcceptanceLatencyMs: number | null;
  averageTerminalLatencyMs: number | null;
};

type ProviderOperationsRow = {
  provider: string;
  attempt_count: number | string | null;
  accepted_count: number | string | null;
  completed_count: number | string | null;
  failed_count: number | string | null;
  fallback_count: number | string | null;
  stalled_polling_count: number | string | null;
  missing_cost_attempts: number | string | null;
  provider_cost_cents: number | string | null;
  average_acceptance_latency_ms: number | string | null;
  average_terminal_latency_ms: number | string | null;
};

type ProviderCostRow = {
  attempt_count: number | string | null;
  trial_attempt_count: number | string | null;
  missing_cost_attempts: number | string | null;
  provider_cost_cents: number | string | null;
  trial_cost_cents: number | string | null;
};

function count(value: number | string | null | undefined): number {
  const parsed = typeof value === 'string' ? Number(value) : value;
  if (!Number.isSafeInteger(parsed) || (parsed as number) < 0) {
    throw new Error('Invalid provider operations aggregate returned by the database.');
  }
  return parsed as number;
}

function nullableCount(value: number | string | null | undefined): number | null {
  return value === null || value === undefined ? null : count(value);
}

export async function loadAdminMcpProviderCosts(
  executor: QueryExecutor,
  range: Readonly<{ from: Date; to: Date }>,
): Promise<AdminMcpProviderCosts> {
  const row = (await executor.query<ProviderCostRow>(
    PROVIDER_COST_SQL,
    [range.from, range.to],
  ))[0];
  if (!row) throw new Error('Missing provider cost aggregate.');
  const attempts = count(row.attempt_count);
  const trialAttempts = count(row.trial_attempt_count);
  return {
    attempts,
    trialAttempts,
    missingCostAttempts: count(row.missing_cost_attempts),
    providerCostCents: attempts === 0 ? 0 : count(row.provider_cost_cents),
    trialCostCents: trialAttempts === 0 ? 0 : count(row.trial_cost_cents),
  };
}

export async function loadAdminMcpProviderOperations(
  executor: QueryExecutor,
  range: Readonly<{ from: Date; to: Date }>,
): Promise<AdminMcpProviderOperation[]> {
  const rows = await executor.query<ProviderOperationsRow>(
    PROVIDER_OPERATIONS_SQL,
    [range.from, range.to],
  );
  return rows.map((row) => {
    if (typeof row.provider !== 'string' || !row.provider.trim()) {
      throw new Error('Invalid provider operations dimension.');
    }
    const missingCostAttempts = count(row.missing_cost_attempts);
    return {
      provider: row.provider,
      attempts: count(row.attempt_count),
      accepted: count(row.accepted_count),
      completed: count(row.completed_count),
      failed: count(row.failed_count),
      fallbacks: count(row.fallback_count),
      stalledPolling: count(row.stalled_polling_count),
      providerCostCents: missingCostAttempts > 0 ? null : nullableCount(row.provider_cost_cents),
      averageAcceptanceLatencyMs: nullableCount(row.average_acceptance_latency_ms),
      averageTerminalLatencyMs: nullableCount(row.average_terminal_latency_ms),
    };
  });
}
