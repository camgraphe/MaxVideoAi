import { computePricingSnapshot as computeKernelSnapshot, type PricingEngineDefinition, type PricingSnapshot } from '@maxvideoai/pricing';
import { listFalEngines, type FalEngineEntry } from '@/config/falEngines';
import type { AudioPackId } from '@/lib/audio-generation';
import { quotePublicAudioPricingSnapshot } from '@/lib/pricing-public-quote';
import { isLumaAgentsImageEngineId } from '@/lib/luma-agents';
import { isLumaRay2EngineId } from '@/lib/luma-ray2';
import { buildPricingDefinition } from '@/lib/pricing-definition';
import type { PricingRule } from '@/lib/pricing-rule-store';
import {
  buildGptImage2Snapshot,
  buildLumaAgentsImageSnapshot,
  buildLumaRay32Snapshot,
  buildLumaRay2Snapshot,
  buildSeedance2Snapshot,
  getLumaRay2BasePriceEnv,
} from '@/lib/pricing-specialized-snapshots';
import { isSeedance2TokenPricing } from '@/lib/seedance-2-pricing';
import { buildBackgroundRemovalPricingPreview } from '@/lib/tools-background-removal';
import { buildUpscalePricingPreview } from '@/lib/tools-upscale';
import { isLumaRay32EngineId } from '@/lib/luma-agents';

import { resolveModelOfferAmountCents } from '../../../app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-schema';
import {
  getImagePresetQuote,
  getPresetQuote,
  type ImagePriceScenario,
  type VideoPriceScenario,
} from '../../../app/(localized)/[locale]/(marketing)/pricing/_lib/pricingHubData';
import { buildPricingAuditScenarios } from './scenarios';
import { buildCanonicalPricingFacts } from './canonical-facts';
import type { FrozenPricingOutput, PricingAuditScenario } from './types';

const CURRENT_DEFAULT_RULE: PricingRule = {
  id: 'default',
  marginPercent: 0.3,
  marginFlatCents: 0,
  surchargeAudioPercent: 0.2,
  surchargeUpscalePercent: 0.5,
  currency: 'USD',
};
const MEMBER_DISCOUNTS: PricingEngineDefinition['memberTierDiscounts'] = {
  member: 0,
  plus: 0.05,
  pro: 0.1,
};

function snapshotToFrozen(scenario: PricingAuditScenario, snapshot: PricingSnapshot): FrozenPricingOutput {
  const addonCents = snapshot.addons.reduce((sum, addon) => sum + addon.amountCents, 0);
  const vendorSubtotalCents = Math.max(0, Math.round(snapshot.base.amountCents + addonCents));
  const marginCents = Math.max(0, Math.round(snapshot.margin.amountCents));
  const customerTotalCents = Math.max(0, Math.round(snapshot.totalCents));
  const quantity = snapshot.base.unit === 'image' ? snapshot.base.seconds : snapshot.base.seconds;
  return {
    scenarioId: scenario.id,
    surface: scenario.surface,
    currency: snapshot.currency.toUpperCase(),
    vendorSubtotalCents,
    marginCents,
    surchargeCents: 0,
    customerTotalCents,
    unit: snapshot.base.unit ?? 'unit',
    quantity,
    equivalenceKey: scenario.equivalenceKey,
    compatibilityProfile: scenario.compatibilityProfile,
  };
}

function standardSnapshot(entry: FalEngineEntry, scenario: PricingAuditScenario): PricingSnapshot {
  const definition = buildPricingDefinition(entry.engine);
  if (!definition) throw new Error(`Missing pricing definition for ${entry.id}`);
  const augmented = {
    ...definition,
    platformFeePct: CURRENT_DEFAULT_RULE.marginPercent,
    platformFeeFlatCents: CURRENT_DEFAULT_RULE.marginFlatCents,
    memberTierDiscounts: MEMBER_DISCOUNTS,
  };
  return computeKernelSnapshot(augmented, {
    engineId: augmented.engineId,
    durationSec: scenario.durationSec ?? 1,
    resolution: scenario.resolution ?? 'default',
    memberTier: scenario.membershipTier ?? 'member',
  }).snapshot;
}

