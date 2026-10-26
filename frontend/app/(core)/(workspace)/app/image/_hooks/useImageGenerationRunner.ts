'use client';

import { useCallback, useLayoutEffect, useRef, type Dispatch, type FormEvent, type SetStateAction } from 'react';
import { NANO21_ENGINE_ID, normalizeNano21Settings } from '@/lib/nano-banana-2-1';
import { runImageGeneration } from '@/lib/api';
import type { PricingSnapshot } from '@maxvideoai/pricing';
import { getDefaultAspectRatio } from '@/lib/image/inputSchema';
import { validateGptImage2CustomImageSize } from '@/lib/image/gptImage2';
import { readLastKnownUserId } from '@/lib/last-known';
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
import { shouldSendImageReferenceUrlsForMode } from '../_lib/image-workspace-generation-request';
import {
  formatTemplate,
  type ImageWorkspaceCopy,
} from '../_lib/image-workspace-copy';
import type {
  HistoryEntry,
  ImageEngineOption,
} from '../_lib/image-workspace-types';

interface UseImageGenerationRunnerParams {
  accountId?: string | null;
  blocked?: boolean;
  aspectRatio: string | null;
  background: string | null;
  combinedReferenceUrls: string[];
  customImageHeight: string;
  customImageWidth: string;
  enableWebSearch: boolean;
  hasAspectRatioField: boolean;
  hasBackgroundField: boolean;
  hasEnableWebSearchField: boolean;
  hasLimitGenerationsField: boolean;
  hasMaskUrlField: boolean;
  hasOutputFormatField: boolean;
  hasQualityField: boolean;
  hasSeedField: boolean;
  hasStyleField: boolean;
  hasThinkingLevelField: boolean;
  hasWatermarkField: boolean;
  limitGenerations: boolean;
  maskUrl: string;
  mode: ImageGenerationMode;
  mutateJobs: () => Promise<unknown>;
  numImages: number;
  outputFormat: string | null;
  prompt: string;
  pricingSnapshot: PricingSnapshot | null;
  quality: string | null;
  readyReferenceSizes: NonNullable<ImageGenerationRequest['referenceImageSizes']>;
  readyReferenceUrls: string[];
  referenceMinRequired: number;
  resolution: string | null;
  resolvedCopy: ImageWorkspaceCopy;
  seed: string;
  selectedCharacterReferences: CharacterReferenceSelection[];
  selectedEngine: ImageEngineOption | undefined;
  style: string | null;
  setAuthModalOpen: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setLocalHistory: Dispatch<SetStateAction<HistoryEntry[]>>;
  setPendingGroups: Dispatch<SetStateAction<GroupSummary[]>>;
  setSelectedPreviewEntryId: Dispatch<SetStateAction<string | null>>;
  setSelectedPreviewImageIndex: Dispatch<SetStateAction<number>>;
  setStatusMessage: Dispatch<SetStateAction<string | null>>;
  thinkingLevel: string | null;
  maxOutputTokens?: number | null;
  watermark: boolean;
}

