import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const fromQuery = url.searchParams.get("account");
    let acctId = fromQuery ?? undefined;

    if (acctId) {
      try {
        const acct = await stripe.accounts.retrieve(acctId);
        if (acct) {
          const dest = new URL(req.url);
          dest.pathname = "/";
          dest.searchParams.set("cogs_vault", acct.id);
          return NextResponse.redirect(dest);
        }
      } catch (error) {
        console.warn("[connect.return] failed to retrieve account from query", error);
        acctId = undefined;
      }
    }

    // Fallback: list latest Express account (e.g., if query param missing or retrieval failed).
    const list = await stripe.accounts.list({ limit: 1, type: "express" });
    const acct = list.data[0];

    if (!acct) {
      return NextResponse.redirect(new URL("/?onboarding=missing", req.url));
    }

    // ✅ Persist the account ID (choose one place only):
    // 1) ENV (manual step afterwards on Vercel)
    // 2) DB table (recommended): settings(key,value) or vendors(id, stripe_account_id)

    // For now, render it plainly so the operator can copy it:
    const dest = new URL(req.url);
    dest.pathname = "/";
    dest.searchParams.set("cogs_vault", acct.id);
    return NextResponse.redirect(dest);
  } catch (e) {
    console.error("[connect.return]", e);
    return NextResponse.redirect(new URL("/?onboarding=error", req.url));
  }
}
