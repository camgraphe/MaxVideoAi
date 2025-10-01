export type VeoPricingTier = "quality" | "fast";
export type VeoAudioMode = "audio" | "mute";
export type FalEngine =
  | "veo3"
  | "veo3-fast"
  | "kling-pro"
  | "pika-v2-2"
  | "luma-dream"
  | "pixverse-v4-5"
  | "cogvideox-5b";

export interface PricingConfig {
  veo: Record<VeoPricingTier, Record<VeoAudioMode, number>>;
  fal: Record<FalEngine, { per_second: number }>;
  fees: {
    egress_per_gb: number;
  };
}

export interface EstimateCostInput {
  provider: "veo" | "fal" | "kiwi";
  engine: string;
  durationSeconds: number;
  quantity?: number;
  withAudio?: boolean;
  estimatedSizeGb?: number;
}

export interface EstimateCostOutput {
  subtotalCents: number;
  breakdown: Array<{
    label: string;
    amountCents: number;
  }>;
}
