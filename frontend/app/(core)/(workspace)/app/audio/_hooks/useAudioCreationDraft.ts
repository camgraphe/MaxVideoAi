'use client';
import { useEffect, useState } from 'react';
import { useAudioCreationScope } from './useAudioCreationScope';
import { AUDIO_CREATION_INTENTS, newAudioDraft, type AudioCreationIntent, type AudioCreationDraft } from '@/lib/audio-creation';

type Drafts = Record<AudioCreationIntent, AudioCreationDraft>;
const defaults = () => Object.fromEntries(AUDIO_CREATION_INTENTS.map(intent => [intent, newAudioDraft(intent)])) as Drafts;
/** Only a confirmed account may read/write drafts. Guests are session-only. */
export function useAudioCreationDraft(userId: string | null, intent: AudioCreationIntent) {
  const scope = useAudioCreationScope(userId);
  const [state, setState] = useState<{ owner: typeof scope | null; drafts: Drafts }>({ owner: null, drafts: defaults() });
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    const drafts = defaults();
    if (userId) {
      try {
        const raw = JSON.parse(localStorage.getItem(`maxvideoai.audio.creation.v1:${userId}`) ?? 'null');
        if (raw?.version === 1) for (const key of AUDIO_CREATION_INTENTS) {
          const value = raw.drafts?.[key];
          if (!value || typeof value !== 'object') continue;
          // Only known fields of the same primitive shape can enter state from storage.
          for (const field of Object.keys(drafts[key]) as Array<keyof AudioCreationDraft>) {
            if (field === 'reference') {
              if (value.reference && typeof value.reference.url === 'string' && /^https:\/\//.test(value.reference.url) && typeof value.reference.name === 'string') drafts[key].reference = value.reference;
            } else if (typeof value[field] === typeof drafts[key][field]) Object.assign(drafts[key], { [field]: value[field] });
          }
        }
        // Drafts saved before the model picker inferred Lyria Pro from duration.
        // Preserve that intent when hydrating the new explicit model field.
        if (drafts.music.durationSec > 30) drafts.music.musicModel = 'pro';
      } catch { /* Corrupt or unavailable storage must not block creation. */ }
    }
    if (scope.isCurrent()) { setState({ owner: scope, drafts }); setSaved(false); }
  }, [userId, scope]);
  useEffect(() => {
    if (!userId || state.owner !== scope || !scope.isCurrent()) return;
    try { localStorage.setItem(`maxvideoai.audio.creation.v1:${userId}`, JSON.stringify({ version: 1, drafts: state.drafts })); setSaved(true); }
    catch { setSaved(false); }
  }, [state, userId, scope]);
  const draft = state.owner === scope ? state.drafts[intent] : newAudioDraft(intent);
  const update = (patch: Partial<AudioCreationDraft>) => {
    if (!scope.isCurrent()) return;
    setState(previous => scope.isCurrent() && previous.owner === scope ? { ...previous, drafts: { ...previous.drafts, [intent]: { ...previous.drafts[intent], ...patch } } } : previous);
  };
  return { draft, update, saved: saved && state.owner === scope };
}
