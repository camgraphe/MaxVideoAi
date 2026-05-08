import { useCallback, type Dispatch, type SetStateAction } from 'react';
import { runAngleTool } from '@/lib/api';
import { resolveAngleEngineForParams } from '@/lib/tools-angle';
import type { AngleToolEngineId, AngleToolNumericParams, AngleToolResponse } from '@/types/tools-angle';
import type { AngleCopy } from '../_lib/angle-workspace-copy';
import {
  emitClientMetric,
  isAuthRequiredError,
  sanitizeParams,
} from '../_lib/angle-workspace-helpers';
import type { UploadedImage } from '../_lib/angle-workspace-types';

interface UseAngleGenerationRunnerParams {
  copy: AngleCopy;
  engineId: AngleToolEngineId;
  generateBestAngles: boolean;
  openAuthGate: () => void;
  params: AngleToolNumericParams;
  safeMode: boolean;
  setError: Dispatch<SetStateAction<string | null>>;
  setGenerating: Dispatch<SetStateAction<boolean>>;
  setParams: Dispatch<SetStateAction<AngleToolNumericParams>>;
  setResult: Dispatch<SetStateAction<AngleToolResponse | null>>;
  setSelectedOutputIndex: Dispatch<SetStateAction<number>>;
  sourceImage: UploadedImage | null;
  user: unknown;
}

export function useAngleGenerationRunner({
  copy,
  engineId,
  generateBestAngles,
  openAuthGate,
  params,
  safeMode,
  setError,
  setGenerating,
  setParams,
  setResult,
  setSelectedOutputIndex,
  sourceImage,
  user,
}: UseAngleGenerationRunnerParams) {
  return useCallback(async () => {
    if (!user) {
      openAuthGate();
      return;
    }
    if (!sourceImage?.url) {
      setError(copy.missingSource);
      return;
    }

    setGenerating(true);
    setError(null);

    emitClientMetric('tool_start', {
      tool_name: 'angle',
      tool_surface: 'workspace',
      logged_in: true,
      engine: engineId,
      generate_best_angles: generateBestAngles,
      rotation: params.rotation,
      tilt: params.tilt,
      zoom: params.zoom,
    });

    try {
      const normalizedParams = sanitizeParams(params);
      const resolvedEngineId = resolveAngleEngineForParams(engineId, normalizedParams);
      setParams(normalizedParams);
      const response = await runAngleTool({
        imageUrl: sourceImage.url,
        engineId: resolvedEngineId,
        params: normalizedParams,
        safeMode,
        generateBestAngles,
        imageWidth: sourceImage.width ?? undefined,
        imageHeight: sourceImage.height ?? undefined,
      });

      setResult(response);
      setSelectedOutputIndex(0);

      emitClientMetric('tool_complete', {
        tool_name: 'angle',
        tool_surface: 'workspace',
        logged_in: true,
        engine: response.engineId,
        latency_ms: response.latencyMs,
        estimated_cost_usd: response.pricing.estimatedCostUsd,
        actual_cost_usd: response.pricing.actualCostUsd ?? null,
        estimated_credits: response.pricing.estimatedCredits,
        actual_credits: response.pricing.actualCredits ?? null,
        generate_best_angles: generateBestAngles,
        output_count: response.requestedOutputCount,
      });
    } catch (runError) {
      if (isAuthRequiredError(runError)) {
        openAuthGate();
        return;
      }
      setError(runError instanceof Error ? runError.message : copy.generationFailed);
    } finally {
      setGenerating(false);
    }
  }, [
    copy.generationFailed,
    copy.missingSource,
    engineId,
    generateBestAngles,
    openAuthGate,
    params,
    safeMode,
    setError,
    setGenerating,
    setParams,
    setResult,
    setSelectedOutputIndex,
    sourceImage?.height,
    sourceImage?.url,
    sourceImage?.width,
    user,
  ]);
}
