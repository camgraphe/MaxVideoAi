import { NextResponse } from 'next/server';
import { adminErrorToResponse } from '@/server/admin';
import { MarketingMediaError } from './snapshot';

export function marketingJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
}
export function marketingApiError(error: unknown) {
  if (error instanceof MarketingMediaError) return marketingJson({ ok: false, error: error.message }, error.status);
  if (['55P03', '40P01'].includes(String((error as { code?: string })?.code)))
    return marketingJson({ ok: false, error: 'Another operation is in progress. Refresh and retry.' }, 409);
  return adminErrorToResponse(error);
}
