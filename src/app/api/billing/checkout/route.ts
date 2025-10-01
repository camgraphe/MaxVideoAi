import { NextRequest, NextResponse } from "next/server";
import { getStripeClient } from "@/lib/stripe";
import { requireCurrentSession } from "@/lib/auth/current-user";
import { getCreditPackageById } from "@/config/credits";
import { env } from "@/lib/env";
import { setOrganizationStripeCustomer } from "@/db/repositories/users-orgs-repo";

export async function POST(request: NextRequest) {
  if (!env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Stripe is not configured." }, { status: 503 });
  }

  try {
    const session = await requireCurrentSession();
    const { packageId } = await request.json();

    if (typeof packageId !== "string") {
      return NextResponse.json({ error: "Missing package id." }, { status: 400 });
    }

    const creditPackage = getCreditPackageById(packageId);
    if (!creditPackage) {
      return NextResponse.json({ error: "Unknown credit package." }, { status: 400 });
    }

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

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: customerId,
      line_items: [
        {
          price: creditPackage.priceId,
          quantity: 1,
        },
      ],
      success_url: origin ? `${origin}/billing?status=success` : undefined,
      cancel_url: origin ? `${origin}/billing?status=cancelled` : undefined,
      metadata: {
        organizationId: session.organization.id,
        packageId: creditPackage.id,
      },
      client_reference_id: session.organization.id,
      automatic_tax: { enabled: true },
      allow_promotion_codes: true,
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error("Create checkout session failed", error);
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
