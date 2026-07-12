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
