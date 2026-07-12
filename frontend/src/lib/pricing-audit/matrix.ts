import { comparePricingOutputs } from '@maxvideoai/pricing';
import { getVersionedPricingPolicy } from '@/lib/pricing-policy-defaults';

import { collectCanonicalPricingOutputs, type CanonicalPricingAuditOutput } from './canonical-collectors';
import { collectLegacyPricingOutputs } from './legacy-collectors';
import type { FrozenPricingOutput, PricingAuditSurface } from './types';

export type PricingAuditErrorCode =
  | 'duplicate_scenario'
  | 'missing_scenario'
  | 'invalid_quote'
  | 'unapproved_compatibility_profile';

export class PricingAuditError extends Error {
  readonly code: PricingAuditErrorCode;

  constructor(code: PricingAuditErrorCode, message: string) {
    super(message);
    this.name = 'PricingAuditError';
    this.code = code;
  }
}

export type PricingAuditMatrixRow = {
  scenarioId: string;
  engineId: string;
  surface: PricingAuditSurface;
  currentTotalCents: number;
  canonicalTotalCents: number;
  deltaCents: number;
  policySource: 'database' | 'versioned';
  policyRuleId: string;
  compatibilityProfile?: string;
  migrationState: 'legacy-authoritative-shadow-match' | 'legacy-authoritative-shadow-mismatch';
  status: 'match' | 'mismatch';
  fieldDeltas: Record<string, { current: string | number | undefined; canonical: string | number | undefined }>;
};

export type PricingAuditMatrix = {
  version: 1;
  summary: {
    scenarios: number;
    matches: number;
    mismatches: number;
    compatibilityProfiles: number;
  };
  rows: PricingAuditMatrixRow[];
};

function assertUniqueRows(rows: Array<{ scenarioId: string }>, label: string): void {
  const ids = new Set<string>();
  for (const row of rows) {
    if (ids.has(row.scenarioId)) {
      throw new PricingAuditError('duplicate_scenario', `${label} contains duplicate scenario ${row.scenarioId}`);
    }
    ids.add(row.scenarioId);
  }
}

function assertValidOutput(row: FrozenPricingOutput, label: string): void {
  for (const field of ['vendorSubtotalCents', 'marginCents', 'surchargeCents', 'customerTotalCents'] as const) {
    const value = row[field];
    if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
      throw new PricingAuditError('invalid_quote', `${label} ${row.scenarioId} has invalid ${field}`);
    }
  }
  if (!Number.isFinite(row.quantity) || row.quantity < 0 || !row.currency.trim() || !row.unit.trim()) {
    throw new PricingAuditError('invalid_quote', `${label} ${row.scenarioId} has invalid unit, quantity, or currency`);
  }
}

export function buildPricingAuditMatrixFromOutputs(
  current: FrozenPricingOutput[],
  canonical: CanonicalPricingAuditOutput[],
  approvedCompatibilityProfiles?: ReadonlySet<string>
): PricingAuditMatrix {
  assertUniqueRows(current, 'legacy outputs');
  assertUniqueRows(canonical, 'canonical outputs');
  current.forEach((row) => assertValidOutput(row, 'legacy output'));
  canonical.forEach((row) => assertValidOutput(row, 'canonical output'));
  const currentById = new Map(current.map((row) => [row.scenarioId, row]));
  const canonicalById = new Map(canonical.map((row) => [row.scenarioId, row]));
  const ids = [...new Set([...currentById.keys(), ...canonicalById.keys()])].sort();
  const rows = ids.map((scenarioId): PricingAuditMatrixRow => {
    const currentRow = currentById.get(scenarioId);
    const canonicalRow = canonicalById.get(scenarioId);
    if (!currentRow || !canonicalRow) {
      throw new PricingAuditError('missing_scenario', `missing pricing audit mapping for ${scenarioId}`);
    }
    const compatibilityProfile = canonicalRow.compatibilityProfile ?? currentRow.compatibilityProfile;
    if (
      compatibilityProfile &&
      approvedCompatibilityProfiles &&
      !approvedCompatibilityProfiles.has(compatibilityProfile)
    ) {
      throw new PricingAuditError(
        'unapproved_compatibility_profile',
        `${scenarioId} uses unapproved compatibility profile ${compatibilityProfile}`
      );
    }
    const comparison = comparePricingOutputs(scenarioId, currentRow, canonicalRow);
    return {
      scenarioId,
      engineId: canonicalRow.engineId,
      surface: currentRow.surface,
      currentTotalCents: currentRow.customerTotalCents,
      canonicalTotalCents: canonicalRow.customerTotalCents,
      deltaCents: comparison.deltaCents,
      policySource: canonicalRow.policySource,
      policyRuleId: canonicalRow.policyRuleId,
      ...(compatibilityProfile ? { compatibilityProfile } : {}),
      migrationState:
        comparison.status === 'match'
          ? 'legacy-authoritative-shadow-match'
          : 'legacy-authoritative-shadow-mismatch',
      status: comparison.status,
      fieldDeltas: comparison.fieldDeltas,
    };
  });
  const mismatches = rows.filter((row) => row.status === 'mismatch').length;
  return {
    version: 1,
    summary: {
      scenarios: rows.length,
      matches: rows.length - mismatches,
      mismatches,
      compatibilityProfiles: new Set(rows.map((row) => row.compatibilityProfile).filter(Boolean)).size,
    },
    rows,
  };
}

export async function buildPricingAuditMatrix(): Promise<PricingAuditMatrix> {
  const policy = getVersionedPricingPolicy();
  return buildPricingAuditMatrixFromOutputs(
    await collectLegacyPricingOutputs(),
    await collectCanonicalPricingOutputs(),
    new Set(policy.compatibilityProfiles.map((profile) => profile.id))
  );
}
