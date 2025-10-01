import { NextResponse } from "next/server";
import { getFalRates, getCachedFalRates } from "@/lib/pricing/dynamic-fal";

export async function GET() {
  try {
    const rates = await getFalRates();
    return NextResponse.json({ rates });
  } catch (error) {
    console.error("Failed to load dynamic FAL pricing", error);
    const fallback = getCachedFalRates();
    return NextResponse.json({ rates: fallback }, { status: 200 });
  }
}
