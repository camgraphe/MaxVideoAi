import type { NextRequest } from 'next/server';
import { handleVideoSeoStatusGet } from './_lib/status-read';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, props: { params: Promise<{ videoId: string }> }) {
  return handleVideoSeoStatusGet(req, props);
}
