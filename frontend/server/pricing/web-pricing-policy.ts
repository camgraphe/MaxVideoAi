import { NextResponse } from 'next/server';
import { LIVE_PRICING_POLICY_REVISION, PRICING_POLICY_HEADER, MEMBERSHIP_PRICING_REFRESH_MESSAGE } from '@/lib/membership-policy';

/** First-party web charge boundary; bound agent quotes and paid continuations do not enter here. */
export function requireCurrentWebPricingPolicy(
  request: { headers: { get(name: string): string | null } },
  shape: 'video' | 'image' | 'tool' = 'tool',
): NextResponse | null {
  if (request.headers.get(PRICING_POLICY_HEADER) === LIVE_PRICING_POLICY_REVISION) return null;
  const code = 'PRICING_REFRESH_REQUIRED';
  const message = MEMBERSHIP_PRICING_REFRESH_MESSAGE;
  return NextResponse.json(shape === 'video'
    ? { ok: false, error: code, message }
    : { ok: false, ...(shape === 'image' ? { mode: 't2i', images: [] } : {}), error: { code, message } },
  { status: 409 });
}
