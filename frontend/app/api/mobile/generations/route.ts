import type { NextRequest } from 'next/server';
import { mobileResponse, mobileUser } from '@/server/mobile/http';
import { listMobileJobs } from '@/server/mobile/generations';

export const dynamic = 'force-dynamic';
export function GET(request: NextRequest) {
  return mobileResponse(async () =>
    listMobileJobs(await mobileUser(request), request.nextUrl.searchParams.get('cursor'), request.nextUrl.searchParams.get('surface')),
  );
}
