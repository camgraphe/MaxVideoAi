import { getAdminEngineEntries } from '@/server/engine-overrides';
import type { EngineCaps, EngineInputField, EnginePricingDetails } from '@/types/engines';
import type { PricingSnapshot } from '@maxvideoai/pricing';
import {
  computePricingSnapshot,
  listPricingRules,
  PricingRule,
  PricingContext,
} from '@/lib/pricing';
import {
  getFalCatalog,
  invalidateFalCatalogCache,
  resolveFalModelId,
} from '@/lib/fal-catalog';

type EngineAddons = EnginePricingDetails['addons'];

type ResolutionRule = {
  resolution: string;
  rule: PricingRule;
};

export type AdminPricingEngineSummary = {
  id: string;
  label: string;
  provider: string;
  availability: EngineCaps['availability'];
  latencyTier: EngineCaps['latencyTier'];
  disabled: boolean;
  vendor: {
    currency: string;
    basePerSecondCents?: number;
    perResolution?: Record<string, number>;
    addons?: EngineAddons;
    notes?: string | null;
    sourceSlug?: string;
    sourceProvider?: string;
  };
  rule?: PricingRule;
  resolutionRules: ResolutionRule[];
  sampleQuote?: {
    resolution: string;
    durationSec: number;
    totalCents: number;
    vendorShareCents: number;
    platformFeeCents: number;
    effectivePerSecond: number;
    snapshot: PricingSnapshot;
  } | null;
};

export type AdminPricingOverview = {
  ok: true;
  defaultRule: PricingRule | null;
  engines: AdminPricingEngineSummary[];
  metadata: {
    catalogFetchedAt?: number;
    engineCount: number;
  };
};

function resolveSampleDuration(engine: EngineCaps): number {
  const durationField = findDurationField(engine);
  const candidates: Array<number | undefined> = [
    typeof durationField?.default === 'number' ? durationField.default : undefined,
    typeof durationField?.min === 'number' ? durationField.min : undefined,
    engine.maxDurationSec,
    8,
  ];
  const duration = candidates.find((value) => typeof value === 'number' && Number.isFinite(value) && value > 0);
  return Math.max(1, Math.min(60, Math.round(duration ?? 8)));
}

function findDurationField(engine: EngineCaps): EngineInputField | undefined {
  const optionalFields = engine.inputSchema?.optional ?? [];
  return optionalFields.find((field) => field.id === 'duration_seconds');
}

function resolveVendorPricing(engine: EngineCaps, catalogPricing?: EnginePricingDetails): {
  currency: string;
  basePerSecondCents?: number;
  perResolution?: Record<string, number>;
  addons?: EngineAddons;
  notes?: string | null;
} {
  const pricingDetails = engine.pricingDetails ?? catalogPricing;
  const currency =
    pricingDetails?.currency ??
    engine.pricing?.currency ??
    'USD';

  const perSecond = pricingDetails?.perSecondCents;
  let basePerSecondCents: number | undefined = typeof perSecond?.default === 'number' ? perSecond.default : undefined;
  const perResolution = perSecond?.byResolution;

  if (basePerSecondCents == null && perResolution) {
    const first = Object.values(perResolution)[0];
    if (typeof first === 'number') {
      basePerSecondCents = first;
    }
  }

  if (basePerSecondCents == null && engine.pricing?.base != null) {
    basePerSecondCents = Math.round(engine.pricing.base * 100);
  }

  if (basePerSecondCents == null && engine.pricing?.byResolution) {
    const first = Object.values(engine.pricing.byResolution)[0];
    if (typeof first === 'number') {
      basePerSecondCents = Math.round(first * 100);
    }
  }

  return {
    currency,
    basePerSecondCents,
    perResolution,
    addons: pricingDetails?.addons,
    notes: engine.pricing?.notes ?? null,
  };
}

