import type { ManualTariffCell, ManualTariffSelector } from '@maxvideoai/pricing';

import type { PricingChangeEvent } from '@/lib/admin/pricing-change-contract';
import type { ProviderCostComparisonRow } from './provider-cost-comparison';

export type CustomerTariffInventoryRow = {
  modelId: string;
  familyId: string;
  mediaType: 'video' | 'image';
  scenarioId: string;
  selector: ManualTariffSelector;
  currentCents: number | null;
  currency: string;
  stagedCents: number | null;
  supplierListUsd: number | null;
  supplierEffectiveUsd: number | null;
  supplierObservedUsd: number | null;
  supplierComparison: ProviderCostComparisonRow;
};

export type CustomerTariffInventory = {
  active: boolean;
  revision: number | null;
  databaseStatus: 'loaded' | 'unavailable';
  coverageGapCount: number;
  rows: CustomerTariffInventoryRow[];
};

export type CustomerTariffScenarioChoice = {
  key: string;
  value: string;
  options: string[];
  range?: { minExclusive?: number; minInclusive?: number; max: number };
};

export type CustomerTariffScenarioDetail = {
  modelId: string;
  scenarioId: string;
  tariffCellId: string;
  selector: ManualTariffSelector;
  choices: CustomerTariffScenarioChoice[];
  currentCents: number | null;
  stagedCents: number | null;
  currency: string;
  supplierComparison: ProviderCostComparisonRow;
  continuousInputTariff?: {
    kind?: 'video' | 'audio';
    outputVaries?: boolean;
    tariffCellId: string;
    prepared: boolean;
    price: ManualTariffCell['price'];
    outputCents: number;
    inputCentsPerSecond: number;
    maxInputSeconds: number;
    minInputSeconds?: number | null;
  };
};

export type CustomerTariffChangeProposal =
  | { operation: 'create' | 'update'; scenarioId: string; customerCents: number }
  | { operation: 'create' | 'update'; scenarioId: string; scope: 'continuous_input'; price:
      { kind: 'preserve_current' } | { kind: 'linear_input'; outputCents: number; inputCentsPerSecond: number }
      | { kind: 'linear_video'; outputCentsPerSecond: number; inputCentsPerSecond: number } }
  | { operation: 'delete'; scenarioId: string; scope?: 'continuous_input' }
  | { operation: 'rollback'; scenarioId: string; eventId: string; scope?: 'continuous_input' };

export type CustomerTariffChangePreview = {
  fingerprint: string;
  operation: CustomerTariffChangeProposal['operation'];
  scenarioId: string;
  modelId: string;
  selector: ManualTariffSelector;
  currentCents: number;
  proposedCents: number | null;
  currency: string;
  revision: number;
  active: boolean;
  previousCell: ManualTariffCell | null;
  proposedCell: ManualTariffCell | null;
  rollbackEventId?: string;
  warnings: string[];
  continuousInputRange?: { maxInputSeconds: number; checkedBoundaries: number; minimumGrossCents: number };
};

export type CustomerTariffChangeConfirmation = {
  committed: true;
  revision: number;
  event: PricingChangeEvent;
  preview: CustomerTariffChangePreview;
  operationalWarnings: string[];
};
