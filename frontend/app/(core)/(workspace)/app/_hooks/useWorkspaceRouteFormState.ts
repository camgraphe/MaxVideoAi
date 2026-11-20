'use client';

import { useCallback, useRef, useState } from 'react';
import { useWorkspaceAssetLifetime } from './useWorkspaceAssetLifetime';
import type { Dispatch, SetStateAction } from 'react';
import type { MultiPromptScene } from '@/components/Composer';
import type { KlingElementState } from '@/components/KlingElementsBuilder';
import type { GroupSummary } from '@/types/groups';
import type { SharedVideoPreview } from '@/lib/video-preview-group';
import type { VideoGroup } from '@/types/video-groups';
import { DEFAULT_PROMPT } from '../_lib/workspace-client-helpers';
import { createKlingElement, createMultiPromptScene } from '../_lib/workspace-input-helpers';
import type { FormState } from '../_lib/workspace-form-state';

function useAccountField<T>(scope: string | null, initial: T | (() => T)) {
  const valid = useWorkspaceAssetLifetime(scope);
  const [owned, setOwned] = useState(() => ({
    scope,
    value: typeof initial === 'function' ? (initial as () => T)() : initial,
  }));
  let value = owned.value;
  if (owned.scope !== scope) {
    value = typeof initial === 'function' ? (initial as () => T)() : initial;
    setOwned({ scope, value });
  }
  const setValue = useCallback<Dispatch<SetStateAction<T>>>(
    (action) => {
      if (!valid()) return;
      setOwned((previous) => {
        const nextValue = typeof action === 'function' ? (action as (v: T) => T)(previous.value) : action;
        return previous.scope === scope && Object.is(previous.value, nextValue)
          ? previous
          : { scope, value: nextValue };
      });
    },
    [scope, valid],
  );
  return [value, setValue] as const;
}

export function useWorkspaceRouteFormState(accountScope: string | null = 'legacy') {
  const [form, setForm] = useAccountField<FormState | null>(accountScope, null);
  const [promptDraft, setPromptDraft] = useAccountField(accountScope, { text: DEFAULT_PROMPT, automatic: true });
  const hideAutomaticPrompt = form?.mode === 'reframe' || (form?.mode === 'v2v' && form.operation !== 'kling-reference');
  const automaticPrompt = promptDraft.automatic ? promptDraft.text : null;
  const prompt = promptDraft.automatic && hideAutomaticPrompt ? '' : promptDraft.text;
  const setPrompt = useCallback<Dispatch<SetStateAction<string>>>((action) => {
    setPromptDraft((current) => {
      const visible = current.automatic && hideAutomaticPrompt ? '' : current.text;
      const text = typeof action === 'function' ? action(visible) : action;
      return !current.automatic && current.text === text ? current : { text, automatic: false };
    });
  }, [hideAutomaticPrompt, setPromptDraft]);
  const setAutomaticPrompt = useCallback((text: string | undefined) => {
    if (text !== undefined) setPromptDraft((current) =>
      current.automatic && current.text === text ? current : { text, automatic: true });
  }, [setPromptDraft]);
  const [negativePrompt, setNegativePrompt] = useAccountField<string>(accountScope, '');
  const [multiPromptEnabled, setMultiPromptEnabled] = useAccountField(accountScope, false);
  const [multiPromptScenes, setMultiPromptScenes] = useAccountField<MultiPromptScene[]>(
    accountScope,
    () => [createMultiPromptScene()],
  );
  const [shotType, setShotType] = useAccountField<'customize' | 'intelligent'>(
    accountScope,
    'customize',
  );
  const [voiceIdsInput, setVoiceIdsInput] = useAccountField<string>(accountScope, '');
  const [klingElements, setKlingElements] = useAccountField<KlingElementState[]>(
    accountScope,
    () => [createKlingElement()],
  );
  const [cfgScale, setCfgScale] = useAccountField<number | null>(accountScope, null);
  const [memberTier, setMemberTier] = useAccountField<'Member' | 'Plus' | 'Pro'>(
    accountScope,
    'Member',
  );
  const [sharedPrompt, setSharedPrompt] = useAccountField<string | null>(accountScope, null);
  const [sharedVideoSettings, setSharedVideoSettings] = useAccountField<SharedVideoPreview | null>(
    accountScope,
    null,
  );
  const [compositeOverride, setCompositeOverride] = useAccountField<VideoGroup | null>(
    accountScope,
    null,
  );
  const [compositeOverrideSummary, setCompositeOverrideSummary] =
    useAccountField<GroupSummary | null>(accountScope, null);
  const clearCompositePreview = useCallback(() => {
    setCompositeOverride(null);
    setCompositeOverrideSummary(null);
  }, [setCompositeOverride, setCompositeOverrideSummary]);
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
    automaticPrompt,
    setAutomaticPrompt,
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
    clearCompositePreview,
    compositeOverride,
    setCompositeOverride,
    compositeOverrideSummary,
    setCompositeOverrideSummary,
    composerRef,
    focusComposer,
  };
}
