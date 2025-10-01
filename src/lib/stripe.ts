import Stripe from "stripe";
import { env } from "@/lib/env";

let stripe: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }

  if (!stripe) {
    stripe = new Stripe(env.STRIPE_SECRET_KEY);
  }

  return stripe;
}
