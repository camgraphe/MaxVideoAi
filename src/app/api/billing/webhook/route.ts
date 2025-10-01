import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripeClient } from "@/lib/stripe";
import { env } from "@/lib/env";
import { getCreditPackageByPriceId } from "@/config/credits";
import {
  grantOrganizationCredits,
  hasLedgerEntryWithStripeReference,
} from "@/db/repositories/credits-repo";
import { setOrganizationStripeCustomer } from "@/db/repositories/users-orgs-repo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Stripe webhook is not configured." }, { status: 503 });
  }

  const stripe = getStripeClient();
  let event: Stripe.Event;

  try {
    const rawBody = Buffer.from(await request.arrayBuffer());
    const signature = request.headers.get("stripe-signature");
    if (!signature) {
      return NextResponse.json({ error: "Missing stripe signature." }, { status: 400 });
    }
    event = stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    console.error("Webhook signature verification failed", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session, stripe);
        break;
      }
      case "invoice.payment_succeeded": {
        await handleInvoicePayment(event.data.object as Stripe.Invoice);
        break;
      }
      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook handler error", error);
    return NextResponse.json({ error: "Webhook processing error" }, { status: 500 });
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session, stripe: Stripe) {
  if (session.payment_status !== "paid") {
    return;
  }
  const organizationId = session.metadata?.organizationId;
  if (!organizationId) {
    return;
  }

  if (session.customer && typeof session.customer === "string") {
    await setOrganizationStripeCustomer(organizationId, session.customer);
  }

  const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 50 });
  const fulfilled = await processLineItems(lineItems.data, organizationId, session.id);

  if (!fulfilled && session.total_details?.amount_discount) {
    // Discounts only, nothing to credit
    return;
  }
}

async function handleInvoicePayment(invoice: Stripe.Invoice) {
  if (invoice.billing_reason !== "subscription_cycle" && invoice.billing_reason !== "manual") {
    return;
  }

  const organizationId = invoice.metadata?.organizationId;
  if (!organizationId) {
    return;
  }

  if (invoice.customer && typeof invoice.customer === "string") {
    await setOrganizationStripeCustomer(organizationId, invoice.customer);
  }

  if (!invoice.lines || invoice.lines.data.length === 0) {
    return;
  }

  const reference = (invoice.id ?? String(Date.now()));
  await processLineItems(invoice.lines.data, organizationId, reference);
}

async function processLineItems(
  items: Array<Stripe.LineItem | Stripe.InvoiceLineItem>,
  organizationId: string,
  reference: string,
): Promise<boolean> {
  let credited = false;

  for (const item of items) {
    // Stripe types differ between LineItem and InvoiceLineItem; access defensively
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const priceId = (item as any)?.price?.id as string | undefined;
    if (!priceId) {
      continue;
    }

    const creditPackage = getCreditPackageByPriceId(priceId);
    if (!creditPackage) {
      continue;
    }

    const alreadyProcessed = await hasLedgerEntryWithStripeReference(organizationId, reference, priceId);
    if (alreadyProcessed) {
      credited = true;
      continue;
    }

    await grantOrganizationCredits({
      organizationId,
      amount: creditPackage.credits,
      reason: "credit_purchase",
      metadata: {
        stripe_session_id: reference,
        price_id: priceId,
        package_id: creditPackage.id,
      },
    });
    credited = true;
  }

  return credited;
}
