import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

export async function GET(req: Request) {
  try {
    // Optional: verify which account just completed onboarding.
    // If you pass state/accountId via the onboarding link (accountLinks doesn't support state),
    // you can alternatively verify later via dashboard or webhook (account.updated).
    // Here we list last created accounts and pick the most recent Express (quick & dirty admin flow).
    const list = await stripe.accounts.list({ limit: 1 });
    const acct = list.data[0];

    if (!acct) {
      return NextResponse.redirect(new URL("/?onboarding=missing", req.url));
    }

    // ✅ Persist the account ID (choose one place only):
    // 1) ENV (manual step afterwards on Vercel)
    // 2) DB table (recommended): settings(key,value) or vendors(id, stripe_account_id)

    // For now, render it plainly so the operator can copy it:
    const dest = new URL(`/?cogs_vault=${acct.id}`, req.url);
    return NextResponse.redirect(dest);
  } catch (e) {
    console.error("[connect.return]", e);
    return NextResponse.redirect(new URL("/?onboarding=error", req.url));
  }
}