async function buildSampleQuote(
  engine: EngineCaps,
  context: Partial<PricingContext>
): Promise<AdminPricingEngineSummary['sampleQuote']> {
  try {
    const snapshot = await computePricingSnapshot({
      engine,
      durationSec: context.durationSec ?? resolveSampleDuration(engine),
      resolution: context.resolution ?? engine.resolutions[0] ?? '1080p',
      addons: context.addons,
      membershipTier: context.membershipTier ?? 'member',
      currency: context.currency,
    });
    const duration = context.durationSec ?? resolveSampleDuration(engine);
    const effectivePerSecond = duration > 0 ? Math.round(snapshot.totalCents / duration) : snapshot.totalCents;
    return {
      resolution: context.resolution ?? engine.resolutions[0] ?? '1080p',
      durationSec: duration,
      totalCents: snapshot.totalCents,
      vendorShareCents: snapshot.vendorShareCents ?? 0,
      platformFeeCents: snapshot.platformFeeCents ?? 0,
      effectivePerSecond,
      snapshot,
    };
  } catch {
    return null;
  }
}

export async function fetchAdminPricingOverview(options?: {
  refreshCatalog?: boolean;
}): Promise<AdminPricingOverview> {
  if (options?.refreshCatalog) {
    invalidateFalCatalogCache();
  }

  const [rules, adminEntries, catalog] = await Promise.all([
    listPricingRules(),
    getAdminEngineEntries(),
    getFalCatalog(),
  ]);

  const defaultRule = rules.find((rule) => !rule.engineId && !rule.resolution) ?? null;
  const engineRules = new Map<
    string,
    {
      defaultRule?: PricingRule;
      byResolution: Map<string, PricingRule>;
    }
  >();

  for (const rule of rules) {
    if (!rule.engineId) continue;
    const entry = engineRules.get(rule.engineId) ?? { defaultRule: undefined, byResolution: new Map() };
    if (rule.resolution) {
      entry.byResolution.set(rule.resolution, rule);
    } else {
      entry.defaultRule = rule;
    }
    engineRules.set(rule.engineId, entry);
  }

  const summaries: AdminPricingEngineSummary[] = [];

  for (const entry of adminEntries) {
    const { engine, disabled } = entry;
    const ruleGroup = engineRules.get(engine.id);
    const vendorPricing = resolveVendorPricing(engine, catalog?.pricing?.[engine.id]);
    const sourceSlug =
      catalog?.modelMap?.[engine.id] ??
      engine.providerMeta?.modelSlug ??
      (await resolveFalModelId(engine.id).catch(() => undefined));

    const resolutionRules: ResolutionRule[] = [];
    if (ruleGroup?.byResolution.size) {
      for (const [resolution, rule] of Array.from(ruleGroup.byResolution.entries()).sort((a, b) =>
        a[0].localeCompare(b[0])
      )) {
        resolutionRules.push({ resolution, rule });
      }
    }

    const sampleResolution = engine.resolutions[0] ?? '1080p';
    const sampleDuration = resolveSampleDuration(engine);
    const sampleQuote = await buildSampleQuote(engine, {
      resolution: sampleResolution,
      durationSec: sampleDuration,
      currency: vendorPricing.currency,
    });

    summaries.push({
      id: engine.id,
      label: engine.label,
      provider: engine.provider,
      availability: engine.availability,
      latencyTier: engine.latencyTier,
      disabled,
      vendor: {
        currency: vendorPricing.currency,
        basePerSecondCents: vendorPricing.basePerSecondCents,
        perResolution: vendorPricing.perResolution,
        addons: vendorPricing.addons,
        notes: vendorPricing.notes,
        sourceSlug: sourceSlug ?? undefined,
        sourceProvider: engine.providerMeta?.provider ?? engine.provider,
      },
      rule: ruleGroup?.defaultRule,
      resolutionRules,
      sampleQuote,
    });
  }

  return {
    ok: true,
    defaultRule,
    engines: summaries,
    metadata: {
      catalogFetchedAt: catalog?.fetchedAt,
      engineCount: summaries.length,
    },
  };
}
