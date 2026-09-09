import { comparePricingOutputs } from '@maxvideoai/pricing';
import { getVersionedPricingPolicy } from '@/lib/pricing-policy-defaults';

import { collectCanonicalPricingOutputs, type CanonicalPricingAuditOutput } from './canonical-collectors';
import {
  APPROVED_PRICING_AUDIT_CHANGES,
  type ApprovedPricingAuditChange,
} from './approved-changes';
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
  migrationState: 'frozen-baseline-match' | 'reviewed-pricing-change' | 'frozen-baseline-mismatch';
  status: 'match' | 'approved-change' | 'mismatch';
  approvalReason?: string;
  fieldDeltas: Record<string, { current: string | number | undefined; canonical: string | number | undefined }>;
};

export type PricingAuditMatrix = {
  version: 1;
  summary: {
    scenarios: number;
    matches: number;
    approvedChanges: number;
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

function matchesApprovedChange(
  approval: ApprovedPricingAuditChange | undefined,
  fieldDeltas: PricingAuditMatrixRow['fieldDeltas'],
): approval is ApprovedPricingAuditChange {
  if (!approval) return false;
  const actualFields = Object.keys(fieldDeltas).sort();
  const approvedFields = Object.keys(approval.fieldDeltas).sort();
  if (actualFields.length !== approvedFields.length) return false;
  return actualFields.every((field, index) => {
    if (field !== approvedFields[index]) return false;
    const actual = fieldDeltas[field];
    const expected = approval.fieldDeltas[field];
    return actual?.current === expected?.current && actual?.canonical === expected?.canonical;
  });
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
  approvedCompatibilityProfiles?: ReadonlySet<string>,
  approvedChanges: readonly ApprovedPricingAuditChange[] = [],
): PricingAuditMatrix {
  assertUniqueRows(current, 'frozen baseline outputs');
  assertUniqueRows(canonical, 'canonical outputs');
  current.forEach((row) => assertValidOutput(row, 'frozen baseline output'));
  canonical.forEach((row) => assertValidOutput(row, 'canonical output'));
  const currentById = new Map(current.map((row) => [row.scenarioId, row]));
  const canonicalById = new Map(canonical.map((row) => [row.scenarioId, row]));
  const approvedChangesById = new Map(approvedChanges.map((change) => [change.scenarioId, change]));
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
    const approval = comparison.status === 'mismatch' ? approvedChangesById.get(scenarioId) : undefined;
    const approved = matchesApprovedChange(approval, comparison.fieldDeltas);
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
          ? 'frozen-baseline-match'
          : approved
            ? 'reviewed-pricing-change'
          : 'frozen-baseline-mismatch',
      status: comparison.status === 'match' ? 'match' : approved ? 'approved-change' : 'mismatch',
      ...(approved ? { approvalReason: approval.reason } : {}),
      fieldDeltas: comparison.fieldDeltas,
    };
  });
  const mismatches = rows.filter((row) => row.status === 'mismatch').length;
  const approvedChangesCount = rows.filter((row) => row.status === 'approved-change').length;
  return {
    version: 1,
    summary: {
      scenarios: rows.length,
      matches: rows.length - mismatches - approvedChangesCount,
      approvedChanges: approvedChangesCount,
      mismatches,
      compatibilityProfiles: new Set(rows.map((row) => row.compatibilityProfile).filter(Boolean)).size,
    },
    rows,
  };
}

export function findUnprofiledCrossSurfaceDifferences(rows: FrozenPricingOutput[]): string[] {
  const groups = new Map<string, FrozenPricingOutput[]>();
  for (const row of rows) {
    if (!row.equivalenceKey) continue;
    const group = groups.get(row.equivalenceKey) ?? [];
    group.push(row);
    groups.set(row.equivalenceKey, group);
  }
  const missing: string[] = [];
  for (const [key, group] of groups) {
    if (new Set(group.map((row) => row.customerTotalCents)).size <= 1) continue;
    for (const row of group) {
      if (!row.compatibilityProfile) missing.push(`${key}:${row.scenarioId}`);
    }
  }
  return missing.sort();
}

export function validateFrozenPricingBaseline(rows: FrozenPricingOutput[]): void {
  assertUniqueRows(rows, 'frozen baseline outputs');
  rows.forEach((row) => assertValidOutput(row, 'frozen baseline output'));
}

export async function buildPricingAuditMatrix(
  frozenBaseline: FrozenPricingOutput[]
): Promise<PricingAuditMatrix> {
  const policy = getVersionedPricingPolicy();
  return buildPricingAuditMatrixFromOutputs(
    frozenBaseline,
    collectCanonicalPricingOutputs(frozenBaseline),
    new Set(policy.compatibilityProfiles.map((profile) => profile.id)),
    APPROVED_PRICING_AUDIT_CHANGES,
  );
}
