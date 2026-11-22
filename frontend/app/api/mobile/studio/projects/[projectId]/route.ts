import type { NextRequest } from 'next/server';
import { handleMobileStudio } from '@/server/mobile/studio';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 800;
export async function GET(request: NextRequest, context: { params: Promise<{ projectId: string }> }) {
  return handleMobileStudio(request, (await context.params).projectId);
}
export const POST = GET;
