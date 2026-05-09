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
  createVideoAgentMessage,
  type VideoAgentMessage,
} from '../_lib/video-agent-state';

export function useVideoAgentFlow() {
  const preset = VIDEO_AGENT_PRESETS[0];
  const [settings, setSettings] = useState<VideoAgentSettings>(DEFAULT_VIDEO_AGENT_SETTINGS);
  const [inputValue, setInputValue] = useState('');
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

  const sendMessage = useCallback(
    (rawText?: string) => {
      const text = (rawText ?? inputValue).trim();
      if (!text) return;

      setMessages((current) => {
        const assistantReply =
          current.filter((message) => message.role === 'user').length === 0
            ? VIDEO_AGENT_COPY.chat.followUp
            : VIDEO_AGENT_COPY.chat.compatibility;
        return [
          ...current,
          createVideoAgentMessage('user', text),
          createVideoAgentMessage('assistant', assistantReply),
        ];
      });
      setInputValue('');
    },
    [inputValue]
  );

  return {
    estimatedPriceCents,
    inputValue,
    messages,
    preset,
    sendMessage,
    setInputValue,
    settings,
    toggleAudio,
    updateAspectRatio,
    updateDuration,
    updateResolution,
  };
}
