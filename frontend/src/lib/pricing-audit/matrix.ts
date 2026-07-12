import { comparePricingOutputs } from '@maxvideoai/pricing';

import { collectCanonicalPricingOutputs } from './canonical-collectors';
import { collectLegacyPricingOutputs } from './legacy-collectors';
import type { PricingAuditSurface } from './types';

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

export async function buildPricingAuditMatrix(): Promise<PricingAuditMatrix> {
  const current = await collectLegacyPricingOutputs();
  const canonical = await collectCanonicalPricingOutputs();
  const currentById = new Map(current.map((row) => [row.scenarioId, row]));
  const canonicalById = new Map(canonical.map((row) => [row.scenarioId, row]));
  const ids = [...new Set([...currentById.keys(), ...canonicalById.keys()])].sort();
  const rows = ids.map((scenarioId): PricingAuditMatrixRow => {
    const currentRow = currentById.get(scenarioId);
    const canonicalRow = canonicalById.get(scenarioId);
    if (!currentRow || !canonicalRow) throw new Error(`Missing pricing audit mapping for ${scenarioId}`);
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
      ...(canonicalRow.compatibilityProfile ? { compatibilityProfile: canonicalRow.compatibilityProfile } : {}),
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
