import type { AiStrategistBetaResponse } from './beta-response';
import type { AiStrategistPlaygroundInput } from './playground-pipeline';

export const AI_STRATEGIST_PENDING_APPLY_STORAGE_KEY = 'maxvideoai.aiStrategist.pendingApply.v1';

export type AiStrategistBetaApplyTarget = 'video' | 'image';

export type AiStrategistBetaPendingApply = {
  version: 1;
  target: AiStrategistBetaApplyTarget;
  createdAt: number;
  result: AiStrategistBetaResponse;
};

export type AiStrategistBetaBridgeContext = Pick<
  AiStrategistPlaygroundInput,
  'currentPrompt' | 'uploadedAsset' | 'selectedWorkflow'
> & {
  pageContext?: unknown;
};

export type AiStrategistBetaOpenOptions = {
  source?: 'sidebar' | 'prompt_panel';
  mode?: 'general' | 'prompt_assistant';
  currentPrompt?: string;
};

export type AiStrategistBetaBridge = {
  getPageContext?: () => AiStrategistBetaBridgeContext;
  applyUiActions?: (result: AiStrategistBetaResponse) => number;
  openWidget?: (options?: AiStrategistBetaOpenOptions) => boolean;
};

export function resolveAiStrategistApplyTarget(
  result: Pick<AiStrategistBetaResponse, 'workflow' | 'uiActions'>,
  currentPath?: string | null
): AiStrategistBetaApplyTarget {
  const hasVideoWorkflow = Boolean(result.workflow && result.workflow.includes('video'));
  const hasVideoAction = result.uiActions.some((action) => action.type === 'SET_DURATION' || action.type === 'SET_WORKFLOW');
  if (hasVideoWorkflow || hasVideoAction) return 'video';
  if (currentPath?.startsWith('/app/image')) return 'image';
  return 'video';
}

export function getAiStrategistApplyHref(target: AiStrategistBetaApplyTarget): string {
  return target === 'image' ? '/app/image' : '/app';
}

export function storePendingAiStrategistApply(result: AiStrategistBetaResponse, target: AiStrategistBetaApplyTarget): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const pending: AiStrategistBetaPendingApply = {
      version: 1,
      target,
      createdAt: Date.now(),
      result,
    };
    window.sessionStorage.setItem(AI_STRATEGIST_PENDING_APPLY_STORAGE_KEY, JSON.stringify(pending));
    return true;
  } catch {
    return false;
  }
}

export function consumePendingAiStrategistApply(target: AiStrategistBetaApplyTarget): AiStrategistBetaPendingApply | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(AI_STRATEGIST_PENDING_APPLY_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AiStrategistBetaPendingApply> | null;
    if (!parsed || parsed.version !== 1 || parsed.target !== target || !parsed.result?.ok) {
      return null;
    }
    window.sessionStorage.removeItem(AI_STRATEGIST_PENDING_APPLY_STORAGE_KEY);
    return parsed as AiStrategistBetaPendingApply;
  } catch {
    window.sessionStorage.removeItem(AI_STRATEGIST_PENDING_APPLY_STORAGE_KEY);
    return null;
  }
}

declare global {
  interface Window {
    __mvaiAiStrategistBeta?: AiStrategistBetaBridge;
  }
}
