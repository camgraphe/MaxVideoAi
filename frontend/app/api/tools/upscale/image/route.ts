export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { runImageUpscaleTool } from '@/server/tools/upscale-image';
import { handleUpscaleToolRequest } from '../_shared';

export async function POST(req: NextRequest) {
  return handleUpscaleToolRequest(req, 'image', runImageUpscaleTool);
}
