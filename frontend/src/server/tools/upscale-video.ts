import { detectVideoMetadata } from '@/server/media/detect-has-audio';
import type { UpscaleToolRequest, UpscaleToolResponse } from '@/types/tools-upscale';
import { runUpscaleToolBase, UpscaleToolError } from './upscale';

type RunUpscaleVideoToolInput = UpscaleToolRequest & {
  userId: string;
};

export async function runVideoUpscaleTool(input: RunUpscaleVideoToolInput): Promise<UpscaleToolResponse> {
  if (input.mediaType !== 'video') {
    throw new UpscaleToolError('Video upscale route only accepts video media.', {
      status: 400,
      code: 'invalid_media_type',
    });
  }

  return runUpscaleToolBase(input, {
    detectVideoMetadata,
  });
}
