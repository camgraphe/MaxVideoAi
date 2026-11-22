import type { NextRequest } from 'next/server';
import { handleMobileMilo } from '@/server/mobile/milo';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 800;

export function GET(request: NextRequest) {
  return handleMobileMilo(request);
}
export function POST(request: NextRequest) {
  return handleMobileMilo(request);
}
