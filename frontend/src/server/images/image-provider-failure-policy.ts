import { query } from '@/lib/db';
import type { WalletReservation } from '@/server/generations/initial-job-reservation';

export function isAmbiguousImageProviderFailure(
  error: unknown,
  providerJobId: string | undefined,
): boolean {
  const status = error && typeof error === 'object' && 'status' in error
    ? Number((error as { status?: unknown }).status)
    : Number.NaN;
  if (Number.isFinite(status) && status >= 400 && status < 500) return false;
  if (providerJobId) return true;
  const name = error instanceof Error ? error.name : '';
  const message = error instanceof Error ? error.message : '';
  return !Number.isFinite(status)
    || status >= 500
    || /abort|network|socket|timeout|timed out|fetch failed|connection/iu.test(`${name} ${message}`);
}

export function shouldKeepImageProviderOutcomePending(params: {
  walletReservation: WalletReservation;
  hasTrustedQuotedBilling: boolean;
  error: unknown;
  providerJobId?: string;
}): boolean {
  return params.walletReservation === 'already_reserved'
    && params.hasTrustedQuotedBilling
    && isAmbiguousImageProviderFailure(params.error, params.providerJobId);
}

export async function markImageProviderOutcomeAmbiguous(
  jobId: string,
  providerJobId: string | undefined,
): Promise<void> {
  await query(
    `UPDATE app_jobs
        SET status = 'running',
            progress = GREATEST(COALESCE(progress, 0), 5),
            message = 'Provider acceptance is still being verified.',
            provider_job_id = COALESCE($2, provider_job_id),
            provisional = FALSE,
            updated_at = NOW()
      WHERE job_id = $1`,
    [jobId, providerJobId ?? null],
  ).catch((updateError) => {
    console.warn('[images] unable to persist ambiguous provider outcome', updateError);
  });
}
