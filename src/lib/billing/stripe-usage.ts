import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

const SECONDS_ITEM = process.env.STRIPE_USAGE_ITEM_SECONDS;
const CLIPS_ITEM = process.env.STRIPE_USAGE_ITEM_CLIPS;

export type UsageMeter = "video_seconds_rendered" | "video_clips_rendered";

export interface ReportUsageParams {
  meter: UsageMeter;
  quantity: number;
  timestamp?: number;
}

export async function reportUsageToStripe(params: ReportUsageParams): Promise<void> {
  if (!stripe) {
    console.warn("[stripe] Usage event ignored – STRIPE_SECRET_KEY not configured.");
    return;
  }

  const subscriptionItemId = params.meter === "video_seconds_rendered" ? SECONDS_ITEM : CLIPS_ITEM;
  if (!subscriptionItemId) {
    console.warn(`[stripe] Usage event ignored – missing subscription item for meter ${params.meter}.`);
    return;
  }

  const roundedQuantity = Math.max(0, Math.round(params.quantity));
  if (roundedQuantity <= 0) {
    console.warn(`[stripe] Usage event skipped – non-positive quantity (${params.quantity}).`);
    return;
  }

  try {
    type CreateUsageRecordFn = (
      id: string,
      params: Record<string, unknown>
    ) => Promise<unknown>;

    const { createUsageRecord } = stripe.subscriptionItems as unknown as {
      createUsageRecord: CreateUsageRecordFn;
    };

    await createUsageRecord(subscriptionItemId, {
      quantity: roundedQuantity,
      timestamp: params.timestamp ?? Math.floor(Date.now() / 1000),
      action: "set",
    });
  } catch (error) {
    console.error("[stripe] Failed to report usage", error);
  }
}
