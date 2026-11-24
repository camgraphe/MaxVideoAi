import type { NextRequest } from 'next/server';
import { readLatestMobileResult } from '@/server/mobile/generations';
import { mobileResponse, mobileUser } from '@/server/mobile/http';

export const dynamic = 'force-dynamic';

export function GET(request: NextRequest) {
  return mobileResponse(async () => ({
    job: await readLatestMobileResult(await mobileUser(request), request.nextUrl.searchParams.get('surface')),
  }));
}
