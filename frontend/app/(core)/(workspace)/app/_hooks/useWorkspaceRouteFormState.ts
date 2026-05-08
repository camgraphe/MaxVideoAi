'use client';

import { useCallback, useRef, useState } from 'react';
import type { MultiPromptScene } from '@/components/Composer';
import type { KlingElementState } from '@/components/KlingElementsBuilder';
import type { GroupSummary } from '@/types/groups';
import type { SharedVideoPreview } from '@/lib/video-preview-group';
import type { VideoGroup } from '@/types/video-groups';
import { DEFAULT_PROMPT } from '../_lib/workspace-client-helpers';
import { createKlingElement, createMultiPromptScene } from '../_lib/workspace-input-helpers';
import type { FormState } from '../_lib/workspace-form-state';

export function useWorkspaceRouteFormState() {
  const [form, setForm] = useState<FormState | null>(null);
  const [prompt, setPrompt] = useState<string>(DEFAULT_PROMPT);
  const [negativePrompt, setNegativePrompt] = useState<string>('');
  const [multiPromptEnabled, setMultiPromptEnabled] = useState(false);
  const [multiPromptScenes, setMultiPromptScenes] = useState<MultiPromptScene[]>(() => [createMultiPromptScene()]);
  const [shotType, setShotType] = useState<'customize' | 'intelligent'>('customize');
  const [voiceIdsInput, setVoiceIdsInput] = useState<string>('');
  const [klingElements, setKlingElements] = useState<KlingElementState[]>(() => [createKlingElement()]);
  const [cfgScale, setCfgScale] = useState<number | null>(null);
  const [memberTier, setMemberTier] = useState<'Member' | 'Plus' | 'Pro'>('Member');
  const [sharedPrompt, setSharedPrompt] = useState<string | null>(null);
  const [sharedVideoSettings, setSharedVideoSettings] = useState<SharedVideoPreview | null>(null);
  const [compositeOverride, setCompositeOverride] = useState<VideoGroup | null>(null);
  const [compositeOverrideSummary, setCompositeOverrideSummary] = useState<GroupSummary | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  const focusComposer = useCallback(() => {
    if (!composerRef.current) return;
    composerRef.current.focus({ preventScroll: true });
  }, []);

  return {
    form,
    setForm,
    prompt,
    setPrompt,
    negativePrompt,
    setNegativePrompt,
    multiPromptEnabled,
    setMultiPromptEnabled,
    multiPromptScenes,
    setMultiPromptScenes,
    shotType,
    setShotType,
    voiceIdsInput,
    setVoiceIdsInput,
    klingElements,
    setKlingElements,
    cfgScale,
    setCfgScale,
    memberTier,
    setMemberTier,
    sharedPrompt,
    setSharedPrompt,
    sharedVideoSettings,
    setSharedVideoSettings,
    compositeOverride,
    setCompositeOverride,
    compositeOverrideSummary,
    setCompositeOverrideSummary,
    composerRef,
    focusComposer,
  };
}
