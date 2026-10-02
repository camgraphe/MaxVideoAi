import { useMemo } from 'react';
import type { PricingSnapshot } from '@maxvideoai/pricing';

import type { ImageCompositePreviewEntry } from '@/components/groups/ImageCompositePreviewDock';
import type { GroupSummary } from '@/types/groups';
import { buildPendingGenerations } from '@/lib/pending-generations';
import type { HistoryEntry, ImageEngineOption } from '../_lib/image-workspace-types';

type UseImageWorkspaceDisplayStateArgs = {
  error: string | null;
  historyEntries: HistoryEntry[];
  numImages: number;
  pendingGroups: GroupSummary[];
  pricingErrorMessage: string | null;
  pricingSnapshot: PricingSnapshot | null | undefined;
  selectedEngine: ImageEngineOption | undefined;
  selectedPreviewEntryId: string | null;
  suppressDefaultPreview?: boolean;
};

export function useImageWorkspaceDisplayState({
  error,
  historyEntries,
  numImages,
  pendingGroups,
  pricingErrorMessage,
  pricingSnapshot,
  selectedEngine,
  selectedPreviewEntryId,
  suppressDefaultPreview = false,
}: UseImageWorkspaceDisplayStateArgs) {
  const previewEntry = (() => {
    if (suppressDefaultPreview && !selectedPreviewEntryId) return undefined;
    if (selectedPreviewEntryId) {
      const match = historyEntries.find((entry) => entry.id === selectedPreviewEntryId);
      if (match) return match;
    }
    return historyEntries[0];
  })();

  const pendingGenerations = useMemo(() => buildPendingGenerations(pendingGroups, 'group'), [pendingGroups]);

  const compositePreviewEntry: ImageCompositePreviewEntry | null = previewEntry
    ? {
        id: previewEntry.id,
        engineLabel: previewEntry.engineLabel,
        prompt: previewEntry.prompt,
        createdAt: previewEntry.createdAt,
        mode: previewEntry.mode,
        aspectRatio: previewEntry.aspectRatio ?? null,
        images: previewEntry.images,
      }
    : null;

  const estimatedCostAmount = pricingSnapshot
    ? pricingSnapshot.totalCents / 100
    : (selectedEngine?.pricePerImage ?? 0) * numImages;
  const estimatedCostCurrency = pricingSnapshot?.currency ?? selectedEngine?.currency ?? 'USD';
  const composerError = error ?? pricingErrorMessage ?? null;
  const canUseWorkspace = Boolean(selectedEngine?.engineCaps);

  return {
    canUseWorkspace,
    composerError,
    compositePreviewEntry,
    estimatedCostAmount,
    estimatedCostCurrency,
    pendingGenerations,
    previewEntry,
  };
}
