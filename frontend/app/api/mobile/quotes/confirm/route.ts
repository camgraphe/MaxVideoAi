import type { NextRequest } from 'next/server';
import { mobileResponse, mobileUser } from '@/server/mobile/http';
import { confirmMobileQuote } from '@/server/mobile/quotes';
import { readBoundedJsonBody } from '@/server/read-bounded-json-body';

export const maxDuration = 120;
export function POST(request: NextRequest) {
  return mobileResponse(async () => {
    const userId = await mobileUser(request, true);
    return confirmMobileQuote(userId, await readBoundedJsonBody(request, 512), undefined, request.headers);
  });
}
