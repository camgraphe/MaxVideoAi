import { randomUUID } from 'crypto';
import { resolveStudioLookRequest } from '@/server/character-studio/look';
import { executeImageGeneration, ImageGenerationExecutionError } from '@/server/images/execute-image-generation';
import type {
  CharacterBuilderResponse,
  CharacterBuilderResult,
  CharacterBuilderRun,
} from '@/types/character-builder';
import { CharacterBuilderError } from './error';
import { prepareCharacterBuilderRequest } from './preparation';
import type { RunCharacterBuilderInput } from './types';
import { trimString } from './utils';

export async function runCharacterBuilder(input: RunCharacterBuilderInput): Promise<CharacterBuilderResponse> {
  const { request, prompt, imageUrls, inputMode, engineId, engineLabel, settingsSnapshot, aspectRatio, resolution } =
    prepareCharacterBuilderRequest(await resolveStudioLookRequest(input));

  try {
    const result = await executeImageGeneration({
      userId: input.userId,
      walletReservation: 'reserve',
      customerTariffRevision: input.customerTariffRevision,
      jobSurface: 'character',
      body: {
        jobId: trimString(input.jobId) || undefined,
        engineId,
        mode: inputMode,
        prompt,
        numImages: 1,
        imageUrls: inputMode === 'i2i' ? imageUrls : undefined,
        aspectRatio,
        resolution,
        visibility: 'private',
        allowIndex: false,
        indexable: false,
      },
      settingsSnapshot,
    });

    const createdAt = new Date().toISOString();
    const runId = `character_run_${result.jobId ?? randomUUID()}`;
    const parentResultId = request.lineage?.parentResultId ?? request.selectedResultId ?? null;
    const results: CharacterBuilderResult[] = result.images.map((image, index) => ({
      ...image,
      id: `${result.jobId ?? runId}:result:${index + 1}`,
      runId,
      jobId: result.jobId ?? runId,
      engineId: result.engineId ?? engineId,
      engineLabel: result.engineLabel ?? engineLabel,
      action: request.action,
      outputMode: request.outputMode,
      qualityMode: request.qualityMode,
      formatMode: request.formatMode,
      parentResultId,
      createdAt,
    }));

    const run: CharacterBuilderRun = {
      id: runId,
      jobId: result.jobId ?? runId,
      action: request.action,
      outputMode: request.outputMode,
      qualityMode: request.qualityMode,
      formatMode: request.formatMode,
      engineId: result.engineId ?? engineId,
      engineLabel: result.engineLabel ?? engineLabel,
      createdAt,
      parentResultId,
      results,
      settingsSnapshot,
      pricing: result.pricing,
      requestId: result.requestId ?? null,
      providerJobId: result.providerJobId ?? null,
    };

    return {
      ok: true,
      run,
      settingsSnapshot,
      pricing: result.pricing,
    };
  } catch (error) {
    if (error instanceof ImageGenerationExecutionError) {
      throw new CharacterBuilderError(error.message, {
        status: error.status,
        code: error.code,
        detail: error.detail,
      });
    }
    throw error;
  }
}
