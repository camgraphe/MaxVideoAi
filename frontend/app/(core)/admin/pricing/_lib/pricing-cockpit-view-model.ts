import type {
  PricingChangeEvent,
  PricingChangePreview,
  PricingChangePreviewProvenance,
} from '@/lib/admin/pricing-change-contract';

export type PricingPolicySelector = {
  engineId?: string;
  mode?: string;
  resolution?: string;
};

export type PricingPolicyRuleView = PricingPolicySelector & {
  id: string;
  marginPercent: number;
  marginFlatCents: number;
  surchargeAudioPercent: number;
  surchargeUpscalePercent: number;
  currency: string;
  compatibilityProfile?: string;
};

export type PricingPolicyRepresentativeQuote = {
  scenarioId: string;
  engineId: string;
  surface: string;
  totalCents: number;
  policyProvenance: PricingChangePreviewProvenance;
};

export type PricingPolicyInventoryRow = {
  selector: PricingPolicySelector;
  versionedRule: PricingPolicyRuleView | null;
  databaseOverride: PricingPolicyRuleView | null;
  effectiveProvenance: PricingChangePreviewProvenance | null;
  representativeQuotes: PricingPolicyRepresentativeQuote[];
  routingContext: {
    vendorAccountId?: string;
    effectiveFrom?: string;
    updatedAt?: string;
    updatedBy?: string;
  } | null;
  lastEvent: PricingChangeEvent | null;
};

export type PricingPolicyInventory = {
  versionedPolicyVersion: number;
  databaseStatus: 'loaded' | 'unavailable';
  warnings: string[];
  rows: PricingPolicyInventoryRow[];
};

export type PricingPolicyDraft = {
  id: string;
  engineId: string;
  mode: string;
  resolution: string;
  marginPercent: string;
  marginFlatCents: string;
  surchargeAudioPercent: string;
  surchargeUpscalePercent: string;
  currency: string;
  compatibilityProfile: string;
};

export type PricingPolicyProposal =
  | { operation: 'create'; rule: PricingPolicyRuleView }
  | { operation: 'update'; targetId: string; rule: PricingPolicyRuleView }
  | { operation: 'delete'; targetId: string }
  | { operation: 'rollback'; targetId: string; eventId: string };

export type PricingCockpitFilters = {
  query: string;
  source: 'all' | 'database' | 'versioned';
};

export type PricingCockpitError = {
  code: string;
  message: string;
};

export type PricingInventoryApiResponse =
  | { ok: true; inventory: PricingPolicyInventory }
  | { ok: false; error: string; message?: string };

export type PricingHistoryApiResponse =
  | { ok: true; events: PricingChangeEvent[] }
  | { ok: false; error: string; message?: string };

export type PricingPreviewApiResponse =
  | { ok: true; preview: PricingChangePreview }
  | { ok: false; error: string; message?: string };

export type PricingConfirmApiResponse =
  | {
      ok: true;
      confirmation: {
        committed: true;
        preview: PricingChangePreview;
        operationalWarnings: Array<{ code: string; message: string }>;
      };
    }
  | { ok: false; error: string; message?: string };

function selectorPart(value: string | undefined) {
  return value?.trim() || '*';
}

export function pricingPolicyRowKey(row: PricingPolicyInventoryRow): string {
  return pricingPolicySelectorKey(row.selector);
}

export function pricingPolicySelectorKey(selector: PricingPolicySelector): string {
  return [selector.engineId, selector.mode, selector.resolution].map(selectorPart).join('|');
}

export function reconcilePricingPolicySelection(
  visibleRows: PricingPolicyInventoryRow[],
  selectedKey: string | null
): string | null {
  if (!visibleRows.length) return null;
  if (selectedKey && visibleRows.some((row) => pricingPolicyRowKey(row) === selectedKey)) return selectedKey;
  return pricingPolicyRowKey(visibleRows[0]!);
}

export function pricingPolicyProposalSelectorKey(proposal: PricingPolicyProposal): string | null {
  return proposal.operation === 'create' || proposal.operation === 'update'
    ? pricingPolicySelectorKey(proposal.rule)
    : null;
}

