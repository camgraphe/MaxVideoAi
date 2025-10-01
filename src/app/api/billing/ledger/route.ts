import { NextResponse } from "next/server";
import { requireCurrentSession } from "@/lib/auth/current-user";
import { listCreditLedger } from "@/db/repositories/credits-repo";

export async function GET() {
  const session = await requireCurrentSession();
  const entries = await listCreditLedger(session.organization.id, 100);
  return NextResponse.json({ entries });
}
