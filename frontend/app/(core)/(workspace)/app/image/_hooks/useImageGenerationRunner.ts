'use client';

import { useCallback, type Dispatch, type FormEvent, type SetStateAction } from 'react';
import { runImageGeneration } from '@/lib/api';
import { getDefaultAspectRatio } from '@/lib/image/inputSchema';
import { validateGptImage2CustomImageSize } from '@/lib/image/gptImage2';
import { readLastKnownUserId } from '@/lib/last-known';
import { readBrowserSession } from '@/lib/supabase-auth-cleanup';
import { hasSupabaseAuthCookie } from '@/lib/supabase-session-hint';
import type {
  CharacterReferenceSelection,
  ImageGenerationMode,
  ImageGenerationRequest,
} from '@/types/image-generation';
import type { GroupSummary } from '@/types/groups';
import {
  buildCompletedGroup,
  buildPendingGroup,
} from '../_lib/image-workspace-history';
import {
  buildCustomImageSize,
} from '../_lib/image-workspace-utils';
import {
  formatTemplate,
  type ImageWorkspaceCopy,
} from '../_lib/image-workspace-copy';
import type {
  HistoryEntry,
  ImageEngineOption,
} from '../_lib/image-workspace-types';

interface UseImageGenerationRunnerParams {
  aspectRatio: string | null;
  combinedReferenceUrls: string[];
  customImageHeight: string;
  customImageWidth: string;
  enableWebSearch: boolean;
  hasAspectRatioField: boolean;
  hasEnableWebSearchField: boolean;
  hasLimitGenerationsField: boolean;
  hasMaskUrlField: boolean;
  hasOutputFormatField: boolean;
  hasQualityField: boolean;
  hasSeedField: boolean;
  hasThinkingLevelField: boolean;
  limitGenerations: boolean;
  maskUrl: string;
  mode: ImageGenerationMode;
  mutateJobs: () => Promise<unknown>;
  numImages: number;
  outputFormat: string | null;
  prompt: string;
  quality: string | null;
  readyReferenceSizes: NonNullable<ImageGenerationRequest['referenceImageSizes']>;
  readyReferenceUrls: string[];
  referenceMinRequired: number;
  resolution: string | null;
  resolvedCopy: ImageWorkspaceCopy;
  seed: string;
  selectedCharacterReferences: CharacterReferenceSelection[];
  selectedEngine: ImageEngineOption | undefined;
  setAuthModalOpen: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setLocalHistory: Dispatch<SetStateAction<HistoryEntry[]>>;
  setPendingGroups: Dispatch<SetStateAction<GroupSummary[]>>;
  setSelectedPreviewEntryId: Dispatch<SetStateAction<string | null>>;
  setSelectedPreviewImageIndex: Dispatch<SetStateAction<number>>;
  setStatusMessage: Dispatch<SetStateAction<string | null>>;
  thinkingLevel: string | null;
}

