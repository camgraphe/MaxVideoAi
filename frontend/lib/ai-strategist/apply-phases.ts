import type { AiStrategistBetaApplyTarget } from './beta-bridge';
import type { AiStrategistBetaResponse } from './beta-response';

export type AiStrategistApplyPhase = {
  id: 'single' | 'starting_image' | 'video_animation';
  label: string;
  target: AiStrategistBetaApplyTarget;
  result: AiStrategistBetaResponse;
};

const STARTING_IMAGE_MODEL_ID = 'gpt-image-2';

export function buildAiStrategistApplyPhases(result: AiStrategistBetaResponse): AiStrategistApplyPhase[] {
  const split = splitStartingImageVideoPrompt(result.sanitizedFinalOutput?.finalPrompt ?? '');
  if (result.workflow !== 'text-to-image-then-image-to-video' || !split) {
    return [{
      id: 'single',
      label: result.workflow === 'image-to-video' ? 'Apply video prompt' : 'Apply to generator',
      target: result.workflow === null ? 'video' : result.workflow.includes('video') ? 'video' : 'image',
      result,
    }];
  }

  return [
    {
      id: 'starting_image',
      label: 'Apply image prompt',
      target: 'image',
      result: buildStartingImageApplyResult(result, split.startingImagePrompt),
    },
    {
      id: 'video_animation',
      label: 'Apply video prompt',
      target: 'video',
      result: buildVideoAnimationApplyResult(result, split.videoAnimationPrompt),
    },
  ];
}

export function splitStartingImageVideoPrompt(finalPrompt: string): {
  startingImagePrompt: string;
  videoAnimationPrompt: string;
} | null {
  const text = finalPrompt.trim();
  if (!text) return null;

  const startMatch = text.match(/^Starting image prompt:\s*/im);
  const videoMatch = text.match(/^Video animation prompt:\s*/im);
  if (!startMatch || !videoMatch || videoMatch.index === undefined || startMatch.index === undefined) return null;
  if (videoMatch.index <= startMatch.index) return null;

  const startContentStart = startMatch.index + startMatch[0].length;
  const startingImagePrompt = `Starting image prompt:\n${text.slice(startContentStart, videoMatch.index).trim()}`.trim();
  const videoContentStart = videoMatch.index + videoMatch[0].length;
  const videoAnimationPrompt = `Video animation prompt:\n${text.slice(videoContentStart).trim()}`.trim();
  if (!startingImagePrompt || !videoAnimationPrompt) return null;
  return { startingImagePrompt, videoAnimationPrompt };
}

function buildStartingImageApplyResult(
  result: AiStrategistBetaResponse,
  startingImagePrompt: string
): AiStrategistBetaResponse {
  const uiActions = keepActions(result.uiActions, ['SET_ASPECT_RATIO', 'SET_RESOLUTION']);
  return {
    ...result,
    workflow: null,
    selectedModel: STARTING_IMAGE_MODEL_ID,
    sanitizedFinalOutput: result.sanitizedFinalOutput
      ? {
          ...result.sanitizedFinalOutput,
          finalPrompt: startingImagePrompt,
          uiActions: [
            { type: 'SET_MODEL', value: STARTING_IMAGE_MODEL_ID },
            { type: 'SET_PROMPT', value: startingImagePrompt },
            ...uiActions,
          ],
        }
      : result.sanitizedFinalOutput,
    uiActions: [
      { type: 'SET_MODEL', value: STARTING_IMAGE_MODEL_ID },
      { type: 'SET_PROMPT', value: startingImagePrompt },
      ...uiActions,
    ],
  };
}

function buildVideoAnimationApplyResult(
  result: AiStrategistBetaResponse,
  videoAnimationPrompt: string
): AiStrategistBetaResponse {
  const selectedModel = result.selectedModel ?? findActionValue(result.uiActions, 'SET_MODEL');
  const negativePrompt = findActionValue(result.uiActions, 'SET_NEGATIVE_PROMPT') ?? result.sanitizedFinalOutput?.negativePrompt;
  const uiActions = [
    { type: 'SET_MODEL' as const, value: selectedModel ?? '' },
    { type: 'SET_WORKFLOW' as const, value: 'image-to-video' },
    { type: 'SET_PROMPT' as const, value: videoAnimationPrompt },
    ...(negativePrompt ? [{ type: 'SET_NEGATIVE_PROMPT' as const, value: negativePrompt }] : []),
    ...keepActions(result.uiActions, ['SET_ASPECT_RATIO', 'SET_DURATION', 'SET_RESOLUTION']),
  ].filter((action) => action.value);

  return {
    ...result,
    workflow: 'image-to-video',
    selectedModel: selectedModel ?? result.selectedModel,
    sanitizedFinalOutput: result.sanitizedFinalOutput
      ? {
          ...result.sanitizedFinalOutput,
          finalPrompt: videoAnimationPrompt,
          uiActions,
        }
      : result.sanitizedFinalOutput,
    uiActions,
  };
}

function keepActions(
  actions: AiStrategistBetaResponse['uiActions'],
  types: readonly AiStrategistBetaResponse['uiActions'][number]['type'][]
): AiStrategistBetaResponse['uiActions'] {
  const keep = new Set(types);
  return actions.filter((action) => keep.has(action.type) && Boolean(action.value));
}

function findActionValue(
  actions: AiStrategistBetaResponse['uiActions'],
  type: AiStrategistBetaResponse['uiActions'][number]['type']
): string | undefined {
  return actions.find((action) => action.type === type)?.value;
}
