import type { NextRequest } from 'next/server';
import { handleMobileStudio } from '@/server/mobile/studio';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export function GET(request: NextRequest) {
  return handleMobileStudio(request);
}
export const POST = GET;
