import type { Dispatch, SetStateAction } from 'react';
import type { CharacterBuilderState } from '@/types/character-builder';
import type { StudioRecastSelection } from '@/types/character-studio';
import { buildStudioLookDraft } from '@/lib/character-studio-look';
import type { useCharacterStudioLibrary } from '../_hooks/useCharacterStudioLibrary';
import type { CharacterStudioMode } from '../_components/CharacterStudioNavigation.client';
import type { StudioTab } from '../_components/CharacterStudioWorkspaceView.client';
import { startNewCharacter, applyCharacterInspiration } from './character-studio-state';

type Set<T> = Dispatch<SetStateAction<T>>;
/** All editor replacements share a draft lifetime; completed jobs keep their own account lifetime. */
export function createStudioDraftTransitions({
  library,
  currentMode,
  inspirationApplied,
  beginDraftIntent,
  setState,
  setMode,
  setMobileResults,
  setTab,
  setEditorKey,
  setRecastSelection,
  setError,
  setStatusMessage,
  onReset,
}: {
  library: ReturnType<typeof useCharacterStudioLibrary>;
  currentMode: CharacterStudioMode;
  inspirationApplied: (name: string) => string;
  beginDraftIntent: () => void;
  setState: Set<CharacterBuilderState>;
  setMode: Set<CharacterStudioMode>;
  setMobileResults: Set<boolean>;
  setTab: Set<StudioTab>;
  setEditorKey: Set<number>;
  setRecastSelection: Set<StudioRecastSelection | null>;
  setError: Set<string | null>;
  setStatusMessage: Set<string | null>;
  onReset: () => void;
}) {
  const clearNotices = () => {
    setError(null);
    setStatusMessage(null);
  };
  return {
    async newLook(id: string, sheet = false) {
      beginDraftIntent();
      const character = await library.openCharacter(id);
      if (!character) return;
      setState((previous) => {
        const draft = buildStudioLookDraft(previous, character);
        if (!sheet) return draft;
        return {
          ...draft, outputMode: 'character-sheet', qualityMode: 'draft', formatMode: 'standard',
          traits: { ...draft.traits, sceneId: null, customSceneDescription: '' },
          outputOptions: { ...draft.outputOptions, includeCloseUps: false, fullBodyRequired: true, neutralStudioBackground: true },
        };
      });
      setMode('character');
      setMobileResults(false);
      setEditorKey((key) => key + 1);
      clearNotices();
    },
    handoffRecast(source: { jobId: string; imageUrl: string }, name: string, characterId?: string) {
      beginDraftIntent();
      library.cancelDetails();
      setRecastSelection({ ...source, name, characterId, transferId: crypto.randomUUID() });
      setMode('recast');
      clearNotices();
    },
    newCharacter() {
      beginDraftIntent();
      library.closeCharacter();
      // Old entry intents must not resurrect a snapshot or Recast entry on reload.
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        if (url.searchParams.has('job') || url.searchParams.has('mode')) {
          url.searchParams.delete('job');
          url.searchParams.delete('mode');
          window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
        }
      }
      setMode('character');
      setMobileResults(false);
      setState(startNewCharacter);
      setTab('explore');
      setEditorKey((key) => key + 1);
      onReset();
      clearNotices();
    },
    chooseInspiration(name: string) {
      beginDraftIntent();
      library.closeCharacter();
      setMobileResults(false);
      setState((previous) => applyCharacterInspiration(previous, name));
      setEditorKey((key) => key + 1);
      clearNotices();
      setStatusMessage(inspirationApplied(name));
    },
    changeMode(mode: CharacterStudioMode) {
      if (mode === currentMode) return;
      library.cancelDetails();
      setMode(mode);
    },
    changeTab(tab: StudioTab) {
      library.cancelDetails();
      setTab(tab);
    },
  };
}
