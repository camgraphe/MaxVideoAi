import {
  VIDEO_AGENT_LLM_CONFIG,
  VIDEO_AGENT_PRESETS,
  type VideoAgentSettings,
} from './video-agent-config';
import {
  EMPTY_COMMERCIAL_VIDEO_AGENT_BRIEF,
  isCommercialBriefComplete,
  type CommercialVideoAgentBrief,
} from './video-agent-brief';
import { applyCommercialIntakeMessage, askNextCommercialBriefQuestion } from './video-agent-intake';
import { createCommercialVideoPromptPackage } from './commercial-video-prompt-package';
import { reviewCommercialVideoRequest, type VideoAgentWarning } from './video-agent-safety';
import type {
  VideoAgentConfirmation,
  VideoAgentFlowPhase,
  VideoAgentPrototypeResult,
} from './video-agent-state';

export const VIDEO_AGENT_CHAT_API_PATH = '/api/video-agents/commercial/chat';

export type VideoAgentApiSource = 'openai' | 'local-fallback';

export type VideoAgentIntakeApiRequest = {
  action: 'intake';
  message: string;
  brief: CommercialVideoAgentBrief;
  settings: VideoAgentSettings;
  estimatedPriceCents: number;
};

export type VideoAgentPreparePromptApiRequest = {
  action: 'prepare-prompt';
  brief: CommercialVideoAgentBrief;
  settings: VideoAgentSettings;
  estimatedPriceCents: number;
};

export type VideoAgentChatApiRequest =
  | VideoAgentIntakeApiRequest
  | VideoAgentPreparePromptApiRequest;

type VideoAgentApiSuccessBase = {
  ok: true;
  source: VideoAgentApiSource;
  model: string | null;
  minimumLatencyMs: number;
};

export type VideoAgentIntakeApiResponse = VideoAgentApiSuccessBase & {
  action: 'intake';
  phase: Exclude<VideoAgentFlowPhase, 'prompt-ready'>;
  brief: CommercialVideoAgentBrief;
  confirmation: VideoAgentConfirmation | null;
  assistantReply: string;
  warnings: VideoAgentWarning[];
};

export type VideoAgentPreparePromptApiResponse = VideoAgentApiSuccessBase & {
  action: 'prepare-prompt';
  phase: 'prompt-ready';
  prototypeResult: VideoAgentPrototypeResult;
  assistantReply: string;
};

export type VideoAgentChatApiErrorResponse = {
  ok: false;
  error: string;
  minimumLatencyMs: number;
};

export type VideoAgentChatApiResponse =
  | VideoAgentIntakeApiResponse
  | VideoAgentPreparePromptApiResponse
  | VideoAgentChatApiErrorResponse;

export function createVideoAgentConfirmation(input: {
  brief: CommercialVideoAgentBrief;
  estimatedPriceCents: number;
  settings: VideoAgentSettings;
  warnings: VideoAgentWarning[];
}): VideoAgentConfirmation {
  const preset = VIDEO_AGENT_PRESETS[0];

  return {
    settings: {
      engineLabel: preset.engineLabel,
      generationMode: preset.generationMode,
      durationSec: input.settings.durationSec,
      aspectRatio: input.settings.aspectRatio,
      resolution: input.settings.resolution,
      audioEnabled: input.settings.audioEnabled,
      estimatedPriceCents: input.estimatedPriceCents,
    },
    warnings: input.warnings,
    summary: `One ${preset.engineLabel} commercial video, ${input.settings.durationSec}s, ${input.settings.aspectRatio}, ${input.settings.resolution}, audio ${input.settings.audioEnabled ? 'on' : 'off'}, for ${input.brief.productOrOffer}.`,
  };
}

export function createLocalVideoAgentIntakeResponse(
  request: VideoAgentIntakeApiRequest
): VideoAgentIntakeApiResponse {
  const nextBrief = applyCommercialIntakeMessage(
    request.brief ?? EMPTY_COMMERCIAL_VIDEO_AGENT_BRIEF,
    request.message
  );
  const safetyReview = reviewCommercialVideoRequest(nextBrief);

  if (!safetyReview.allowed) {
    return {
      ok: true,
      action: 'intake',
      source: 'local-fallback',
      model: null,
      minimumLatencyMs: VIDEO_AGENT_LLM_CONFIG.latency.fallbackMinimumMs,
      phase: 'blocked',
      brief: nextBrief,
      confirmation: null,
      assistantReply:
        safetyReview.reason ??
        'I cannot prepare that request. Please rewrite it without unsupported content.',
      warnings: safetyReview.warnings,
    };
  }

  const nextQuestion = askNextCommercialBriefQuestion(nextBrief);
  if (nextQuestion) {
    return {
      ok: true,
      action: 'intake',
      source: 'local-fallback',
      model: null,
      minimumLatencyMs: VIDEO_AGENT_LLM_CONFIG.latency.fallbackMinimumMs,
      phase: 'intake',
      brief: nextBrief,
      confirmation: null,
      assistantReply: nextQuestion,
      warnings: safetyReview.warnings,
    };
  }

  const confirmation = createVideoAgentConfirmation({
    brief: nextBrief,
    estimatedPriceCents: request.estimatedPriceCents,
    settings: request.settings,
    warnings: safetyReview.warnings,
  });

  return {
    ok: true,
    action: 'intake',
    source: 'local-fallback',
    model: null,
    minimumLatencyMs: VIDEO_AGENT_LLM_CONFIG.latency.fallbackMinimumMs,
    phase: 'confirm',
    brief: nextBrief,
    confirmation,
    assistantReply: [
      'I have enough to prepare the commercial video prompt package.',
      `Summary: ${confirmation.summary}`,
      safetyReview.warnings.length
        ? `Warnings: ${safetyReview.warnings.map((warning) => warning.message).join(' ')}`
        : '',
      'Confirm in chat and I will prepare the final Seedance prompt and settings for manual testing.',
    ]
      .filter(Boolean)
      .join('\n'),
    warnings: safetyReview.warnings,
  };
}

export function createLocalVideoAgentPreparePromptResponse(
  request: VideoAgentPreparePromptApiRequest
): VideoAgentPreparePromptApiResponse | VideoAgentChatApiErrorResponse {
  if (!isCommercialBriefComplete(request.brief)) {
    return {
      ok: false,
      error: 'The commercial video brief is incomplete.',
      minimumLatencyMs: VIDEO_AGENT_LLM_CONFIG.latency.fallbackMinimumMs,
    };
  }

  const promptPackage = createCommercialVideoPromptPackage({
    brief: request.brief,
    estimatedPriceCents: request.estimatedPriceCents,
    preset: VIDEO_AGENT_PRESETS[0],
    settings: request.settings,
  });

  return {
    ok: true,
    action: 'prepare-prompt',
    source: 'local-fallback',
    model: null,
    minimumLatencyMs: VIDEO_AGENT_LLM_CONFIG.latency.fallbackMinimumMs,
    phase: 'prompt-ready',
    prototypeResult: promptPackage,
    assistantReply:
      'Prompt package ready. Copy the final prompt and settings to test manually; provider generation and payment will be wired later.',
  };
}
