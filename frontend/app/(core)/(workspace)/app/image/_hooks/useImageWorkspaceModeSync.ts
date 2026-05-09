import { useEffect, type Dispatch, type SetStateAction } from 'react';
import type { ImageGenerationMode } from '@/types/image-generation';
import type { ImageEngineOption } from '../_lib/image-workspace-types';

type UseImageWorkspaceModeSyncArgs = {
  autoModeFromReferences: boolean;
  hasAnyReferenceSelection: boolean;
  mode: ImageGenerationMode;
  selectedEngine?: ImageEngineOption;
  setMode: Dispatch<SetStateAction<ImageGenerationMode>>;
};

export function useImageWorkspaceModeSync({
  autoModeFromReferences,
  hasAnyReferenceSelection,
  mode,
  selectedEngine,
  setMode,
}: UseImageWorkspaceModeSyncArgs) {
  useEffect(() => {
    if (!selectedEngine || !autoModeFromReferences) return;
    const desiredMode: ImageGenerationMode =
      hasAnyReferenceSelection && selectedEngine.modes.includes('i2i')
        ? 'i2i'
        : selectedEngine.modes.includes('t2i')
          ? 't2i'
          : (selectedEngine.modes[0] as ImageGenerationMode);
    if (mode !== desiredMode) {
      setMode(desiredMode);
    }
  }, [autoModeFromReferences, hasAnyReferenceSelection, mode, selectedEngine, setMode]);
}
