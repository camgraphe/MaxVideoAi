import type { NextRequest } from 'next/server';
import { mobileResponse, mobileUser } from '@/server/mobile/http';
import { readMobileJob } from '@/server/mobile/generations';

export const dynamic = 'force-dynamic';
export function GET(request: NextRequest, context: { params: Promise<{ jobId: string }> }) {
  return mobileResponse(async () => readMobileJob(await mobileUser(request), (await context.params).jobId, { includeOutputs: true }));
}
