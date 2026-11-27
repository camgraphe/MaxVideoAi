import type { NextRequest } from 'next/server';
import { mobileResponse, mobileUser, MobileHttpError } from '@/server/mobile/http';
import { prepareMobileVideoExcerpt } from '@/server/mobile/video-excerpt';
import { readBoundedJsonBody } from '@/server/read-bounded-json-body';

export const runtime = 'nodejs';
export const maxDuration = 300;
export function POST(request: NextRequest) {
  return mobileResponse(async () => {
    const userId = await mobileUser(request, true);
    if (request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase() !== 'application/json')
      throw new MobileHttpError('JSON_REQUIRED', 415, 'Send a JSON request.');
    return prepareMobileVideoExcerpt(userId, await readBoundedJsonBody(request, 16 * 1024));
  });
}
