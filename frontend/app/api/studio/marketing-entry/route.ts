import { NextRequest } from 'next/server';
import { handleStudioMarketingEntry } from './_lib/handle-studio-marketing-entry';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return handleStudioMarketingEntry(request);
}
