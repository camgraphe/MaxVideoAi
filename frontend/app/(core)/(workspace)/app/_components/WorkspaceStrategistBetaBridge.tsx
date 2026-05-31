'use client';

import type { Dispatch, SetStateAction } from 'react';
import { useEffect } from 'react';

import {
  consumePendingAiStrategistApply,
  type AiStrategistBetaBridgeContext,
} from '@/lib/ai-strategist/beta-bridge';
import type { AiStrategistBetaResponse } from '@/lib/ai-strategist/beta-response';
import type { EngineCaps, Mode } from '@/types/engines';
import { buildAiStrategistApplyFormState, hasAiStrategistFormApply } from '../_lib/ai-strategist-apply-form';
import type { ReferenceAsset } from '../_lib/workspace-assets';
import type { FormState } from '../_lib/workspace-form-state';

type WorkspaceStrategistBetaBridgeProps = {
  engines: EngineCaps[];
  form: FormState;
  prompt: string;
  selectedEngine: EngineCaps;
  activeMode: Mode;
  inputAssets: Record<string, (ReferenceAsset | null)[]>;
  price: number | null;
  currency: string;
  setForm: Dispatch<SetStateAction<FormState | null>>;
  setPrompt: (value: string) => void;
  setNegativePrompt: (value: string) => void;
  showNotice: (message: string) => void;
};

export function WorkspaceStrategistBetaBridge({
  engines,
  form,
  prompt,
  selectedEngine,
  activeMode,
  inputAssets,
  price,
  currency,
  setForm,
  setPrompt,
  setNegativePrompt,
  showNotice,
}: WorkspaceStrategistBetaBridgeProps) {
  useEffect(() => {
    const previousBridge = window.__mvaiAiStrategistBeta;
    const getPageContext = () => ({
      currentPrompt: prompt,
      pageContext: {
        surface: 'generate_video',
        currentEngineId: selectedEngine.id,
        currentEngineLabel: selectedEngine.label,
        currentMode: activeMode,
        durationSec: form.durationSec,
        resolution: form.resolution,
        aspectRatio: form.aspectRatio,
        price,
        currency,
      },
      uploadedAsset: inferUploadedAsset(inputAssets),
    });
    const applyUiActions = (result: AiStrategistBetaResponse) => {
      let appliedCount = 0;

      for (const action of result.uiActions) {
        if (!action.value) continue;
        if (action.type === 'SET_PROMPT') {
          setPrompt(action.value);
          appliedCount += 1;
        } else if (action.type === 'SET_NEGATIVE_PROMPT') {
          setNegativePrompt(action.value);
          appliedCount += 1;
        }
      }
      if (hasAiStrategistFormApply(result)) {
        setForm((current) =>
          buildAiStrategistApplyFormState({
            currentForm: current,
            engines,
            selectedEngine,
            activeMode,
            result,
          })
        );
        appliedCount += 1;
      }

      if (appliedCount > 0) {
        showNotice('MaxVideoAI Assistant applied the preview to the generator. Review the final quote before generation.');
      }
      return appliedCount;
    };

    window.__mvaiAiStrategistBeta = {
      ...previousBridge,
      getPageContext,
      applyUiActions,
    };

    const pendingApply = consumePendingAiStrategistApply('video');
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
    activeMode,
    currency,
    engines,
    form.aspectRatio,
    form.durationSec,
    form.resolution,
    inputAssets,
    price,
    prompt,
    selectedEngine,
    setForm,
    setNegativePrompt,
    setPrompt,
    showNotice,
  ]);

  return null;
}

function inferUploadedAsset(inputAssets: Record<string, (ReferenceAsset | null)[]>): AiStrategistBetaBridgeContext['uploadedAsset'] {
  const assets = Object.values(inputAssets).flat().filter((asset): asset is ReferenceAsset => Boolean(asset));
  if (!assets.length) return undefined;
  const hasVideo = assets.some((asset) => asset.kind === 'video');
  const hasImage = assets.some((asset) => asset.kind === 'image');
  return {
    type: hasVideo ? 'video' : hasImage ? 'image' : undefined,
    isReferenceImage: hasImage,
  };
}
