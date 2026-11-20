import { useEffect, type Dispatch, type SetStateAction } from 'react';
import { resolvePricingVideoPreset } from '@/lib/video/pricing-presets';
import type { FormState } from '../_lib/workspace-form-state';

type Props = {
  searchString: string;
  ready: boolean;
  form: FormState | null | undefined;
  setForm: Dispatch<SetStateAction<FormState | null>>;
  setMultiPromptEnabled: (enabled: boolean) => void;
  setVoiceIdsInput: (ids: string) => void;
};

/** A pricing link changes the quoted controls after draft hydration. Keep the writer's prompt and assets. */
export function usePricingVideoPreset({ searchString, ready, form, setForm, setMultiPromptEnabled, setVoiceIdsInput }: Props) {
  const engine = form?.engineId;
  const mode = form?.mode;
  const params = new URLSearchParams(searchString);
  const token = params.get('pricingPreset');
  const applicable = Boolean(token && engine === params.get('engine') && params.get('mode') === 't2v' && mode === 't2v'
    && resolvePricingVideoPreset(engine ?? null, token)
    && !['job', 'from', 'continueDraft', 'tool', 'videoPrompt'].some(key => params.has(key)));

  useEffect(() => {
    if (!ready || !applicable || !engine) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get('pricingPreset') !== token || url.searchParams.get('engine') !== engine) return;
    const core = resolvePricingVideoPreset(engine, token);
    if (!core) return;
    setForm(current => current?.engineId === engine && current.mode === 't2v'
      ? { ...current, ...core, iterations: 1, numFrames: null } : current);
    setMultiPromptEnabled(false);
    setVoiceIdsInput('');
    url.searchParams.delete('pricingPreset');
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
  }, [ready, applicable, engine, token, setForm, setMultiPromptEnabled, setVoiceIdsInput]);
}
