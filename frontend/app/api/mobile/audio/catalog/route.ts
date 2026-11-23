import { readMobileAudioCatalog } from '@/server/mobile/audio-catalog';
import { mobileResponse } from '@/server/mobile/http';

export const dynamic = 'force-dynamic';
export function GET(request?: Request) {
  const withReferences = !!request && new URL(request.url).searchParams.get('references') === '1';
  return mobileResponse(async () => readMobileAudioCatalog(undefined, withReferences));
}
