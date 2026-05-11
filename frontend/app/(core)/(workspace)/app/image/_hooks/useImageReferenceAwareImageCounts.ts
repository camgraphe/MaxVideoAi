import { useCallback, useEffect, useMemo, type Dispatch, type SetStateAction } from 'react';
import { formatTemplate, type ImageWorkspaceCopy } from '../_lib/image-workspace-copy';
import {
  buildImageCountOptionsWithinMax,
  resolveSeedreamMaxOutputImages,
} from '../_lib/image-workspace-utils';

type ControlOption = {
  value: string | number | boolean;
  label: string;
  disabled?: boolean;
};

type UseImageReferenceAwareImageCountsParams = {
  imageCountOptions: ControlOption[];
  referenceCount: number;
  resolvedCopy: ImageWorkspaceCopy;
  selectedEngineId?: string | null;
  setNumImages: Dispatch<SetStateAction<number>>;
  setNumImagesPreset: (value: number) => void;
};

export function useImageReferenceAwareImageCounts({
  imageCountOptions,
  referenceCount,
  resolvedCopy,
  selectedEngineId,
  setNumImages,
  setNumImagesPreset,
}: UseImageReferenceAwareImageCountsParams) {
  const referenceAdjustedImageCountMax =
    selectedEngineId === 'seedream' ? resolveSeedreamMaxOutputImages(referenceCount) : null;

  useEffect(() => {
    if (referenceAdjustedImageCountMax == null) {
      return;
    }
    setNumImages((previous) => Math.min(previous, referenceAdjustedImageCountMax));
  }, [referenceAdjustedImageCountMax, setNumImages]);

  const effectiveImageCountOptions = useMemo(() => {
    if (referenceAdjustedImageCountMax == null) {
      return imageCountOptions;
    }
    return buildImageCountOptionsWithinMax({
      options: imageCountOptions,
      max: referenceAdjustedImageCountMax,
      labelForCount: (count) =>
        formatTemplate(resolvedCopy.composer.numImagesCount, {
          count,
          unit:
            count === 1
              ? resolvedCopy.composer.numImagesUnit.singular
              : resolvedCopy.composer.numImagesUnit.plural,
        }),
    });
  }, [
    imageCountOptions,
    referenceAdjustedImageCountMax,
    resolvedCopy.composer.numImagesCount,
    resolvedCopy.composer.numImagesUnit,
  ]);

  const setReferenceAwareNumImagesPreset = useCallback(
    (value: number) => {
      setNumImagesPreset(
        referenceAdjustedImageCountMax == null ? value : Math.min(value, referenceAdjustedImageCountMax)
      );
    },
    [referenceAdjustedImageCountMax, setNumImagesPreset]
  );

  return {
    effectiveImageCountOptions,
    setReferenceAwareNumImagesPreset,
  };
}
