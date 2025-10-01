import { NextRequest, NextResponse } from "next/server";
import { requireCurrentSession } from "@/lib/auth/current-user";
import { getStripeClient } from "@/lib/stripe";
import { env } from "@/lib/env";
import { setOrganizationStripeCustomer } from "@/db/repositories/users-orgs-repo";

export async function POST(request: NextRequest) {
  if (!env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Stripe is not configured." }, { status: 503 });
  }

  try {
    const session = await requireCurrentSession();
    const stripe = getStripeClient();
    let customerId = session.organization.stripeCustomerId ?? undefined;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: session.organization.billingEmail ?? session.user.email,
        name: session.organization.name,
        metadata: {
          organization_id: session.organization.id,
        },
      });
      customerId = customer.id;
      await setOrganizationStripeCustomer(session.organization.id, customerId);
    }

    const origin = request.headers.get("origin") ?? env.APP_URL ?? env.NEXT_PUBLIC_APP_URL ?? "";

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: origin ? `${origin}/billing` : undefined,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (error) {
    console.error("Portal session error", error);
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
