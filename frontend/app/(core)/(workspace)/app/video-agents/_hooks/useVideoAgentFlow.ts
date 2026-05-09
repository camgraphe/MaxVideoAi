'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  DEFAULT_VIDEO_AGENT_SETTINGS,
  VIDEO_AGENT_PRESETS,
  estimateVideoAgentPriceCents,
  type VideoAgentAspectRatio,
  type VideoAgentResolution,
  type VideoAgentSettings,
} from '../_lib/video-agent-config';
import { VIDEO_AGENT_COPY } from '../_lib/video-agent-copy';
import {
  EMPTY_COMMERCIAL_VIDEO_AGENT_BRIEF,
  isCommercialBriefComplete,
  type CommercialVideoAgentBrief,
} from '../_lib/video-agent-brief';
import {
  VIDEO_AGENT_CHAT_API_PATH,
  createLocalVideoAgentIntakeResponse,
  createLocalVideoAgentPreparePromptResponse,
  type VideoAgentChatApiResponse,
  type VideoAgentChatApiRequest,
  type VideoAgentIntakeApiResponse,
  type VideoAgentPreparePromptApiResponse,
} from '../_lib/video-agent-api';
import {
  createVideoAgentMessage,
  type VideoAgentConfirmation,
  type VideoAgentFlowPhase,
  type VideoAgentMessage,
  type VideoAgentPrototypeResult,
} from '../_lib/video-agent-state';

async function waitForMinimumLatency(startedAt: number, minimumLatencyMs: number): Promise<void> {
  const remainingMs = minimumLatencyMs - (Date.now() - startedAt);
  if (remainingMs <= 0) return;
  await new Promise((resolve) => window.setTimeout(resolve, remainingMs));
}

async function requestVideoAgentChat(
  request: VideoAgentChatApiRequest
): Promise<VideoAgentChatApiResponse> {
  const response = await fetch(VIDEO_AGENT_CHAT_API_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  const payload = (await response.json().catch(() => null)) as VideoAgentChatApiResponse | null;
  if (!payload) {
    throw new Error('Invalid video agent response');
  }

  return payload;
}

export function useVideoAgentFlow() {
  const preset = VIDEO_AGENT_PRESETS[0];
  const [settings, setSettings] = useState<VideoAgentSettings>(DEFAULT_VIDEO_AGENT_SETTINGS);
  const [inputValue, setInputValue] = useState('');
  const [phase, setPhase] = useState<VideoAgentFlowPhase>('public');
  const [brief, setBrief] = useState<CommercialVideoAgentBrief>(EMPTY_COMMERCIAL_VIDEO_AGENT_BRIEF);
  const [confirmation, setConfirmation] = useState<VideoAgentConfirmation | null>(null);
  const [prototypeResult, setPrototypeResult] = useState<VideoAgentPrototypeResult | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [messages, setMessages] = useState<VideoAgentMessage[]>(() => [
    createVideoAgentMessage('assistant', VIDEO_AGENT_COPY.chat.firstMessage),
  ]);

  const estimatedPriceCents = useMemo(() => estimateVideoAgentPriceCents(settings), [settings]);

  const updateDuration = useCallback((durationSec: VideoAgentSettings['durationSec']) => {
    setSettings((current) => ({ ...current, durationSec }));
  }, []);

  const updateAspectRatio = useCallback((aspectRatio: VideoAgentAspectRatio) => {
    setSettings((current) => ({ ...current, aspectRatio }));
  }, []);

  const updateResolution = useCallback((resolution: VideoAgentResolution) => {
    setSettings((current) => ({ ...current, resolution }));
  }, []);

  const toggleAudio = useCallback(() => {
    setSettings((current) => ({ ...current, audioEnabled: !current.audioEnabled }));
  }, []);

  const applyIntakeResponse = useCallback((response: VideoAgentIntakeApiResponse) => {
    setBrief(response.brief);
    setPrototypeResult(null);
    setPhase(response.phase);
    setConfirmation(response.confirmation);
    setMessages((current) => [
      ...current,
      createVideoAgentMessage('assistant', response.assistantReply),
    ]);
  }, []);

  const sendMessage = useCallback(
    async (rawText?: string) => {
      if (isThinking) return;
      const text = (rawText ?? inputValue).trim();
      if (!text) return;

      const request = {
        action: 'intake',
        message: text,
        brief,
        settings,
        estimatedPriceCents,
      } satisfies VideoAgentChatApiRequest;
      const localFallback = createLocalVideoAgentIntakeResponse(request);
      const startedAt = Date.now();

      setMessages((current) => [...current, createVideoAgentMessage('user', text)]);
      setInputValue('');
      setPrototypeResult(null);
      setIsThinking(true);

      try {
        const response = await requestVideoAgentChat(request);
        const intakeResponse =
          response.ok && response.action === 'intake' ? response : localFallback;
        await waitForMinimumLatency(startedAt, intakeResponse.minimumLatencyMs);
        applyIntakeResponse(intakeResponse);
      } catch {
        await waitForMinimumLatency(startedAt, localFallback.minimumLatencyMs);
        applyIntakeResponse(localFallback);
      } finally {
        setIsThinking(false);
      }
    },
    [applyIntakeResponse, brief, estimatedPriceCents, inputValue, isThinking, settings]
  );

  const confirmPrototype = useCallback(async () => {
    if (isThinking || !confirmation || !isCommercialBriefComplete(brief)) return;

    const request = {
      action: 'prepare-prompt',
      brief,
      estimatedPriceCents,
      settings,
    } satisfies VideoAgentChatApiRequest;
    const localFallback = createLocalVideoAgentPreparePromptResponse(request);
    const startedAt = Date.now();

    setIsThinking(true);

    try {
      const response = await requestVideoAgentChat(request);
      const promptResponse: VideoAgentPreparePromptApiResponse | null =
        response.ok && response.action === 'prepare-prompt'
          ? response
          : localFallback.ok
            ? localFallback
            : null;

      if (promptResponse) {
        await waitForMinimumLatency(startedAt, promptResponse.minimumLatencyMs);
        setPrototypeResult(promptResponse.prototypeResult);
        setPhase('prompt-ready');
        setMessages((current) => [
          ...current,
          createVideoAgentMessage('assistant', promptResponse.assistantReply),
        ]);
      }
    } catch {
      if (localFallback.ok) {
        await waitForMinimumLatency(startedAt, localFallback.minimumLatencyMs);
        setPrototypeResult(localFallback.prototypeResult);
        setPhase('prompt-ready');
        setMessages((current) => [
          ...current,
          createVideoAgentMessage('assistant', localFallback.assistantReply),
        ]);
      }
    } finally {
      setIsThinking(false);
    }
  }, [brief, confirmation, estimatedPriceCents, isThinking, settings]);

  return {
    brief,
    confirmation,
    estimatedPriceCents,
    inputValue,
    isThinking,
    messages,
    phase,
    preset,
    prototypeResult,
    confirmPrototype,
    sendMessage,
    setInputValue,
    settings,
    toggleAudio,
    updateAspectRatio,
    updateDuration,
    updateResolution,
  };
}
