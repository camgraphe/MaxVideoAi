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
  range?: { minExclusive: number; max: number };
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
};

export type CustomerTariffChangeProposal =
  | { operation: 'create' | 'update'; scenarioId: string; customerCents: number }
  | { operation: 'delete'; scenarioId: string }
  | { operation: 'rollback'; scenarioId: string; eventId: string };

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
};

export type CustomerTariffChangeConfirmation = {
  committed: true;
  revision: number;
  event: PricingChangeEvent;
  preview: CustomerTariffChangePreview;
  operationalWarnings: string[];
};
