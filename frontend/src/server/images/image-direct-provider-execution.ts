import type { ImageGenerationResponse } from '@/types/image-generation';
import { executeBytePlusSeedreamGeneration } from './byteplus-seedream-execution';
import { executeGoogleVertexImageGeneration } from './google-vertex-image-execution';
import { executeOpenAIImageGeneration, type OpenAIImageExecutionParams } from './openai-image-execution';

type GoogleVertexImageParams = Parameters<typeof executeGoogleVertexImageGeneration>[0];
type BytePlusSeedreamParams = Parameters<typeof executeBytePlusSeedreamGeneration>[0];

type DirectImageProviderParams = GoogleVertexImageParams & Pick<BytePlusSeedreamParams, 'watermark'>
  & Pick<OpenAIImageExecutionParams, 'outputCompression' | 'background' | 'complexity' | 'preparedReferenceUrls' | 'customImageSize'>;

export async function executeDirectImageProviderIfAvailable(
  params: DirectImageProviderParams
): Promise<ImageGenerationResponse | null> {
  if (params.engine.providerMeta?.provider === 'openai_images') {
    return executeOpenAIImageGeneration(params);
  }
  if (params.engine.providerMeta?.provider === 'google_vertex_image') {
    return executeGoogleVertexImageGeneration(params);
  }

  if (params.engine.providerMeta?.provider === 'byteplus_modelark') {
    return executeBytePlusSeedreamGeneration(params);
  }

  return null;
}
