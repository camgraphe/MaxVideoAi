'use client';

import { useEffect } from 'react';

import {
  consumePendingAiStrategistApply,
  type AiStrategistBetaBridgeContext,
} from '@/lib/ai-strategist/beta-bridge';
import type { AiStrategistBetaResponse } from '@/lib/ai-strategist/beta-response';
import type { ImageGenerationMode } from '@/types/image-generation';
import type { ImageEngineOption } from '../_lib/image-workspace-types';

type ImageWorkspaceStrategistBetaBridgeProps = {
  engines: ImageEngineOption[];
  engineId: string;
  mode: ImageGenerationMode;
  prompt: string;
  aspectRatio: string | null;
  resolution: string | null;
  price: number | null;
  currency: string;
  setEngineId: (value: string) => void;
  setMode: (value: ImageGenerationMode) => void;
  setPrompt: (value: string) => void;
  setAspectRatio: (value: string | null) => void;
  setResolution: (value: string | null) => void;
  showNotice: (message: string) => void;
};

export function ImageWorkspaceStrategistBetaBridge({
  engines,
  engineId,
  mode,
  prompt,
  aspectRatio,
  resolution,
  price,
  currency,
  setEngineId,
  setMode,
  setPrompt,
  setAspectRatio,
  setResolution,
  showNotice,
}: ImageWorkspaceStrategistBetaBridgeProps) {
  useEffect(() => {
    const previousBridge = window.__mvaiAiStrategistBeta;
    const getPageContext = (): AiStrategistBetaBridgeContext => ({
      currentPrompt: prompt,
      selectedWorkflow: mode === 'i2i' ? 'image-to-video' : undefined,
      pageContext: {
        surface: 'generate_image',
        currentEngineId: engineId,
        currentMode: mode,
        aspectRatio,
        resolution,
        price,
        currency,
      },
    });
    const applyUiActions = (result: AiStrategistBetaResponse) => {
      let appliedCount = 0;
      for (const action of result.uiActions) {
        if (!action.value) continue;
        if (action.type === 'SET_PROMPT') {
          setPrompt(stripStartingImageHeading(action.value));
          appliedCount += 1;
        } else if (action.type === 'SET_MODEL') {
          const nextEngineId = normalizeImageEngineId(action.value);
          if (nextEngineId && engines.some((engine) => engine.id === nextEngineId)) {
            setEngineId(nextEngineId);
            appliedCount += 1;
          }
        } else if (action.type === 'SET_ASPECT_RATIO') {
          setAspectRatio(action.value);
          appliedCount += 1;
        } else if (action.type === 'SET_RESOLUTION') {
          setResolution(normalizeImageResolution(action.value));
          appliedCount += 1;
        } else if (action.type === 'SET_WORKFLOW') {
          setMode(action.value === 'image-to-video' ? 'i2i' : 't2i');
          appliedCount += 1;
        }
      }

      if (appliedCount > 0) {
        showNotice('MaxVideoAI Assistant applied the starting image prompt. Review before generating.');
      }
      return appliedCount;
    };

    window.__mvaiAiStrategistBeta = {
      ...previousBridge,
      getPageContext,
      applyUiActions,
    };

    const pendingApply = consumePendingAiStrategistApply('image');
    if (pendingApply) {
      applyUiActions(pendingApply.result);
    }

    return () => {
      if (
        window.__mvaiAiStrategistBeta?.getPageContext === getPageContext &&
        window.__mvaiAiStrategistBeta?.applyUiActions === applyUiActions
      ) {
        window.__mvaiAiStrategistBeta = previousBridge;
      }
    };
  }, [
    aspectRatio,
    currency,
    engineId,
    engines,
    mode,
    price,
    prompt,
    resolution,
    setAspectRatio,
    setEngineId,
    setMode,
    setPrompt,
    setResolution,
    showNotice,
  ]);

  return null;
}

function normalizeImageEngineId(value: string): string | undefined {
  if (value === 'gpt-image-2' || value === 'seedream' || value.startsWith('nano-banana')) return value;
  return undefined;
}

function normalizeImageResolution(value: string): string {
  if (/1080\s*p/i.test(value)) return '1080p';
  if (/720\s*p/i.test(value)) return '720p';
  if (/4\s*k/i.test(value)) return '4K';
  return value;
}

function stripStartingImageHeading(value: string): string {
  return value.replace(/^Starting image prompt:\s*/i, '').trim();
}
