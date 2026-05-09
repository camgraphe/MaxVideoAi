import { randomUUID } from 'crypto';
import {
  getCharacterFormatMultiplier,
  getCharacterFormatResolution,
  getQualityEngineId,
} from '@/lib/character-builder';
import { executeImageGeneration, ImageGenerationExecutionError } from '@/server/images/execute-image-generation';
import type {
  CharacterBuilderResponse,
  CharacterBuilderResult,
  CharacterBuilderRun,
} from '@/types/character-builder';
import { CharacterBuilderError } from './error';
import { buildPrompt } from './prompt';
import { sanitizeRequest } from './sanitize';
import { buildSettingsSnapshot } from './snapshot';
import type { RunCharacterBuilderInput } from './types';
import {
  buildImageUrls,
  buildInputMode,
  getAspectRatio,
  getBillingProductKey,
  getEngineLabel,
  trimString,
} from './utils';

export async function runCharacterBuilder(input: RunCharacterBuilderInput): Promise<CharacterBuilderResponse> {
  const request = sanitizeRequest(input);
  const prompt = buildPrompt(request);
  const imageUrls = buildImageUrls(request);
  const inputMode = buildInputMode(request, imageUrls);
  const engineId = getQualityEngineId(request.qualityMode);
  const engineLabel = getEngineLabel(engineId);
  const billingProductKey = getBillingProductKey(request.qualityMode);
  const settingsSnapshot = buildSettingsSnapshot(request, prompt, engineId, engineLabel, inputMode);
  const aspectRatio = getAspectRatio(
    request.outputMode,
    request.action,
    request.outputOptions.fullBodyRequired,
    request.outputOptions.includeCloseUps
  );
  const resolution = getCharacterFormatResolution(request.formatMode, request.qualityMode);
  const billingQuantityMultiplier = getCharacterFormatMultiplier(request.formatMode, request.qualityMode);

  try {
    const result = await executeImageGeneration({
      userId: input.userId,
      jobSurface: 'character',
      billingProductKey,
      body: {
        jobId: trimString(input.jobId) || undefined,
        engineId,
        mode: inputMode,
        prompt,
        numImages: request.generateCount === 4 ? 4 : 1,
        imageUrls: inputMode === 'i2i' ? imageUrls : undefined,
        aspectRatio,
        resolution,
        visibility: 'private',
        allowIndex: false,
        indexable: false,
      },
      settingsSnapshot,
      billingQuantityMultiplier,
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