function legacyBillingSnapshot(entry: FalEngineEntry, scenario: PricingAuditScenario): PricingSnapshot {
  const engine = entry.engine;
  const memberTier = scenario.membershipTier ?? 'member';
  const durationSec = scenario.durationSec ?? 1;
  const resolution = scenario.resolution ?? 'default';
  const mode = scenario.mode ?? (entry.category === 'image' ? 't2i' : 't2v');
  const currency = (engine.pricingDetails?.currency ?? engine.pricing?.currency ?? 'USD').toUpperCase();

  try {
    if (isLumaAgentsImageEngineId(engine.id) && (mode === 't2i' || mode === 'i2i')) {
      return buildLumaAgentsImageSnapshot({
        engineId: engine.id,
        mode,
        referenceImageCount: 0,
        rule: CURRENT_DEFAULT_RULE,
        memberTier,
        memberTierDiscounts: MEMBER_DISCOUNTS,
        currency,
      });
    }
    if (isLumaRay32EngineId(engine.id) && (mode === 't2v' || mode === 'i2v')) {
      return buildLumaRay32Snapshot({
        duration: durationSec,
        resolution,
        rule: CURRENT_DEFAULT_RULE,
        memberTier,
        memberTierDiscounts: MEMBER_DISCOUNTS,
        currency,
      });
    }
    if (isLumaRay2EngineId(engine.id) && (mode === 't2v' || mode === 'i2v')) {
      const raw = getLumaRay2BasePriceEnv(engine.id);
      const baseUsd = Number(raw);
      if (Number.isFinite(baseUsd) && baseUsd > 0) {
        return buildLumaRay2Snapshot({
          engineId: engine.id === 'lumaRay2_flash' ? 'luma-ray2-flash' : 'luma-ray2',
          baseUsd,
          duration: durationSec,
          resolution,
          rule: CURRENT_DEFAULT_RULE,
          memberTier,
          memberTierDiscounts: MEMBER_DISCOUNTS,
          currency,
        });
      }
    }
    if (engine.id === 'gpt-image-2') {
      return buildGptImage2Snapshot({
        numImages: durationSec,
        imageSize: resolution,
        rule: CURRENT_DEFAULT_RULE,
        memberTier,
        memberTierDiscounts: MEMBER_DISCOUNTS,
        currency,
      });
    }
    if (isSeedance2TokenPricing(engine.pricingDetails)) {
      return buildSeedance2Snapshot({
        pricingDetails: engine.pricingDetails,
        durationSec,
        resolution,
        rule: CURRENT_DEFAULT_RULE,
        memberTier,
        memberTierDiscounts: MEMBER_DISCOUNTS,
        currency,
      });
    }
  } catch {
    return standardSnapshot(entry, scenario);
  }

  return standardSnapshot(entry, scenario);
}

