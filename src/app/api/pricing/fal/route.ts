import { NextResponse } from "next/server";
import { getBaseRateForEngine, listEngines } from "@/lib/pricing";

export async function GET() {
  const families = listEngines("fal");
  const rates = Object.fromEntries(
    families.map((family) => {
      const firstVersion = family.versions[0];
      const baseRate = firstVersion ? getBaseRateForEngine(firstVersion.id) : null;
      return [family.id, baseRate];
    }),
  );

  return NextResponse.json({ rates });
}
