import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { PricingSnapshot } from '@maxvideoai/pricing';

import type { ImageCompositePreviewEntry } from '@/components/groups/ImageCompositePreviewDock';
import type { GroupSummary } from '@/types/groups';
import { buildPendingGenerations } from '@/lib/pending-generations';
import type { HistoryEntry, ImageEngineOption } from '../_lib/image-workspace-types';
import type { StarterMedia } from '@/lib/starter-media';
import { useStarterMedia } from '@/components/starters/useStarterMedia';

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
  guestStarter?: { ready: boolean; prompt: string; setPrompt: Dispatch<SetStateAction<string>> };
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
  guestStarter,
}: UseImageWorkspaceDisplayStateArgs) {
  const [selectedStarter, setSelectedStarter] = useState<StarterMedia | null>(null);
  const collection = useStarterMedia('image', Boolean(guestStarter?.ready || selectedStarter));
  const starterItems = selectedStarter && !collection.some(item => item.id === selectedStarter.id)
    ? [selectedStarter, ...collection] : collection;
  const guestStarterApplied = useRef(false);
  const setStarterPrompt = guestStarter?.setPrompt;
  const selectStarter = useCallback((item: StarterMedia) => {
    guestStarterApplied.current = true;
    setSelectedStarter(item);
    setStarterPrompt?.(item.prompt);
  }, [setStarterPrompt]);
  useLayoutEffect(() => {
    if (!guestStarter?.ready || guestStarterApplied.current || !starterItems.length) return;
    guestStarterApplied.current = true;
    if (guestStarter.prompt.trim() || selectedPreviewEntryId || historyEntries.length || pendingGroups.length || suppressDefaultPreview) return;
    selectStarter(starterItems[0]);
  }, [guestStarter, historyEntries.length, pendingGroups.length, selectedPreviewEntryId, starterItems, suppressDefaultPreview, selectStarter]);
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
  const starterPreview = !previewEntry && !pendingGroups.length && !suppressDefaultPreview ? selectedStarter : null;
  const starterIndex = Math.max(0, starterItems.findIndex(item => item.id === selectedStarter?.id));

  return {
    starterPreview,
    selectStarter,
    starterNavigation: {
      index: starterIndex,
      total: starterItems.length,
      onPrev: starterIndex > 0 ? () => selectStarter(starterItems[starterIndex - 1]) : undefined,
      onNext: starterIndex < starterItems.length - 1 ? () => selectStarter(starterItems[starterIndex + 1]) : undefined,
    },
    canUseWorkspace,
    composerError,
    compositePreviewEntry,
    estimatedCostAmount,
    estimatedCostCurrency,
    pendingGenerations,
    previewEntry,
  };
}
