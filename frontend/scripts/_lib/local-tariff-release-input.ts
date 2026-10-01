import type { EffectiveCustomerTariffBaseline } from '@/lib/pricing-audit/manual-tariff-coverage';
import type { ApprovedGptImage25ReferenceFloor } from '@/server/pricing/customer-tariff-reviewed-seed';

/** Public routing/rate facts only: credentials never enter release bindings. */
export const LOCAL_TARIFF_FACTUAL_ENVIRONMENT_KEYS = [
  'LUMARAY2_BASE_5S_540P_USD', 'LUMARAY2_FLASH_BASE_5S_540P_USD',
  'LUMARAY2_MODIFY_PER_SECOND_USD', 'LUMARAY2_FLASH_MODIFY_PER_SECOND_USD',
  'LUMARAY2_REFRAME_PER_SECOND_USD', 'LUMARAY2_FLASH_REFRAME_PER_SECOND_USD',
  'BYTEPLUS_ARK_REGION',
  'SEEDANCE_1_5_PROVIDER', 'SEEDANCE_1_5_BYTEPLUS_ENABLED',
  'SEEDANCE_1_5_BYTEPLUS_ADMIN_ONLY', 'SEEDANCE_1_5_BYTEPLUS_MODES',
  'SEEDANCE_2_PROVIDER', 'SEEDANCE_2_BYTEPLUS_ADMIN_ONLY', 'SEEDANCE_2_BYTEPLUS_MODES',
  'SEEDANCE_FAST_PROVIDER', 'SEEDANCE_FAST_BYTEPLUS_ADMIN_ONLY', 'SEEDANCE_FAST_BYTEPLUS_MODES',
  'SEEDANCE_MINI_BYTEPLUS_ADMIN_ONLY', 'SEEDANCE_MINI_BYTEPLUS_MODES',
  'SEEDANCE_2_5_PROVIDER', 'SEEDANCE_2_5_BYTEPLUS_ENABLED',
  'SEEDANCE_2_5_BYTEPLUS_ADMIN_ONLY', 'SEEDANCE_2_5_BYTEPLUS_MODES', 'SEEDANCE_2_5_LAS_ENABLED',
] as const;

export function localTariffFactualEnvironment(env: Record<string, string>): Record<string, string> {
  return Object.fromEntries(LOCAL_TARIFF_FACTUAL_ENVIRONMENT_KEYS
    .filter(key => Boolean(env[key]?.trim())).map(key => [key, env[key]]));
}

/** Validate before creating a client. Only the sandbox file's Unix socket is accepted. */
export function localTariffReleaseConnection(env: Record<string, string>): string {
  try {
    const address = new URL(env.DATABASE_URL);
    const hosts = address.searchParams.getAll('host');
    if (env.PRICING_SANDBOX !== '1' || !['postgresql:', 'postgres:'].includes(address.protocol)
      || !['localhost', '127.0.0.1'].includes(address.hostname) || hosts.length !== 1 || !hosts[0].startsWith('/')
      || [...address.searchParams.keys()].some(key => key !== 'host')) throw new Error('Invalid sandbox');
    return env.DATABASE_URL;
  } catch { throw new Error('Local tariff preparation requires an isolated Unix socket sandbox'); }
}

/** Carry reviewed IDs/amounts across a rebase, never broaden or recalculate the approved increases. */
export function refreshLocalReferenceFloorApproval(approval: ApprovedGptImage25ReferenceFloor,
  baseline: EffectiveCustomerTariffBaseline & { databaseRulesHash: string }): ApprovedGptImage25ReferenceFloor {
  const rows = new Map(baseline.rows.map(row => [row.scenarioId, row]));
  if (approval.databaseRulesHash !== baseline.databaseRulesHash || approval.databaseIdentity !== baseline.databaseIdentity
    || !Number.isFinite(Date.parse(approval.capturedAt)) || !Number.isFinite(Date.parse(baseline.at))
    || Date.parse(approval.capturedAt) > Date.parse(baseline.at) || !approval.changes.length
    || approval.changes.some(change => rows.get(change.scenarioId)?.customerCents !== change.currentCustomerCents)) {
    throw new Error('Recorded reference-floor approval no longer matches the local capture');
  }
  // The reviewed seed owner subsequently validates every model/mode, exact +1c,
  // uniqueness and current supplier ceiling against the fresh factual projection.
  return { ...approval, capturedAt: baseline.at, registryHash: baseline.registryHash };
}
