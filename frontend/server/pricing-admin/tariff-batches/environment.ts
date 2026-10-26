import type { QueryExecutor } from '@/lib/db';
import { PricingAdminError } from '../errors';

export type TariffBatchIdentity = { sourceId: string; targetId: string };
export function tariffBatchIdentity(): TariffBatchIdentity | null {
  if (process.env.PRICING_ADMIN_BATCHES_ENABLED !== '1') return null;
  const targetId = process.env.PRICING_ADMIN_BATCHES_TARGET_ID ?? '';
  let sourceId = process.env.VERCEL_GIT_COMMIT_SHA ?? '';
  if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    // Development admission is restricted to a local Unix socket, never a remote database.
    try {
      const url = new URL(process.env.DATABASE_URL ?? '');
      const hosts = url.searchParams.getAll('host');
      if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hostname !== 'localhost' || hosts.length !== 1
        || !hosts[0]?.startsWith('/') || [...url.searchParams.keys()].some(key => key !== 'host')) return null;
    } catch { return null; }
    sourceId = process.env.PRICING_ADMIN_BATCHES_SOURCE_ID ?? '';
  }
  if (!/^[a-f0-9]{40}$/.test(sourceId) || !/^[a-f0-9-]{36}$/i.test(targetId)) return null;
  return { sourceId, targetId };
}
export async function requireTariffBatchAdmission(executor: QueryExecutor): Promise<TariffBatchIdentity> {
  const identity = tariffBatchIdentity();
  if (!identity) throw new PricingAdminError('unsupported_scenario', 'Tariff batches are disabled for this deployment.');
  const [control] = await executor.query<{ enabled: boolean; source_id: string; target_id: string }>(
    'SELECT enabled, source_id, target_id FROM app_tariff_batch_control WHERE singleton = TRUE FOR SHARE');
  if (!control?.enabled || control.source_id !== identity.sourceId || control.target_id !== identity.targetId) {
    throw new PricingAdminError('unsupported_scenario', 'Tariff batches are disabled or the deployment source has changed.');
  }
  return identity;
}
