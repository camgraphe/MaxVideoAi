import type { NextRequest } from 'next/server';
import { readMobileAudioCatalog } from '@/server/mobile/audio-catalog';
import { mobileResponse, MobileHttpError } from '@/server/mobile/http';

export const dynamic = 'force-dynamic';
export function GET(_request: NextRequest, context: { params: Promise<{ mode: string }> }) {
  return mobileResponse(async () => {
    const { mode } = await context.params;
    const details = readMobileAudioCatalog(undefined, _request.nextUrl.searchParams.get('references') === '1').modes.find((entry) => entry.mode === mode);
    if (!details) throw new MobileHttpError('MODE_NOT_FOUND', 404, 'Audio mode not found.');
    return details;
  });
}
