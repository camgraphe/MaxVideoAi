import type { PricingPolicyRule } from '@maxvideoai/pricing';

import type {
  InsertPricingChangeEventInput,
  ListPricingChangeEventsInput,
  PricingChangeDomain,
  PricingChangeEvent,
  PricingChangeJsonValue,
  PricingChangeOperation,
} from '@/lib/admin/pricing-change-contract';
import type { QueryExecutor } from '@/lib/db';
import type {
  PricingPolicyOverrideLoadResult,
  PricingRule,
} from '@/lib/pricing-rule-store';

import type {
  AdminCanonicalScenarioQuote,
  PricingChangePreviewRow,
  PricingScenarioSelector,
} from './canonical-scenarios';

export type PricingPolicyChangeProposal =
  | { operation: 'create'; rule: unknown }
  | { operation: 'update'; targetId: string; rule: unknown }
  | { operation: 'delete'; targetId: string }
  | { operation: 'rollback'; targetId: string; eventId: string };

export type PricingChangePreview = {
  previewFingerprint: string;
  domain: 'policy_rule';
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

export type PricingChangeConfirmation = {
  committed: true;
  preview: PricingChangePreview;
  persistedState: PricingChangeJsonValue | null;
  event: PricingChangeEvent;
  operationalWarnings: Array<{
    code: 'cache_invalidation_failed' | 'path_revalidation_failed';
    message: string;
  }>;
};

export type PricingPolicyInventoryRow = {
  selector: PricingScenarioSelector;
  versionedRule: PricingPolicyRule | null;
  databaseOverride: PricingPolicyRule | null;
  effectiveProvenance: AdminCanonicalScenarioQuote['policyProvenance'] | null;
  representativeQuotes: AdminCanonicalScenarioQuote[];
  routingContext: Pick<
    PricingRule,
    'vendorAccountId' | 'effectiveFrom' | 'updatedAt' | 'updatedBy'
  > | null;
  lastEvent: PricingChangeEvent | null;
};

export type PricingPolicyInventoryResponse = {
  versionedPolicyVersion: number;
  databaseStatus: PricingPolicyOverrideLoadResult['status'];
  warnings: string[];
  rows: PricingPolicyInventoryRow[];
};

export type PricingPolicyServiceDependencies = {
  loadOverrides(executor?: QueryExecutor): Promise<PricingPolicyOverrideLoadResult>;
  getEvent(
    id: string,
    domain: PricingChangeDomain,
    executor?: QueryExecutor
  ): Promise<PricingChangeEvent | null>;
  listLatestEventsByTargets(
    domain: PricingChangeDomain,
    targetIds: string[]
  ): Promise<PricingChangeEvent[]>;
  listEvents(input?: ListPricingChangeEventsInput): Promise<PricingChangeEvent[]>;
  withTransaction<TResult>(
    callback: (executor: QueryExecutor) => Promise<TResult>
  ): Promise<TResult>;
  upsertRule(
    executor: QueryExecutor,
    rule: PricingPolicyRule,
    actorId: string
  ): Promise<PricingRule>;
  deleteRule(executor: QueryExecutor, id: string): Promise<PricingRule>;
  insertEvent(
    executor: QueryExecutor,
    input: InsertPricingChangeEventInput
  ): Promise<PricingChangeEvent>;
  invalidateCache(): void;
  revalidate(preview: PricingChangePreview): void;
};

export type PreviewContext = {
  operation: PricingChangeOperation;
  targetId: string;
  currentRule: PricingPolicyRule | null;
  proposedRule: PricingPolicyRule | null;
  currentRules: PricingPolicyRule[];
  proposedRules: PricingPolicyRule[];
  currentRoutingRules: PricingRule[];
  rollbackEventId?: string;
};