export function useImageGenerationRunner({
  pricingSnapshot,
  accountId,
  blocked,
  aspectRatio,
  background,
  combinedReferenceUrls,
  customImageHeight,
  customImageWidth,
  enableWebSearch,
  hasAspectRatioField,
  hasBackgroundField,
  hasEnableWebSearchField,
  hasLimitGenerationsField,
  hasMaskUrlField,
  hasOutputFormatField,
  hasQualityField,
  hasSeedField,
  hasStyleField,
  hasThinkingLevelField,
  hasWatermarkField,
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
  style,
  setAuthModalOpen,
  setError,
  setLocalHistory,
  setPendingGroups,
  setSelectedPreviewEntryId,
  setSelectedPreviewImageIndex,
  setStatusMessage,
  thinkingLevel,
  maxOutputTokens,
  watermark,
}: UseImageGenerationRunnerParams) {
  const mounted = useRef(true);
  const activeAccount = useRef(accountId);
  activeAccount.current = accountId;
  const requests = useRef(new Set<AbortController>());
  useLayoutEffect(() => {
    mounted.current = true;
    const activeRequests = requests.current;
    return () => {
      mounted.current = false;
      for (const controller of activeRequests) controller.abort();
      activeRequests.clear();
    };
  }, [accountId]);
  return useCallback(
    async (event?: FormEvent<HTMLFormElement> | null) => {
      event?.preventDefault();
      if (blocked || !selectedEngine) return;
      const startedAccount = accountId;
      if (!readLastKnownUserId() && !hasSupabaseAuthCookie()) {
        setAuthModalOpen(true);
        return;
      }
      const { supabase } = await import('@/lib/supabaseClient');
      const { data } = await supabase.auth.getSession();
      if (!mounted.current || activeAccount.current !== startedAccount) return;
      if (accountId && data.session?.user?.id !== accountId) return;
      if (!data.session?.access_token) {
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
      const controller = new AbortController();
      requests.current.add(controller);
      const isCurrent = () => !controller.signal.aborted && activeAccount.current === startedAccount;
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
        if (selectedEngine.id === NANO21_ENGINE_ID) {
          if (maxOutputTokens === null) throw new Error('Enter a valid output token limit.');
          normalizeNano21Settings({ maxOutputTokens });
        }
        const shouldSendImageUrls = shouldSendImageReferenceUrlsForMode(selectedEngine.engineCaps, mode);
        const response = await runImageGeneration({
          jobId: pendingId,
          engineId: selectedEngine.id,
          mode,
          prompt: trimmedPrompt,
          numImages,
          imageUrls: shouldSendImageUrls ? readyReferenceUrls : undefined,
          referenceImageSizes: shouldSendImageUrls ? readyReferenceSizes : undefined,
          characterReferences: mode === 'i2i' ? selectedCharacterReferences : undefined,
          aspectRatio: appliedAspectRatio,
          resolution: resolution ?? undefined,
          customImageSize,
          seed: hasSeedField ? normalizedSeed : undefined,
          outputFormat: hasOutputFormatField
            ? ((outputFormat ?? undefined) as 'jpeg' | 'png' | 'webp' | undefined)
            : undefined,
          quality: hasQualityField
            ? ((quality ?? undefined) as 'low' | 'medium' | 'high' | 'xhigh' | 'max' | undefined)
            : undefined,
          background: hasBackgroundField
            ? ((background ?? undefined) as 'auto' | 'transparent' | 'opaque' | undefined)
            : undefined,
          style: hasStyleField ? style ?? undefined : undefined,
          maskUrl: trimmedMaskUrl || undefined,
          enableWebSearch: hasEnableWebSearchField ? enableWebSearch : undefined,
          maxOutputTokens: selectedEngine.id === NANO21_ENGINE_ID ? maxOutputTokens ?? undefined : undefined,
          thinkingLevel: hasThinkingLevelField
            ? ((thinkingLevel ?? undefined) as 'minimal' | 'medium' | 'high' | undefined)
            : undefined,
          limitGenerations: hasLimitGenerationsField ? limitGenerations : undefined,
          watermark: hasWatermarkField ? watermark : undefined,
        }, pricingSnapshot, { accessToken: data.session.access_token, signal: controller.signal });
        if (!isCurrent()) return;
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
        if (!isCurrent()) return;
        setError(err instanceof Error ? err.message : resolvedCopy.errors.generic);
      } finally {
        requests.current.delete(controller);
        if (isCurrent() && !keepActiveGroup) {
          setPendingGroups((prev) => prev.filter((group) => group.id !== pendingId));
        }
      }
    },
    [
      accountId,
      blocked,
      aspectRatio,
      background,
      combinedReferenceUrls,
      customImageHeight,
      customImageWidth,
      enableWebSearch,
      hasAspectRatioField,
      hasBackgroundField,
      hasEnableWebSearchField,
      hasLimitGenerationsField,
      hasMaskUrlField,
      hasOutputFormatField,
      hasQualityField,
      hasSeedField,
      hasStyleField,
      hasThinkingLevelField,
      hasWatermarkField,
      limitGenerations,
      maskUrl,
      mode,
      mutateJobs,
      numImages,
      outputFormat,
      prompt,
      pricingSnapshot,
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
      style,
      setAuthModalOpen,
      setError,
      setLocalHistory,
      setPendingGroups,
      setSelectedPreviewEntryId,
      setSelectedPreviewImageIndex,
      setStatusMessage,
      thinkingLevel,
      maxOutputTokens,
      watermark,
    ]
  );
}
