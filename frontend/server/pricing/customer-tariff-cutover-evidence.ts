import { createHash } from 'node:crypto';
import type { ManualTariffCell } from '@maxvideoai/pricing';
import { collectSellableManualTariffCoverage } from '@/lib/pricing-audit/manual-tariff-coverage';
import { seedanceWorkflowScenarios } from '@/lib/pricing-audit/seedance-workflow-scenarios';
import { withSeedanceTariffInputDuration } from '@/lib/pricing-audit/seedance-input-tariff-scenario';
import { supportsSeedanceInputTariff } from '@/lib/seedance-input-tariff';
import { continuousInputTariffSelector } from '@/lib/pricing-manual-scenario';

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
  return JSON.stringify(value);
}
export function cutoverDigest(value: unknown): string {
  return createHash('sha256').update(canonical(value)).digest('hex');
}
export function collectCustomerTariffCutoverCheckpoints() {
  const ordinary = collectSellableManualTariffCoverage().scenarios;
  const rows = ordinary.map(scenario => ({ key: `ordinary:${scenario.id}`, kind: 'ordinary' as const, scenario }));
  const workflows = seedanceWorkflowScenarios(ordinary)
    .map(scenario => ({ key: `local_workflow:${scenario.id}`, kind: 'local_workflow' as const, scenario }));
  const stress = ordinary.filter(s => supportsSeedanceInputTariff(s.modelId, s.selector.mode, s.selector.billingInputType))
    .flatMap(s => [2, s.modelId === 'seedance-2-5' ? 30 : 15].map(seconds => ({
      key: `input_stress:${s.id}:${seconds}`, kind: 'input_stress' as const,
      scenario: withSeedanceTariffInputDuration(s, seconds),
    })));
  return [...rows, ...workflows, ...stress];
}
export type CutoverBindings = {
  databaseIdentity: string; commercialHash: string; codeRevision: string;
  registryHash: string; factualEnvironmentHash: string;
};
export type CutoverCheckpointQuote = { key: string; beforeCents: number | null; customerCents: number; currency: string };
export type CutoverApprovedChange = { key: string; beforeCents: number; customerCents: number;
  reason: 'gpt_reference_floor' | 'seedance_proportional' };
export type CustomerTariffCutoverRelease = {
  schemaVersion: 1; evidenceKind: 'isolated_operation_rehearsal' | 'deployed_production'; activationReady: false;
  capturedAt: string; bindings: CutoverBindings;
  deployedSource: { codeRevision: string; deploymentId: string };
  cells: Array<Pick<ManualTariffCell, 'id' | 'selector' | 'price' | 'currency'>>;
  checkpoints: CutoverCheckpointQuote[]; approvedChanges: CutoverApprovedChange[]; fingerprint: string;
};

/** A first production installation imports effective selectors, not obsolete
 * development staging. Archive every excluded old Seedance fixed row separately.
 * Unknown unused rows are refused rather than silently discarded. */
export function projectInitialCustomerTariffCutoverCells(cells: CustomerTariffCutoverRelease['cells']) {
  const key = (selector: object) => JSON.stringify(Object.entries(selector).sort(([a],[b]) => a.localeCompare(b)));
  const selectors = new Set(collectCustomerTariffCutoverCheckpoints().flatMap(({ scenario }) => {
    const continuous = continuousInputTariffSelector(scenario.selector);
    return [key(scenario.selector),...(continuous ? [key(continuous)] : [])];
  }));
  const effective: typeof cells = [];
  const archived: typeof cells = [];
  for (const cell of cells) {
    if (selectors.has(key(cell.selector))) { effective.push(cell); continue; }
    if (supportsSeedanceInputTariff(cell.selector.engineId,cell.selector.mode,cell.selector.billingInputType)
      && cell.selector.inputVideoDurationSec === undefined && cell.price.kind === 'fixed') archived.push(cell);
    else throw new Error('Unknown unused tariff cell; review the source grid.');
  }
  return { cells: effective,archivedLegacyCells: archived,sourceGridHash: cutoverDigest(cells),effectiveGridHash: cutoverDigest(effective) };
}

