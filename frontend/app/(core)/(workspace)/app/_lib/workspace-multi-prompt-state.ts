import { KLING_MULTI_PROMPT_SCENE_MAX_CHARS } from '@/lib/kling-provider-limits';

export { KLING_MULTI_PROMPT_SCENE_MAX_CHARS };

type MultiPromptSceneLike = {
  prompt: string;
  duration: number;
};

export type WorkspaceMultiPromptState = {
  totalDurationSec: number;
  invalid: boolean;
  error: string | null;
  maxScenePromptChars: number;
};

export function getWorkspaceMultiPromptState(params: {
  active: boolean;
  scenes: MultiPromptSceneLike[];
  minDurationSec: number;
  maxDurationSec: number;
}): WorkspaceMultiPromptState {
  const totalDurationSec = params.scenes.reduce((sum, scene) => sum + (scene.duration || 0), 0);
  const base = {
    totalDurationSec,
    maxScenePromptChars: KLING_MULTI_PROMPT_SCENE_MAX_CHARS,
  };

  if (!params.active) {
    return {
      ...base,
      invalid: false,
      error: null,
    };
  }

  if (params.scenes.length === 0 || params.scenes.some((scene) => !scene.prompt.trim())) {
    return {
      ...base,
      invalid: true,
      error: `Multi-prompt requires a prompt per scene and total duration between ${params.minDurationSec}s and ${params.maxDurationSec}s.`,
    };
  }

  const overflowingSceneIndex = params.scenes.findIndex(
    (scene) => scene.prompt.length > KLING_MULTI_PROMPT_SCENE_MAX_CHARS
  );
  if (overflowingSceneIndex >= 0) {
    const promptLength = params.scenes[overflowingSceneIndex]?.prompt.length ?? 0;
    const overflow = promptLength - KLING_MULTI_PROMPT_SCENE_MAX_CHARS;
    return {
      ...base,
      invalid: true,
      error: `Scene ${overflowingSceneIndex + 1} prompt is ${overflow} character${overflow === 1 ? '' : 's'} over the ${KLING_MULTI_PROMPT_SCENE_MAX_CHARS}-character provider limit.`,
    };
  }

  if (totalDurationSec < params.minDurationSec || totalDurationSec > params.maxDurationSec) {
    return {
      ...base,
      invalid: true,
      error: `Multi-prompt requires a prompt per scene and total duration between ${params.minDurationSec}s and ${params.maxDurationSec}s.`,
    };
  }

  return {
    ...base,
    invalid: false,
    error: null,
  };
}
