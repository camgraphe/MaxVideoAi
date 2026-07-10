import type { ImageGenerationResponse } from '@/types/image-generation';
import { executeBytePlusSeedreamGeneration } from './byteplus-seedream-execution';
import { executeGoogleGeminiImageGeneration } from './google-gemini-image-execution';

type GoogleGeminiImageParams = Parameters<typeof executeGoogleGeminiImageGeneration>[0];
type BytePlusSeedreamParams = Parameters<typeof executeBytePlusSeedreamGeneration>[0];

type DirectImageProviderParams = GoogleGeminiImageParams & Pick<BytePlusSeedreamParams, 'watermark'>;

export async function executeDirectImageProviderIfAvailable(
  params: DirectImageProviderParams
): Promise<ImageGenerationResponse | null> {
  if (params.engine.providerMeta?.provider === 'google_gemini_image') {
    return executeGoogleGeminiImageGeneration(params);
  }

  if (params.engine.providerMeta?.provider === 'byteplus_modelark') {
    return executeBytePlusSeedreamGeneration(params);
  }

  return null;
}