/** Integrity and complete inventory; the operator's separate approval is still required. */
export function assertCustomerTariffCutoverRelease(release: CustomerTariffCutoverRelease,
  confirmation: string, mode: 'rehearsal' | 'production') {
  const { fingerprint, ...body } = release;
  if (!confirmation || confirmation !== fingerprint || cutoverDigest(body) !== fingerprint) throw new Error('Cutover confirmation or evidence integrity is stale.');
  if (mode === 'production' && release.evidenceKind !== 'deployed_production') throw new Error('Production requires deployed production provenance.');
  if (release.schemaVersion !== 1 || release.activationReady !== false
    || !['isolated_operation_rehearsal', 'deployed_production'].includes(release.evidenceKind)) throw new Error('Invalid cutover evidence.');
  const age = Date.now() - Date.parse(release.capturedAt);
  if (!Number.isFinite(age) || age < -5_000 || age > 15 * 60_000) throw new Error('Cutover capture expired; prepare fresh evidence.');
  if (!/^[a-f0-9]{40}$/.test(release.deployedSource.codeRevision) || !release.deployedSource.deploymentId
    || !/^[a-f0-9]{40}$/.test(release.bindings.codeRevision)
    || Object.entries(release.bindings).some(([k, v]) => k !== 'codeRevision' && !/^[a-f0-9]{64}$/.test(v))) throw new Error('Invalid cutover source bindings.');
  const cases = collectCustomerTariffCutoverCheckpoints();
  const expected = new Map(cases.map(row => [row.key, row]));
  if (release.checkpoints.length !== cases.length || new Set(release.checkpoints.map(row => row.key)).size !== cases.length
    || release.checkpoints.some(row => !expected.has(row.key))) throw new Error('Complete current cutover coverage is required.');
  const changes = new Map(release.approvedChanges.map(row => [row.key, row]));
  if (changes.size !== release.approvedChanges.length) throw new Error('Duplicate approved price change.');
  let changed = 0;
  for (const row of release.checkpoints) {
    const scenario = expected.get(row.key)!;
    if (!Number.isSafeInteger(row.customerCents) || row.customerCents < 0 || row.currency !== 'USD') throw new Error('Invalid candidate amount.');
    if (scenario.kind === 'local_workflow') {
      if (row.beforeCents !== null || changes.has(row.key)) throw new Error('Local workflow is a separate new offer.');
      continue;
    }
    if (!Number.isSafeInteger(row.beforeCents) || row.beforeCents! < 0) throw new Error('Actual deployed baseline is incomplete.');
    const approval = changes.get(row.key);
    if (row.customerCents === row.beforeCents) { if (approval) throw new Error('Approved change does not change its amount.'); continue; }
    changed++;
    if (!approval || approval.beforeCents !== row.beforeCents || approval.customerCents !== row.customerCents) throw new Error('Unexplained customer price change.');
    const validFloor = approval.reason === 'gpt_reference_floor' && scenario.kind === 'ordinary'
      && ['gpt-image-2-5-flare','gpt-image-2-5-sunburst'].includes(scenario.scenario.modelId)
      && scenario.scenario.selector.mode === 'i2i' && (scenario.scenario.context.referenceImageCount ?? 0) > 0
      && row.customerCents === row.beforeCents! + 1;
    const validSeedance = approval.reason === 'seedance_proportional'
      && supportsSeedanceInputTariff(scenario.scenario.modelId, scenario.scenario.selector.mode, scenario.scenario.selector.billingInputType)
      && row.customerCents > row.beforeCents!;
    if (!validFloor && !validSeedance) throw new Error('Price change is outside the reviewed policy.');
  }
  if (changed !== changes.size || !release.cells.length) throw new Error('Candidate grid or price-change evidence is incomplete.');
}
