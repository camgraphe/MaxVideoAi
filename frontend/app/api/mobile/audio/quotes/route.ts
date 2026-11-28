import type { NextRequest } from 'next/server';
import { prepareMobileAudioQuote } from '@/server/mobile/audio-quotes';
import { mobileResponse, mobileUser } from '@/server/mobile/http';
import { readBoundedJsonBody } from '@/server/read-bounded-json-body';

export function POST(request: NextRequest) {
  return mobileResponse(async () => {
    const owner = await mobileUser(request, true);
    return prepareMobileAudioQuote(owner, await readBoundedJsonBody(request, 32_768));
  });
}
