import type { NextRequest } from 'next/server';
import { mobileResponse, mobileUser } from '@/server/mobile/http';
import { recoverMobileQuote } from '@/server/mobile/quotes';

export const dynamic = 'force-dynamic';
export function GET(request: NextRequest, context: { params: Promise<{ quoteId: string }> }) {
  return mobileResponse(async () =>
    recoverMobileQuote(await mobileUser(request), (await context.params).quoteId),
  );
}
