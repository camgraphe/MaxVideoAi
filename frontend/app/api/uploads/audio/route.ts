import type { NextRequest } from 'next/server';
import { handleAudioUpload } from './_lib/audio-upload-handler';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  return handleAudioUpload(req);
}
