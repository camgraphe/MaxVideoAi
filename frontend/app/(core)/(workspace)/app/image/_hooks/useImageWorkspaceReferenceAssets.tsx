import { useMemo } from 'react';
import { Plus } from 'lucide-react';

import type { AssetFieldConfig, ComposerAttachment } from '@/components/Composer';
import { Button } from '@/components/ui/Button';
import type { ImageGenerationMode } from '@/types/image-generation';
import type { ImageWorkspaceCopy } from '../_lib/image-workspace-copy';
import type { ReferenceSlotValue } from '../_lib/image-workspace-types';

type UseImageWorkspaceReferenceAssetsArgs = {
  displayedReferenceSlotCount: number;
  displayedReferenceSlots: (ReferenceSlotValue | null)[];
  mode: ImageGenerationMode;
  openCharacterLibrary: () => void;
  referenceHelperText: string;
  referenceMinRequired: number;
  referenceNoteText: string;
  referenceSlotLimit: number;
  resolvedCopy: ImageWorkspaceCopy;
  supportsCharacterReferences: boolean;
};

export function useImageWorkspaceReferenceAssets({
  displayedReferenceSlotCount,
  displayedReferenceSlots,
  mode,
  openCharacterLibrary,
  referenceHelperText,
  referenceMinRequired,
  referenceNoteText,
  referenceSlotLimit,
  resolvedCopy,
  supportsCharacterReferences,
}: UseImageWorkspaceReferenceAssetsArgs) {
  const characterHeaderAction = useMemo(() => {
    if (!supportsCharacterReferences) return null;
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={(event) => {
          event.stopPropagation();
          openCharacterLibrary();
        }}
        className="min-h-0 h-7 gap-1.5 rounded-full px-2.5 py-0 text-[11px] font-medium text-text-secondary hover:bg-surface-2 hover:text-text-primary"
      >
        <Plus className="h-3.5 w-3.5 text-brand" />
        <span>{resolvedCopy.composer.characterButton}</span>
      </Button>
    );
  }, [openCharacterLibrary, resolvedCopy.composer.characterButton, supportsCharacterReferences]);

  const referenceAssetFields = useMemo<AssetFieldConfig[]>(() => {
    if (referenceSlotLimit <= 0) return [];
    return [
      {
        field: {
          id: 'reference_images',
          type: 'image',
          label: resolvedCopy.composer.referenceLabel,
          description: `${referenceHelperText}. ${referenceNoteText}`,
          minCount: mode === 'i2i' ? referenceMinRequired : 0,
          maxCount: displayedReferenceSlotCount,
        },
        required: mode === 'i2i' && referenceMinRequired > 0,
        role: 'reference',
        headerAction: characterHeaderAction,
      },
    ];
  }, [
    characterHeaderAction,
    displayedReferenceSlotCount,
    mode,
    referenceHelperText,
    referenceMinRequired,
    referenceNoteText,
    referenceSlotLimit,
    resolvedCopy.composer.referenceLabel,
  ]);

  const composerReferenceAssets = useMemo<Record<string, (ComposerAttachment | null)[]>>(
    () => ({
      reference_images: displayedReferenceSlots.map((slot) =>
        slot
          ? {
              kind: 'image',
              name: slot.name ?? slot.url.split('/').pop() ?? resolvedCopy.composer.referenceSlotNameFallback,
              size: 0,
              type: 'image/*',
              previewUrl: slot.previewUrl ?? slot.url,
              status: slot.status,
              badge: slot.characterReference ? resolvedCopy.composer.characterButton : undefined,
            }
          : null
      ),
    }),
    [
      displayedReferenceSlots,
      resolvedCopy.composer.characterButton,
      resolvedCopy.composer.referenceSlotNameFallback,
    ]
  );

  return {
    composerReferenceAssets,
    referenceAssetFields,
  };
}