function formatUsd(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function collectPublicQuote(entry: FalEngineEntry, scenario: PricingAuditScenario): FrozenPricingOutput {
  const isImage = scenario.mode === 't2i' || scenario.mode === 'i2i';
  const quote = isImage
    ? getImagePresetQuote(
        entry,
        {
          id: String(scenario.input.presetId ?? 'audit-image'),
          resolution: scenario.resolution ?? 'default',
          quantity: Number(scenario.input.quantity ?? 1),
        } as ImagePriceScenario,
        'en'
      )
    : getPresetQuote(
        entry,
        {
          id: String(scenario.input.presetId ?? '10s-1080p'),
          label: 'Audit',
          subLabel: 'Audit',
          resolution: (scenario.resolution ?? '1080p') as VideoPriceScenario['resolution'],
          durationSec: scenario.durationSec ?? 10,
          audio: scenario.input.audio === true,
        },
        'en'
      );
  const total = Math.max(0, Math.round(quote.amountCents ?? 0));
  const facts = buildCanonicalPricingFacts(scenario);
  const vendorSubtotalCents = facts
    ? Math.max(
        0,
        scenario.compatibilityProfile === 'provider-reference-current'
          ? Math.ceil(facts.vendorSubtotalExactCents - 1e-9)
          : Math.round(facts.vendorSubtotalExactCents)
      )
    : 0;
  return {
    scenarioId: scenario.id,
    surface: scenario.surface,
    currency: 'USD',
    vendorSubtotalCents,
    marginCents: Math.max(0, total - vendorSubtotalCents),
    surchargeCents: 0,
    customerTotalCents: total,
    unit: facts?.unit ?? (isImage ? 'image' : 'scenario'),
    quantity: facts?.quantity ?? (isImage ? Number(scenario.input.quantity ?? 1) : scenario.durationSec ?? 0),
    displayedAmount: quote.display,
    equivalenceKey: scenario.equivalenceKey,
    compatibilityProfile: scenario.compatibilityProfile,
  };
}

function collectTool(scenario: PricingAuditScenario): FrozenPricingOutput {
  const unitPriceCents = Number(scenario.input.unitPriceCents ?? 0);
  let totalCents = unitPriceCents;
  if (scenario.engineId === 'background-removal') {
    totalCents =
      buildBackgroundRemovalPricingPreview({
        unitPriceCents,
        currency: 'USD',
        durationSec: Number(scenario.input.durationSec ?? 10),
        outputCodec: String(scenario.input.outputCodec ?? 'webm_vp9'),
      }).totalCents ?? unitPriceCents;
  } else if (scenario.engineId === 'upscale') {
    totalCents =
      buildUpscalePricingPreview({
        mediaType: 'image',
        engineId: 'seedvr-image',
        unitPriceCents,
        currency: 'USD',
        imageWidth: Number(scenario.input.width ?? 1024),
        imageHeight: Number(scenario.input.height ?? 1024),
        upscaleFactor: Number(scenario.input.factor ?? 2),
      }).totalCents ?? unitPriceCents;
  }
  return {
    scenarioId: scenario.id,
    surface: scenario.surface,
    currency: 'USD',
    vendorSubtotalCents: totalCents,
    marginCents: 0,
    surchargeCents: 0,
    customerTotalCents: totalCents,
    unit: 'run',
    quantity: 1,
  };
}

export function findUnprofiledCrossSurfaceDifferences(rows: FrozenPricingOutput[]): string[] {
  const groups = new Map<string, FrozenPricingOutput[]>();
  for (const row of rows) {
    if (!row.equivalenceKey) continue;
    const group = groups.get(row.equivalenceKey) ?? [];
    group.push(row);
    groups.set(row.equivalenceKey, group);
  }
  const missing: string[] = [];
  for (const [key, group] of groups) {
    if (new Set(group.map((row) => row.customerTotalCents)).size <= 1) continue;
    for (const row of group) {
      if (!row.compatibilityProfile) missing.push(`${key}:${row.scenarioId}`);
    }
  }
  return missing.sort();
}

export async function collectLegacyPricingOutputs(): Promise<FrozenPricingOutput[]> {
  const entries = new Map(listFalEngines().map((entry) => [entry.id, entry]));
  const rows = buildPricingAuditScenarios().map((scenario): FrozenPricingOutput => {
    if (scenario.surface === 'audio') {
      return snapshotToFrozen(
        scenario,
        quotePublicAudioPricingSnapshot({
          pack: String(scenario.input.pack) as AudioPackId,
          durationSec: scenario.durationSec ?? 3,
          script: scenario.mode === 'voice_only' || scenario.mode === 'cinematic_voice' ? 'Audit voice script' : undefined,
        })
      );
    }
    if (scenario.surface === 'tool') return collectTool(scenario);
    const entry = entries.get(scenario.engineId);
    if (!entry) throw new Error(`Missing pricing audit engine: ${scenario.engineId}`);
    if (scenario.surface === 'pricing-hub' || scenario.surface === 'model-page') {
      return collectPublicQuote(entry, scenario);
    }
    if (scenario.surface === 'json-ld') {
      const total = Math.max(0, resolveModelOfferAmountCents(entry, entry.engine) ?? 0);
      const facts = buildCanonicalPricingFacts(scenario);
      const vendorSubtotalCents = facts ? Math.max(0, Math.round(facts.vendorSubtotalExactCents)) : total;
      return {
        scenarioId: scenario.id,
        surface: scenario.surface,
        currency: entry.pricingHint?.currency ?? entry.engine.pricingDetails?.currency ?? 'USD',
        vendorSubtotalCents,
        marginCents: Math.max(0, total - vendorSubtotalCents),
        surchargeCents: 0,
        customerTotalCents: total,
        unit: 'offer',
        quantity: 1,
        structuredDataAmount: (total / 100).toFixed(2),
      };
    }
    const frozen = snapshotToFrozen(scenario, legacyBillingSnapshot(entry, scenario));
    if (scenario.surface === 'estimator' || scenario.surface === 'price-chip') {
      frozen.displayedAmount = formatUsd(frozen.customerTotalCents);
    }
    return frozen;
  });
  const sorted = rows.sort((left, right) => left.scenarioId.localeCompare(right.scenarioId));
  return JSON.parse(JSON.stringify(sorted)) as FrozenPricingOutput[];
}
