import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

export async function POST() {
  try {
    // 1) Create Express connected account (France)
    const account = await stripe.accounts.create({
      type: "express",
      country: "FR",
      capabilities: {
        transfers: { requested: true },
        card_payments: { requested: true },
      },
      // (optional) prefill:
      // email: "billing@maxvideoai.com",
      business_type: "individual",
    });

    // 2) Create hosted onboarding link
    const returnUrl = new URL(process.env.CONNECT_RETURN_URL!);
    returnUrl.searchParams.set("account", account.id);

    const link = await stripe.accountLinks.create({
      account: account.id,
      type: "account_onboarding",
      refresh_url: process.env.CONNECT_REFRESH_URL!,
      return_url: returnUrl.toString(),
    });

    // TEMP: return link to open in browser
    return NextResponse.json({ accountId: account.id, url: link.url });
  } catch (err) {
    console.error("[connect.create]", err);
    const message = err instanceof Error ? err.message : "Stripe connect error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
