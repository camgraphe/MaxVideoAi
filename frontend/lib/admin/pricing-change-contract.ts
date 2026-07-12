export const PRICING_CHANGE_DOMAINS = ['policy_rule', 'membership', 'billing_product'] as const;
export const PRICING_CHANGE_OPERATIONS = ['create', 'update', 'delete', 'rollback'] as const;

export type PricingChangeDomain = (typeof PRICING_CHANGE_DOMAINS)[number];
export type PricingChangeOperation = (typeof PRICING_CHANGE_OPERATIONS)[number];

export type PricingChangeJsonValue =
  | string
  | number
  | boolean
  | null
  | PricingChangeJsonValue[]
  | { [key: string]: PricingChangeJsonValue };

export type PricingChangeJsonObject = { [key: string]: PricingChangeJsonValue };

export type PricingChangeEvent = {
  id: string;
  domain: PricingChangeDomain;
  operation: PricingChangeOperation;
  targetId: string;
  actorId: string;
  previousState: PricingChangeJsonValue | null;
  nextState: PricingChangeJsonValue | null;
  previewSummary: PricingChangeJsonObject;
  affectedScenarioIds: string[];
  createdAt: string;
};

export type InsertPricingChangeEventInput = {
  domain: PricingChangeDomain;
  operation: PricingChangeOperation;
  targetId: string;
  actorId: string;
  previousState: PricingChangeJsonValue | null;
  nextState: PricingChangeJsonValue | null;
  previewSummary: PricingChangeJsonObject;
  affectedScenarioIds: string[];
};

export type ListPricingChangeEventsInput = {
  domain?: PricingChangeDomain;
  targetId?: string;
  limit?: number;
};

export type PricingChangePreviewProvenance = {
  source: 'database' | 'versioned';
  matchedBy: 'precise' | 'engine' | 'global';
  sourceRuleId: string;
  compatibilityProfile: string;
};

export type PricingChangePreviewRow = {
  scenarioId: string;
  engineId: string;
  surface: string;
  currentTotalCents: number;
  proposedTotalCents: number;
  deltaCents: number;
  deltaPercent: number | null;
  currentProvenance: PricingChangePreviewProvenance;
  proposedProvenance: PricingChangePreviewProvenance;
  compatibilityProfile: string;
};

export type PricingChangePreview = {
  previewFingerprint: string;
  domain: PricingChangeDomain;
  operation: PricingChangeOperation;
  targetId: string;
  currentState: PricingChangeJsonValue | null;
  proposedState: PricingChangeJsonValue | null;
  affectedScenarioIds: string[];
  affectedSurfaces: string[];
  rows: PricingChangePreviewRow[];
  warnings: string[];
  rollbackEventId?: string;
};
