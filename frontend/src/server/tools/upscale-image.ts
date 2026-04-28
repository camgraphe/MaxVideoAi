import { createImageThumbnailBatch } from '@/server/image-thumbnails';
import type { UpscaleToolRequest, UpscaleToolResponse } from '@/types/tools-upscale';
import { runUpscaleToolBase, UpscaleToolError } from './upscale';

type RunUpscaleImageToolInput = UpscaleToolRequest & {
  userId: string;
};

export async function runImageUpscaleTool(input: RunUpscaleImageToolInput): Promise<UpscaleToolResponse> {
  if (input.mediaType !== 'image') {
    throw new UpscaleToolError('Image upscale route only accepts image media.', {
      status: 400,
      code: 'invalid_media_type',
    });
  }

  return runUpscaleToolBase(input, {
    createImageThumbnailBatch,
  });
}
