import { NextResponse } from "next/server";
import { getSupabaseRouteClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = getSupabaseRouteClient();
  const { event, session } = await request.json();

  console.log("[auth/set] event", event, session?.user?.email ?? null);

  if (event === "SIGNED_OUT") {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error("[auth/set] signOut failed", error);
      return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }

  if (session?.access_token && session?.refresh_token) {
    try {
      await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
    } catch (error) {
      console.error("[auth/set] setSession failed", error);
      return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
