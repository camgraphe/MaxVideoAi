import { useCallback, type Dispatch, type SetStateAction } from 'react';
import type { ImageGenerationMode } from '@/types/image-generation';
import type { EngineCaps } from '@/types/engines';
import { clampRequestedImageCount } from '@/lib/image/inputSchema';
import { parseGptImage2SizeKey } from '@/lib/image/gptImage2';

type UseImageWorkspacePresetHandlersArgs = {
  mode: ImageGenerationMode;
  selectedEngineCaps?: EngineCaps;
  setCustomImageHeight: Dispatch<SetStateAction<string>>;
  setCustomImageWidth: Dispatch<SetStateAction<string>>;
  setNumImages: Dispatch<SetStateAction<number>>;
  setResolution: Dispatch<SetStateAction<string | null>>;
};

export function useImageWorkspacePresetHandlers({
  mode,
  selectedEngineCaps,
  setCustomImageHeight,
  setCustomImageWidth,
  setNumImages,
  setResolution,
}: UseImageWorkspacePresetHandlersArgs) {
  const setNumImagesPreset = useCallback((value: number) => {
    setNumImages(clampRequestedImageCount(selectedEngineCaps ?? null, mode, value));
  }, [mode, selectedEngineCaps, setNumImages]);

  const setResolutionPreset = useCallback((value: string) => {
    setResolution(value);
    const parsedSize = parseGptImage2SizeKey(value);
    if (parsedSize) {
      setCustomImageWidth(String(parsedSize.width));
      setCustomImageHeight(String(parsedSize.height));
    }
  }, [setCustomImageHeight, setCustomImageWidth, setResolution]);

  return {
    setNumImagesPreset,
    setResolutionPreset,
  };
}
