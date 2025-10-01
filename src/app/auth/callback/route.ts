import { NextResponse } from "next/server";
import { getSupabaseRouteClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = getSupabaseRouteClient();
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const nextPath = requestUrl.searchParams.get("next") ?? "/dashboard";

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const errorUrl = new URL("/login", requestUrl.origin);
      errorUrl.searchParams.set("error", error.message);
      return NextResponse.redirect(errorUrl);
    }
  }

  const redirectUrl = new URL(nextPath, requestUrl.origin);
  return NextResponse.redirect(redirectUrl);
}
