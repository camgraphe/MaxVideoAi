import type { NextRequest } from 'next/server';
import { recoverMobileAudioQuote } from '@/server/mobile/audio-quotes';
import { mobileResponse, mobileUser } from '@/server/mobile/http';

export const dynamic = 'force-dynamic';
export function GET(request: NextRequest, context: { params: Promise<{ quoteId: string }> }) {
  return mobileResponse(async () =>
    recoverMobileAudioQuote(await mobileUser(request), (await context.params).quoteId),
  );
}
