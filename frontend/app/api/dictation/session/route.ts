import { NextResponse, type NextRequest } from 'next/server';
import { getRouteAuthContext } from '@/lib/supabase-ssr';
import { issueDictationKey, reserveDictationSession } from '@/server/soniox-dictation';

export const runtime = 'nodejs';

const headers = { 'Cache-Control': 'private, no-store' };

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  if ((origin && origin !== request.nextUrl.origin) || request.headers.get('sec-fetch-site') === 'cross-site') {
    return new NextResponse(null, { status: 403, headers });
  }
  const apiKey = process.env.SONIOX_API_KEY?.trim();
  if (!apiKey) return new NextResponse(null, { status: 503, headers });
  try {
    const { userId } = await getRouteAuthContext(request);
    if (!userId) return new NextResponse(null, { status: 401, headers });
    if (!await reserveDictationSession(userId)) return new NextResponse(null, { status: 429, headers });
    const key = await issueDictationKey(apiKey, process.env.SONIOX_REGION?.trim(), userId,
      AbortSignal.any([request.signal, AbortSignal.timeout(6000)]));
    return NextResponse.json(key, { headers });
  } catch {
    return new NextResponse(null, { status: 503, headers });
  }
}
