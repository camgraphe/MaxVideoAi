import { createHash } from 'node:crypto';
import type { ManualTariffCell } from '@maxvideoai/pricing';
import { auditReviewedCustomerTariffSeed } from './customer-tariff-reviewed-seed';

export type LocalTariffReleaseBindings = {
  registryHash: string;
  databaseRulesHash: string;
  databaseIdentity: string;
  sourceTariffRevision: number;
  sourceTariffStateHash: string;
  codeRevision: string;
  factualEnvironmentHash: string;
};
type ReviewedInput = Parameters<typeof auditReviewedCustomerTariffSeed>[0];

/** Stable hashes bind full authored amounts and audit details, not just counts. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value)
    .filter(([, child]) => child !== undefined).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`).join(',')}}`;
  return JSON.stringify(value);
}
function digest(value: unknown): string { return createHash('sha256').update(canonical(value)).digest('hex'); }

/** Local preparation only. No writes, switches, or proof of effective production parity. */
export async function prepareLocalCustomerTariffRelease(input: ReviewedInput & {
  sourceTariffRevision: number; sourceTariffStateHash: string; codeRevision: string; factualEnvironmentHash: string;
}) {
  if (!Number.isSafeInteger(input.sourceTariffRevision) || input.sourceTariffRevision < 0) throw new Error('Invalid source tariff revision');
  if (!input.sourceTariffStateHash?.trim() || !input.codeRevision?.trim() || !input.factualEnvironmentHash?.trim()) throw new Error('Source state, factual environment and code bindings are required');
  const audit = await auditReviewedCustomerTariffSeed(input);
  const cells: ManualTariffCell[] = audit.cells.map(cell => ({ ...cell, source: 'versioned' as const }))
    .sort((a, b) => a.id.localeCompare(b.id));
  const seed = { schemaVersion: 1 as const, active: false as const, cells };
  const bindings: LocalTariffReleaseBindings = {
    registryHash: audit.registryHash, databaseRulesHash: audit.databaseRulesHash,
    databaseIdentity: audit.databaseIdentity!, sourceTariffRevision: input.sourceTariffRevision,
    sourceTariffStateHash: input.sourceTariffStateHash, codeRevision: input.codeRevision,
    factualEnvironmentHash: input.factualEnvironmentHash,
  };
  const body = {
    schemaVersion: 1 as const,
    evidenceEnvironment: 'isolated_local_sandbox' as const,
    activationReady: false as const,
    localCoverageReady: !audit.remainingCoverageGaps.length && !audit.settlementGuardFailures.length,
    capturedAt: audit.capturedAt, bindings, candidateHash: digest(seed), baselineHash: digest(input.baseline),
    scenarioHash: digest(input.scenarios.map(row => {
      const { engine, ...context } = row.context;
      // Catalog implementation is bound by codeRevision. Do not duplicate each
      // entire engine schema for every scenario in a large matrix hash.
      return { id: row.id, selector: row.selector, quantities: row.quantities, context: { ...context, engineId: engine.id } };
    }).sort((a, b) => a.id.localeCompare(b.id))),
    candidateCellCount: cells.length, checkedScenarios: audit.checkedScenarios,
    quotedScenarios: audit.quotedScenarios,
    unchangedScenarios: audit.quotedScenarios - audit.approvedPriceChanges.length,
    approvedPriceChanges: audit.approvedPriceChanges,
    reviewedContinuousClasses: audit.reviewedContinuousClasses,
    remainingCoverageGaps: audit.remainingCoverageGaps,
    settlementGuardFailures: audit.settlementGuardFailures,
    releaseGates: ['complete_supported_domain_coverage', 'fresh_effective_production_parity',
      'locked_atomic_activation_and_immutable_event'] as const,
  };
  return { seed, report: { ...body, fingerprint: digest(body) } };
}
export type LocalCustomerTariffRelease = Awaited<ReturnType<typeof prepareLocalCustomerTariffRelease>>;

/** Integrity/readiness check for local artifacts; deliberately not an activation API. */
export function assertLocalCustomerTariffReleaseReady(release: LocalCustomerTariffRelease, current: LocalTariffReleaseBindings): void {
  const { fingerprint, ...body } = release.report;
  if (digest(body) !== fingerprint || digest(release.seed) !== body.candidateHash) throw new Error('Local release evidence integrity failed');
  if (digest(body.bindings) !== digest(current)) throw new Error('Registry, policy, code or source tariff state changed');
  if (body.remainingCoverageGaps.length) throw new Error('Supported tariff coverage is incomplete');
  if (body.settlementGuardFailures.length || body.quotedScenarios !== body.checkedScenarios) throw new Error('Settlement quote acceptance is incomplete');
  if (!body.localCoverageReady || !body.checkedScenarios) throw new Error('Local tariff release is incomplete');
}
