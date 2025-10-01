import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireCurrentSession } from "@/lib/auth/current-user";
import { updateOrganizationAutoTopUp } from "@/db/repositories/users-orgs-repo";
import { getCreditPackageById } from "@/config/credits";

const schema = z.object({
  enabled: z.boolean(),
  threshold: z.number().int().min(1).max(999).optional(),
  packageId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const session = await requireCurrentSession();
  const body = await request.json();
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    const firstIssue = (parsed.error as z.ZodError).issues?.[0]?.message;
    return NextResponse.json({ error: firstIssue ?? parsed.error.message ?? "Invalid payload" }, { status: 400 });
  }

  const { enabled, threshold, packageId } = parsed.data;

  if (packageId && !getCreditPackageById(packageId)) {
    return NextResponse.json({ error: "Unknown credit package" }, { status: 400 });
  }

  await updateOrganizationAutoTopUp(session.organization.id, {
    enabled,
    threshold,
    packageId,
  });

  return NextResponse.json({ success: true });
}
