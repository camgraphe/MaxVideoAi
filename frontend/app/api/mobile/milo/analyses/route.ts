import type { NextRequest } from 'next/server';
import { handleMobileMiloAnalysis } from '@/server/mobile/milo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 400;

export function GET(request: NextRequest) {
  return handleMobileMiloAnalysis(request);
}

export function POST(request: NextRequest) {
  return handleMobileMiloAnalysis(request);
}
