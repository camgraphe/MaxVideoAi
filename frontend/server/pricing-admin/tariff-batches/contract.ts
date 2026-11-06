import type { ManualTariffCell, ManualTariffSelector } from '@maxvideoai/pricing';

export const TARIFF_BATCH_PROTOCOL = 'literal-tariff-batch-v1';
// Each batch belongs to one qualified model; never mix their canonical classes.
export const TARIFF_BATCH_MAX_CLASSES = 226;
export type KlingTariffBatchModelId = 'kling-v4' | 'kling-v4-flash';
export type GptImageTariffBatchModelId = 'gpt-image-2-6-flare' | 'gpt-image-2-6-sunburst';
export type TariffBatchModelId = KlingTariffBatchModelId | GptImageTariffBatchModelId;
/** Keep HTTP admission independent of image schemas, provider adapters and their dependencies. */
export function isGptImageTariffBatchModelId(value: unknown): value is GptImageTariffBatchModelId {
  return value === 'gpt-image-2-6-flare' || value === 'gpt-image-2-6-sunburst';
}
export const TARIFF_BATCH_MAX_BYTES = 2 * 1024 * 1024;
export const TARIFF_BATCH_TTL_MS = 10 * 60 * 1000;
export type TariffBatchPrice = Extract<ManualTariffCell['price'], { kind: 'fixed' | 'unit_terms' }>;
export type TariffBatchProposal = {
  schemaVersion: 1;
  modelId: TariffBatchModelId;
  intent: 'create_missing' | 'replace_selected';
  reason: string;
  pricing: { kind: 'explicit' } | { kind: 'list_multiplier'; multiplier: string };
  selections: { selector: ManualTariffSelector; price?: TariffBatchPrice }[];
} | {
  schemaVersion: 1;
  modelId: TariffBatchModelId;
  intent: 'rollback';
  reason: string;
  sourceOperationId: string;
  selectors: ManualTariffSelector[];
};
export type TariffBatchRow = {
  key: string;
  scenarioId: string;
  selector: ManualTariffSelector;
  action: 'create' | 'update' | 'unchanged' | 'conflict';
  previousCell: ManualTariffCell | null;
  proposedCell: ManualTariffCell | null;
  currentCents: number | null;
  proposedCents: number | null;
  supplierListCents: number;
  /** True when the displayed supplier estimate excludes unqualified input costs. */
  supplierCostIncomplete?: true;
  domain?: { maxInputSeconds: number; checkedBoundaries: number; minimumGrossCents: number };
  rasterDomain?: { checkedDimensions: number; minTokensPerOutput: number; maxTokensPerOutput: number;
    maxOutputCount: number; maxReferenceCount: number; minimumOutputOnlySurplusCents: number;
    supplierCostIncomplete: true; conservativeOutput: boolean };
  issue?: string;
  rollbackEventId?: string;
};
export type TariffBatchPlan = {
  modelId: TariffBatchModelId;
  intent: TariffBatchProposal['intent'];
  reason: string;
  revision: number;
  currency: 'USD';
  datePolicy: 'server_now_per_cell';
  fullScopeCount: number;
  rows: TariffBatchRow[];
  counts: Record<TariffBatchRow['action'], number>;
};
export type TariffBatchReceipt = {
  operationId: string;
  actorId: string;
  fingerprint: string;
  sourceId: string;
  targetId: string;
  committedAt: string;
  revisionBefore: number;
  revisionAfter: number;
  plan: TariffBatchPlan;
  changes: { key: string; before: ManualTariffCell | null; after: ManualTariffCell; eventId: string }[];
  lockDurationMs: number;
};
export type TariffBatchOperation = {
  id: string;
  actorId: string;
  status: 'previewed' | 'accepted' | 'committed' | 'not_applied';
  epoch: number;
  fingerprint: string;
  createdAt: string;
  expiresAt: string;
  plan: TariffBatchPlan;
  receipt: TariffBatchReceipt | null;
  failure: string | null;
  refreshStatus: 'not_required' | 'pending' | 'complete';
  refreshError: string | null;
  operationalWarnings?: string[];
};

export type TariffBatchSummary = Pick<TariffBatchOperation, 'id' | 'status' | 'createdAt'> & {
  plan: Pick<TariffBatchPlan, 'reason' | 'counts'>;
};
