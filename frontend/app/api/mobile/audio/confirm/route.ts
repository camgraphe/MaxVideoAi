import type { NextRequest } from 'next/server';
import { confirmMobileAudioQuote } from '@/server/mobile/audio-quotes';
import { mobileResponse, mobileUser } from '@/server/mobile/http';
import { readBoundedJsonBody } from '@/server/read-bounded-json-body';

export const runtime = 'nodejs';
export const maxDuration = 800;

export function POST(request: NextRequest) {
  return mobileResponse(async () => {
    const owner = await mobileUser(request, true);
    return confirmMobileAudioQuote(owner, await readBoundedJsonBody(request, 1024), undefined, request.headers);
  });
}