export function useImageGenerationRunner({
  aspectRatio,
  combinedReferenceUrls,
  customImageHeight,
  customImageWidth,
  enableWebSearch,
  hasAspectRatioField,
  hasEnableWebSearchField,
  hasLimitGenerationsField,
  hasMaskUrlField,
  hasOutputFormatField,
  hasQualityField,
  hasSeedField,
  hasThinkingLevelField,
  limitGenerations,
  maskUrl,
  mode,
  mutateJobs,
  numImages,
  outputFormat,
  prompt,
  quality,
  readyReferenceSizes,
  readyReferenceUrls,
  referenceMinRequired,
  resolution,
  resolvedCopy,
  seed,
  selectedCharacterReferences,
  selectedEngine,
  setAuthModalOpen,
  setError,
  setLocalHistory,
  setPendingGroups,
  setSelectedPreviewEntryId,
  setSelectedPreviewImageIndex,
  setStatusMessage,
  thinkingLevel,
}: UseImageGenerationRunnerParams) {
  return useCallback(
    async (event?: FormEvent<HTMLFormElement> | null) => {
      event?.preventDefault();
      if (!selectedEngine) return;
      if (!readLastKnownUserId() && !hasSupabaseAuthCookie()) {
        setAuthModalOpen(true);
        return;
      }
      const session = await readBrowserSession();
      if (!session?.access_token) {
        setAuthModalOpen(true);
        return;
      }
      const trimmedPrompt = prompt.trim();
      if (!trimmedPrompt) {
        setError(resolvedCopy.errors.promptMissing);
        return;
      }
      if (referenceMinRequired > 0 && combinedReferenceUrls.length < referenceMinRequired) {
        setError(resolvedCopy.errors.referenceMissing);
        return;
      }
      const trimmedMaskUrl = hasMaskUrlField ? maskUrl.trim() : '';
      if (trimmedMaskUrl && !/^https?:\/\//i.test(trimmedMaskUrl)) {
        setError('Mask URL must be an absolute http(s) URL.');
        return;
      }
      const customImageSize = resolution === 'custom' ? buildCustomImageSize(customImageWidth, customImageHeight) : null;
      if (resolution === 'custom') {
        const customSizeResult = validateGptImage2CustomImageSize(customImageSize);
        if (!customSizeResult.ok) {
          setError(customSizeResult.message);
          return;
        }
      }
      setError(null);
      setStatusMessage(null);
      const pendingId = `img_${crypto.randomUUID()}`;
      const pendingCreatedAt = Date.now();
      setPendingGroups((prev) => [
        buildPendingGroup({
          id: pendingId,
          engineId: selectedEngine.id,
          engineLabel: selectedEngine.name,
          prompt: trimmedPrompt,
          count: numImages,
          createdAt: pendingCreatedAt,
        }),
        ...prev,
      ]);
      let keepActiveGroup = false;
      try {
        const appliedAspectRatio = hasAspectRatioField
          ? aspectRatio ?? getDefaultAspectRatio(selectedEngine.engineCaps, mode) ?? undefined
          : undefined;
        const normalizedSeed = (() => {
          const trimmed = seed.trim();
          if (!trimmed.length) return undefined;
          const parsed = Number(trimmed);
          return Number.isFinite(parsed) ? Math.round(parsed) : undefined;
        })();
        const response = await runImageGeneration({
          jobId: pendingId,
          engineId: selectedEngine.id,
          mode,
          prompt: trimmedPrompt,
          numImages,
          imageUrls: mode === 'i2i' ? readyReferenceUrls : undefined,
          referenceImageSizes: mode === 'i2i' ? readyReferenceSizes : undefined,
          characterReferences: mode === 'i2i' ? selectedCharacterReferences : undefined,
          aspectRatio: appliedAspectRatio,
          resolution: resolution ?? undefined,
          customImageSize,
          seed: hasSeedField ? normalizedSeed : undefined,
          outputFormat: hasOutputFormatField
            ? ((outputFormat ?? undefined) as 'jpeg' | 'png' | 'webp' | undefined)
            : undefined,
          quality: hasQualityField ? ((quality ?? undefined) as 'low' | 'medium' | 'high' | undefined) : undefined,
          maskUrl: trimmedMaskUrl || undefined,
          enableWebSearch: hasEnableWebSearchField ? enableWebSearch : undefined,
          thinkingLevel: hasThinkingLevelField
            ? ((thinkingLevel ?? undefined) as 'minimal' | 'high' | undefined)
            : undefined,
          limitGenerations: hasLimitGenerationsField ? limitGenerations : undefined,
        });
        const entry: HistoryEntry = {
          id: response.jobId ?? response.requestId ?? crypto.randomUUID(),
          jobId: response.jobId ?? response.requestId ?? null,
          engineId: response.engineId ?? selectedEngine.id,
          engineLabel: response.engineLabel ?? selectedEngine.name,
          mode,
          prompt: trimmedPrompt,
          createdAt: Date.now(),
          description: response.description,
          images: response.images,
          aspectRatio: response.aspectRatio ?? appliedAspectRatio ?? null,
        };
        setLocalHistory((prev) => [entry, ...prev].slice(0, 24));
        setSelectedPreviewEntryId(entry.id);
        setSelectedPreviewImageIndex(0);
        const suffix = response.images.length === 1 ? '' : 's';
        setStatusMessage(
          formatTemplate(resolvedCopy.messages.success, { count: response.images.length, suffix })
        );
        const resolvedGroupId = response.jobId ?? pendingId;
        if (response.images.length > 0) {
          keepActiveGroup = true;
          setPendingGroups((prev) => [
            buildCompletedGroup({
              id: resolvedGroupId,
              engineId: response.engineId ?? selectedEngine.id,
              engineLabel: response.engineLabel ?? selectedEngine.name,
              prompt: trimmedPrompt,
              aspectRatio: response.aspectRatio ?? appliedAspectRatio ?? null,
              images: response.images,
              createdAt: pendingCreatedAt,
              totalPriceCents: response.pricing?.totalCents ?? response.costCents ?? null,
              currency: response.pricing?.currency ?? response.currency ?? null,
            }),
            ...prev.filter((group) => group.id !== pendingId && group.id !== resolvedGroupId),
          ]);
        }
        void mutateJobs();
      } catch (err) {
        setError(err instanceof Error ? err.message : resolvedCopy.errors.generic);
      } finally {
        if (!keepActiveGroup) {
          setPendingGroups((prev) => prev.filter((group) => group.id !== pendingId));
        }
      }
    },
    [
      aspectRatio,
      combinedReferenceUrls,
      customImageHeight,
      customImageWidth,
      enableWebSearch,
      hasAspectRatioField,
      hasEnableWebSearchField,
      hasLimitGenerationsField,
      hasMaskUrlField,
      hasOutputFormatField,
      hasQualityField,
      hasSeedField,
      hasThinkingLevelField,
      limitGenerations,
      maskUrl,
      mode,
      mutateJobs,
      numImages,
      outputFormat,
      prompt,
      quality,
      readyReferenceSizes,
      readyReferenceUrls,
      referenceMinRequired,
      resolution,
      resolvedCopy.errors.generic,
      resolvedCopy.errors.promptMissing,
      resolvedCopy.errors.referenceMissing,
      resolvedCopy.messages.success,
      seed,
      selectedCharacterReferences,
      selectedEngine,
      setAuthModalOpen,
      setError,
      setLocalHistory,
      setPendingGroups,
      setSelectedPreviewEntryId,
      setSelectedPreviewImageIndex,
      setStatusMessage,
      thinkingLevel,
    ]
  );
}