export function formatPricingSelector(selector: PricingPolicySelector): string {
  return [selector.engineId ?? 'All engines', selector.mode ?? 'All modes', selector.resolution ?? 'All resolutions'].join(' · ');
}

export function formatUsdCents(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

export function formatPercentRatio(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 2 }).format(value);
}

function ratioToPercentInput(value: number): string {
  return String(value * 100);
}

function makeGeneratedRuleId(selector: PricingPolicySelector): string {
  const suffix = [selector.engineId ?? 'global', selector.mode, selector.resolution]
    .filter(Boolean)
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-');
  return `admin-${suffix}`;
}

function selectorsMatch(left: PricingPolicySelector, right: PricingPolicySelector) {
  return left.engineId === right.engineId && left.mode === right.mode && left.resolution === right.resolution;
}

export function createPricingPolicyDraft(row: PricingPolicyInventoryRow): PricingPolicyDraft {
  const base = row.databaseOverride ?? row.versionedRule;
  if (!base) {
    throw new Error('Pricing inventory row has no policy rule');
  }
  const draftSelector = row.databaseOverride ?? row.selector;
  const id = row.databaseOverride?.id ?? (selectorsMatch(base, row.selector) ? base.id : makeGeneratedRuleId(row.selector));
  return {
    id,
    engineId: draftSelector.engineId ?? '',
    mode: draftSelector.mode ?? '',
    resolution: draftSelector.resolution ?? '',
    marginPercent: ratioToPercentInput(base.marginPercent),
    marginFlatCents: String(base.marginFlatCents),
    surchargeAudioPercent: ratioToPercentInput(base.surchargeAudioPercent),
    surchargeUpscalePercent: ratioToPercentInput(base.surchargeUpscalePercent),
    currency: base.currency,
    compatibilityProfile: base.compatibilityProfile ?? 'standard',
  };
}

function optionalText(value: string): string | undefined {
  const normalized = value.trim();
  return normalized || undefined;
}

function requiredNumber(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label} must be a non-negative number.`);
  }
  return parsed;
}

function percentInputToRatio(value: string, label: string): number {
  return requiredNumber(value, label) / 100;
}

export function buildPricingPolicyProposal(
  row: PricingPolicyInventoryRow,
  draft: PricingPolicyDraft
): PricingPolicyProposal {
  const rule: PricingPolicyRuleView = {
    id: draft.id.trim(),
    ...(optionalText(draft.engineId) ? { engineId: optionalText(draft.engineId) } : {}),
    ...(optionalText(draft.mode) ? { mode: optionalText(draft.mode) } : {}),
    ...(optionalText(draft.resolution) ? { resolution: optionalText(draft.resolution) } : {}),
    marginPercent: percentInputToRatio(draft.marginPercent, 'Margin'),
    marginFlatCents: requiredNumber(draft.marginFlatCents, 'Flat margin'),
    surchargeAudioPercent: percentInputToRatio(draft.surchargeAudioPercent, 'Audio surcharge'),
    surchargeUpscalePercent: percentInputToRatio(draft.surchargeUpscalePercent, 'Upscale surcharge'),
    currency: draft.currency.trim().toUpperCase(),
    ...(optionalText(draft.compatibilityProfile)
      ? { compatibilityProfile: optionalText(draft.compatibilityProfile) }
      : {}),
  };
  if (!rule.id) throw new Error('Rule ID is required.');
  return row.databaseOverride
    ? { operation: 'update', targetId: row.databaseOverride.id, rule }
    : { operation: 'create', rule };
}

export function filterPricingPolicyRows(
  rows: PricingPolicyInventoryRow[],
  filters: PricingCockpitFilters
): PricingPolicyInventoryRow[] {
  const query = filters.query.trim().toLowerCase();
  return rows.filter((row) => {
    const sourceMatches =
      filters.source === 'all' ||
      (filters.source === 'database' ? Boolean(row.databaseOverride) : !row.databaseOverride);
    if (!sourceMatches) return false;
    if (!query) return true;
    return [
      row.databaseOverride?.id,
      row.versionedRule?.id,
      row.selector.engineId,
      row.selector.mode,
      row.selector.resolution,
    ].some((value) => value?.toLowerCase().includes(query));
  });
}
