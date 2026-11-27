import type { NextRequest } from 'next/server';
import { mobileResponse, mobileUser } from '@/server/mobile/http';
import { prepareMobileQuote } from '@/server/mobile/quotes';
import { readBoundedJsonBody } from '@/server/read-bounded-json-body';

export function POST(request: NextRequest) {
  return mobileResponse(async () => {
    const userId = await mobileUser(request, true);
    return prepareMobileQuote(userId, await readBoundedJsonBody(request, 160_000), {
      modelSettings: request.headers.get('x-maxvideoai-model-settings') === '1',
    });
  });
}
