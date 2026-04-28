export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { runVideoUpscaleTool } from '@/server/tools/upscale-video';
import { handleUpscaleToolRequest } from '../_shared';

export async function POST(req: NextRequest) {
  return handleUpscaleToolRequest(req, 'video', runVideoUpscaleTool);
}
