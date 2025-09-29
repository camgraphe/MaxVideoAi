import { pricingConfig } from "@/config/pricing";
import type {
  EstimateCostInput,
  EstimateCostOutput,
  FalEngine,
  VeoAudioMode,
  VeoPricingTier,
} from "@/types/pricing";

const CENTS_IN_EURO = 100;

export function estimateCost(input: EstimateCostInput): EstimateCostOutput {
  const quantity = input.quantity ?? 1;
  const breakdown: EstimateCostOutput["breakdown"] = [];
  let subtotal = 0;

  if (input.provider === "veo") {
    const veoTier = input.engine as VeoPricingTier;
    const audioMode: VeoAudioMode = input.withAudio ? "audio" : "mute";
    const rate = pricingConfig.veo[veoTier]?.[audioMode];
    if (!rate) {
      throw new Error(`Missing Veo pricing for ${veoTier}/${audioMode}`);
    }
    const seconds = Math.max(0, input.durationSeconds);
    const veoCost = seconds * rate * quantity;
    breakdown.push({
      label: `Veo ${capitalize(veoTier)} ${audioMode === "audio" ? "+ audio" : "mute"}`,
      amountCents: eurosToCents(veoCost),
    });
  } else if (input.provider === "fal") {
    const falEngine = input.engine as FalEngine;

    if (falEngine === "veo3" || falEngine === "veo3-fast") {
      const tier: VeoPricingTier = falEngine === "veo3" ? "quality" : "fast";
      const audioMode: VeoAudioMode = input.withAudio ? "audio" : "mute";
      const rate = pricingConfig.veo[tier]?.[audioMode];
      if (!rate) {
        throw new Error(`Missing Veo pricing for ${falEngine}/${audioMode}`);
      }
      const seconds = Math.max(0, input.durationSeconds);
      const veoCost = seconds * rate * quantity;
      breakdown.push({
        label: `Veo ${capitalize(tier)} via FAL ${audioMode === "audio" ? "+ audio" : "mute"}`,
        amountCents: eurosToCents(veoCost),
      });
    } else {
      const enginePricing = pricingConfig.fal[falEngine];
      if (!enginePricing) {
        throw new Error(`Missing FAL pricing for ${falEngine}`);
      }
      const seconds = Math.max(0, input.durationSeconds);
      const falCost = seconds * enginePricing.per_second * quantity;
      breakdown.push({
        label: `FAL ${capitalize(falEngine)}`,
        amountCents: eurosToCents(falCost),
      });
    }
  } else {
    throw new Error(`Unknown provider ${input.provider}`);
  }

  subtotal = breakdown.reduce((acc, item) => acc + item.amountCents, 0);

  if (input.estimatedSizeGb) {
    const egress = input.estimatedSizeGb * pricingConfig.fees.egress_per_gb * quantity;
    breakdown.push({
      label: "Estimated egress",
      amountCents: eurosToCents(egress),
    });
    subtotal += eurosToCents(egress);
  }

  return {
    subtotalCents: Math.round(subtotal),
    breakdown,
  };
}

export function eurosToCents(value: number): number {
  return Math.round(value * CENTS_IN_EURO);
}

export function centsToEuros(value: number): number {
  return Math.round((value / CENTS_IN_EURO) * 100) / 100;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
