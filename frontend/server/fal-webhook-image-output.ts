import { copyGeneratedImagesToStorage } from '@/src/server/images/image-output-storage';

export async function persistFalWebhookImageOutputs(params: {
  imageUrls: string[];
  jobId: string;
  userId: string | null;
}): Promise<string[]> {
  if (!params.userId) {
    throw new Error('A MaxVideoAI owner is required for Fal webhook image outputs');
  }
  const images = await copyGeneratedImagesToStorage({
    images: params.imageUrls.map((url) => ({ url })),
    jobId: params.jobId,
    userId: params.userId,
    requireOwnedOutput: true,
  });
  return images.map(({ url }) => url);
}
