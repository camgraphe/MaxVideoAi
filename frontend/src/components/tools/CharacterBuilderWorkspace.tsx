'use client';

/* eslint-disable @next/next/no-img-element */

import deepmerge from 'deepmerge';
import clsx from 'clsx';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Upload,
} from 'lucide-react';
import { HeaderBar } from '@/components/HeaderBar';
import { AppSidebar } from '@/components/AppSidebar';
import { MediaLightbox, type MediaLightboxEntry } from '@/components/MediaLightbox';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input, Textarea } from '@/components/ui/Input';
import { authFetch } from '@/lib/authFetch';
import { suggestDownloadFilename, triggerAppDownload } from '@/lib/download';
import { useI18n } from '@/lib/i18n/I18nProvider';
import {
  AUTO_TRAIT_KEYS,
  createDefaultCharacterBuilderState,
  getCharacterFormatMultiplier,
  normalizeCharacterFormatMode,
  normalizeTraitsForSourceMode,
} from '@/lib/character-builder';
import { runCharacterBuilderTool, saveImageToLibrary } from '@/lib/api';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { FEATURES } from '@/content/feature-flags';
import type {
  CharacterBuilderAction,
  CharacterBuilderResult,
  CharacterBuilderSettingsSnapshot,
  CharacterBuilderState,
  CharacterBuilderTraitSource,
  CharacterBuilderTraits,
  CharacterBuilderReferenceImage,
} from '@/types/character-builder';
import {
  BuildLookCarouselCard,
  CharacterBuilderStickyDock,
  CharacterReferenceLibraryModal,
  CompactSelectField,
  EmptyResultsRail,
  GENDER_CARD_META,
  HairEditorPanel,
  IconChoiceCard,
  MultiToggleGroup,
  OutputPreviewCard,
  PendingResultCard,
  REALISM_CARD_META,
  ReferenceSlot,
  ResultCard,
  SectionTitle,
  SegmentedControl,
  StyleChoiceCard,
  type BuildLookSectionKey,
} from './character-builder/_components/character-builder-workspace-components';
import { useCharacterBuilderHistoricalResults } from './character-builder/_hooks/useCharacterBuilderHistoricalResults';
import { useCharacterBuilderJobSnapshotLoader } from './character-builder/_hooks/useCharacterBuilderJobSnapshotLoader';
import { useCharacterBuilderOptions } from './character-builder/_hooks/useCharacterBuilderOptions';
import { useCharacterBuilderPersistence } from './character-builder/_hooks/useCharacterBuilderPersistence';
import { useCharacterBuilderPendingRunsSync } from './character-builder/_hooks/useCharacterBuilderPendingRunsSync';
import { DEFAULT_CHARACTER_COPY, type CharacterCopy } from './character-builder/_lib/character-builder-copy';
import {
  buildReferenceImage,
  buildResetCharacterBuilderState,
  countConfiguredSecondaryControls,
  decrementLoadingRequestCount,
  emitClientMetric,
  findChoiceLabel,
  getCharacterBillingProductKey,
  getFlattenedResults,
  getFormatDisplayLabel,
  getHairSummary,
  getLoadingRequestKey,
  getOutfitSummary,
  getRefByRole,
  getResultActionLabel,
  hasCustomOutfitSettings,
  hasCustomHairSettings,
  incrementLoadingRequestCount,
  INITIAL_LOADING_REQUEST_COUNTS,
  isAuthRequiredError,
  normalizeHairAndOutfitModes,
  normalizeTag,
  parseCharacterBuilderSnapshot,
  removeReferenceImage,
  serializeResettableCharacterBuilderState,
  summarizeCustomText,
  updateReferenceImage,
  uploadImage,
} from './character-builder/_lib/character-builder-helpers';
import type {
  BillingProductResponse,
  CharacterLibraryAsset,
  HistoricalCharacterGalleryItem,
  LoadingRequestCounts,
  LoadingRequestKey,
  PendingCharacterRun,
} from './character-builder/_lib/character-builder-types';

export default function CharacterBuilderPage() {
  const { loading: authLoading, user } = useRequireAuth({ redirectIfLoggedOut: false });
  const { t } = useI18n();
  const rawCopy = t('workspace.characterBuilder', DEFAULT_CHARACTER_COPY);
  const copy = useMemo<CharacterCopy>(() => {
    return deepmerge(DEFAULT_CHARACTER_COPY, (rawCopy ?? {}) as Partial<CharacterCopy>);
  }, [rawCopy]);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [state, setState] = useState<CharacterBuilderState>(() => createDefaultCharacterBuilderState());
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [hairOpen, setHairOpen] = useState(false);
  const [activeBuildSection, setActiveBuildSection] = useState<BuildLookSectionKey>('identity');
  const [libraryModalRole, setLibraryModalRole] = useState<CharacterBuilderReferenceImage['role'] | null>(null);
  const [showStyleReferenceSlot, setShowStyleReferenceSlot] = useState(false);
  const [mustRemainDraft, setMustRemainDraft] = useState('');
  const [loadingActions, setLoadingActions] = useState<LoadingRequestCounts>(INITIAL_LOADING_REQUEST_COUNTS);
  const [pendingRuns, setPendingRuns] = useState<PendingCharacterRun[]>([]);
  const [savingResultId, setSavingResultId] = useState<string | null>(null);
  const [lightboxEntry, setLightboxEntry] = useState<MediaLightboxEntry | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const identityFileRef = useRef<HTMLInputElement | null>(null);
  const styleFileRef = useRef<HTMLInputElement | null>(null);
  const resultsScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const resultsSentinelRef = useRef<HTMLDivElement | null>(null);
  const loginRedirectTarget = useMemo(() => {
    const base = pathname || '/app/tools/character-builder';
    const search = searchParams?.toString();
    return search ? `${base}?${search}` : base;
  }, [pathname, searchParams]);
  const openAuthGate = useCallback(() => {
    setAuthModalOpen(true);
  }, []);

  const {
    genderOptions,
    ageOptions,
    skinToneOptions,
    faceCueOptions,
    hairColorOptions,
    hairLengthOptions,
    hairstyleOptions,
    eyeColorOptions,
    bodyBuildOptions,
    outfitOptions,
    realismOptions,
    accessoryOptions,
    distinctiveOptions,
    outputModeOptions,
    consistencyOptions,
    referenceStrengthOptions,
    qualityOptions,
    outputModeLabelOptions,
    qualityLabelOptions,
    formatLabelOptions,
  } = useCharacterBuilderOptions(copy, state.qualityMode);
  const flattenedResults = getFlattenedResults(state.runs);
  const {
    historicalResults,
    historicalHasMore,
    historicalIsFetchingMore,
    historicalJobsLoading,
    loadMoreHistoricalResults,
    mutateHistoricalJobs,
  } = useCharacterBuilderHistoricalResults(flattenedResults);
  const identityReference = getRefByRole(state.referenceImages, 'identity');
  const styleReference = getRefByRole(state.referenceImages, 'style');
  useCharacterBuilderPersistence({
    authLoading,
    hydrated,
    pendingRuns,
    setAdvancedOpen,
    setError,
    setHairOpen,
    setHydrated,
    setLightboxEntry,
    setLoadingActions,
    setMustRemainDraft,
    setPendingRuns,
    setSavingResultId,
    setShowStyleReferenceSlot,
    setState,
    setStatusMessage,
    state,
    styleReference,
    user,
  });
  const hasIdentityReference = Boolean(identityReference);
  const hasCompletedResults = flattenedResults.length > 0;
  const hasResults = hasCompletedResults || pendingRuns.length > 0 || historicalResults.length > 0;
  const secondaryControlsCount = countConfiguredSecondaryControls(state, hasIdentityReference);
  const resetState = useMemo(() => buildResetCharacterBuilderState(state), [state]);
  const canResetBuilder = useMemo(
    () => serializeResettableCharacterBuilderState(state) !== serializeResettableCharacterBuilderState(resetState),
    [resetState, state]
  );
  const hairSummary = getHairSummary(state.traits, { hairColor: hairColorOptions, hairLength: hairLengthOptions, hairstyle: hairstyleOptions }, copy);
  const outfitSummary = getOutfitSummary(state.traits, outfitOptions, copy);
  const accessoriesFeaturesSummary = [
    ...accessoryOptions.filter((option) => state.traits.accessories.includes(option.id)).map((option) => option.label),
    ...distinctiveOptions
      .filter((option) => state.traits.distinctiveFeatures.includes(option.id))
      .map((option) => option.label),
    summarizeCustomText(state.traits.customDetailsDescription),
  ]
    .filter(Boolean)
    .join(' · ');
  const identitySummary = `${findChoiceLabel(genderOptions, state.traits.genderPresentation.value) ?? copy.open} · ${findChoiceLabel(ageOptions, state.traits.ageRange.value) ?? copy.open}`;
  const realismSummary = findChoiceLabel(realismOptions, state.traits.realismStyle) ?? copy.summary.photoreal;
  const jobIdFromQuery = searchParams?.get('job')?.trim() ?? null;
  const billingProductKey = getCharacterBillingProductKey(state.qualityMode);
  useCharacterBuilderPendingRunsSync({
    authLoading,
    hydrated,
    mutateHistoricalJobs,
    pendingRuns,
    setPendingRuns,
    setState,
    user,
  });
  useCharacterBuilderJobSnapshotLoader({
    hydrated,
    jobIdFromQuery,
    loadFromJobDoneMessage: copy.loadFromJobDone,
    setShowStyleReferenceSlot,
    setState,
    setStatusMessage,
  });
  const { data: billingProductData } = useSWR(
    `/api/billing-products?productKey=${encodeURIComponent(billingProductKey)}`,
    async (url: string) => {
      const response = await authFetch(url);
      const payload = (await response.json().catch(() => null)) as BillingProductResponse | null;
      if (!response.ok || !payload?.ok || !payload.product) {
        throw new Error(payload?.error ?? copy.pricingError);
      }
      return payload.product;
    },
    { keepPreviousData: true }
  );
  const estimatedImageCostUsd =
    billingProductData?.unitPriceCents != null
      ? Number(((billingProductData.unitPriceCents * getCharacterFormatMultiplier(state.formatMode, state.qualityMode)) / 100).toFixed(2))
      : null;
  const isActionLoading = (key: LoadingRequestKey): boolean => (loadingActions[key] ?? 0) > 0;

  useEffect(() => {
    const sentinel = resultsSentinelRef.current;
    if (!sentinel || !historicalHasMore) return;

    let previousY = 0;
    let previousRatio = 0;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (
            entry.isIntersecting &&
            (entry.boundingClientRect.y > previousY || entry.intersectionRatio > previousRatio)
          ) {
            loadMoreHistoricalResults();
          }
          previousY = entry.boundingClientRect.y;
          previousRatio = entry.intersectionRatio;
        });
      },
      {
        root: resultsScrollContainerRef.current,
        threshold: 0.2,
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [historicalHasMore, historicalResults.length, loadMoreHistoricalResults]);

  useEffect(() => {
    const scrollContainer = resultsScrollContainerRef.current;
    if (!scrollContainer || !historicalHasMore) return undefined;

    const maybeLoadMore = () => {
      const remainingScroll = scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight;
      if (remainingScroll <= 320) {
        loadMoreHistoricalResults();
      }
    };

    maybeLoadMore();
    scrollContainer.addEventListener('scroll', maybeLoadMore, { passive: true });
    return () => scrollContainer.removeEventListener('scroll', maybeLoadMore);
  }, [historicalHasMore, historicalResults.length, loadMoreHistoricalResults]);

  function updateTrait<K extends keyof Pick<
    CharacterBuilderTraits,
    | 'genderPresentation'
    | 'ageRange'
    | 'skinTone'
    | 'faceCues'
    | 'hairColor'
    | 'hairLength'
    | 'hairstyle'
    | 'eyeColor'
    | 'bodyBuild'
    | 'outfitStyle'
  >>(key: K, value: string | 'auto') {
    setState((previous) => {
      const nextTraits = {
        ...previous.traits,
        [key]: {
          value,
          source: (value === 'auto' ? 'auto' : 'manual') as CharacterBuilderTraitSource,
        },
      } as CharacterBuilderTraits;

      if (key === 'hairColor' || key === 'hairLength' || key === 'hairstyle') {
        nextTraits.hairEnabled = hasCustomHairSettings(nextTraits);
      }

      if (key === 'outfitStyle') {
        nextTraits.outfitEnabled = hasCustomOutfitSettings(nextTraits);
      }

      return {
        ...previous,
        traits: nextTraits,
      };
    });
  }

  function toggleListValue(key: 'accessories' | 'distinctiveFeatures', value: string) {
    setState((previous) => {
      const current = previous.traits[key];
      const nextValues = current.includes(value)
        ? current.filter((entry) => entry !== value)
        : [...current, value];
      return {
        ...previous,
        traits: {
          ...previous.traits,
          [key]: nextValues,
        },
      };
    });
  }

  const handleResetBuilder = useCallback(() => {
    setState(resetState);
    setAdvancedOpen(false);
    setHairOpen(false);
    setActiveBuildSection('identity');
    setShowStyleReferenceSlot(Boolean(getRefByRole(resetState.referenceImages, 'style')));
    setMustRemainDraft('');
    setError(null);
    setStatusMessage(copy.resetDone);
  }, [copy.resetDone, resetState]);

  async function handleUpload(role: CharacterBuilderReferenceImage['role'], file: File) {
    if (!user) {
      openAuthGate();
      return;
    }
    setError(null);
    setStatusMessage(role === 'identity' ? copy.uploadIdentityStart : copy.uploadStyleStart);

    try {
      const asset = await uploadImage(file, copy);
      const nextImage = buildReferenceImage(role, asset);
      if (role === 'style') {
        setShowStyleReferenceSlot(true);
      }
      setState((previous) => ({
        ...previous,
        sourceMode: role === 'identity' ? 'reference-image' : previous.sourceMode,
        referenceStrength:
          role === 'identity'
            ? previous.referenceStrength ?? 'balanced'
            : previous.referenceStrength,
        referenceImages: updateReferenceImage(previous.referenceImages, nextImage),
        traits: role === 'identity' ? normalizeTraitsForSourceMode(previous.traits, 'reference-image') : previous.traits,
      }));
      setStatusMessage(role === 'identity' ? copy.uploadIdentityDone : copy.uploadStyleDone);
    } catch (uploadError) {
      if (isAuthRequiredError(uploadError)) {
        openAuthGate();
        return;
      }
      setError(uploadError instanceof Error ? uploadError.message : copy.uploadFailed);
      setStatusMessage(null);
    }
  }

  async function triggerUpload(role: CharacterBuilderReferenceImage['role'], fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    await handleUpload(role, file);
  }

  function handleLibrarySelect(asset: CharacterLibraryAsset) {
    if (!user) {
      openAuthGate();
      return;
    }
    const role = libraryModalRole;
    if (!role) return;

    const nextImage: CharacterBuilderReferenceImage = {
      id: asset.id,
      url: asset.url,
      role,
      width: asset.width ?? null,
      height: asset.height ?? null,
      name: null,
    };

    if (role === 'style') {
      setShowStyleReferenceSlot(true);
    }

    setState((previous) => ({
      ...previous,
      sourceMode: role === 'identity' ? 'reference-image' : previous.sourceMode,
      referenceStrength:
        role === 'identity'
          ? previous.referenceStrength ?? 'balanced'
          : previous.referenceStrength,
      referenceImages: updateReferenceImage(previous.referenceImages, nextImage),
      traits: role === 'identity' ? normalizeTraitsForSourceMode(previous.traits, 'reference-image') : previous.traits,
    }));
    setLibraryModalRole(null);
    setStatusMessage(role === 'identity' ? copy.uploadIdentityDone : copy.uploadStyleDone);
    setError(null);
  }

  function addMustRemainTag() {
    const tag = normalizeTag(mustRemainDraft);
    if (!tag) return;
    setState((previous) => ({
      ...previous,
      mustRemainVisible: previous.mustRemainVisible.includes(tag)
        ? previous.mustRemainVisible
        : [...previous.mustRemainVisible, tag],
    }));
    setMustRemainDraft('');
  }

  function removeMustRemainTag(tag: string) {
    setState((previous) => ({
      ...previous,
      mustRemainVisible: previous.mustRemainVisible.filter((entry) => entry !== tag),
    }));
  }

  function applySettingsSnapshot(snapshot: CharacterBuilderSettingsSnapshot, selectedId?: string) {
    setState((previous) => ({
      ...previous,
      sourceMode: snapshot.builder.sourceMode,
      referenceImages: snapshot.builder.referenceImages,
      traits: snapshot.builder.traits,
      outputMode: snapshot.builder.outputMode,
      consistencyMode: snapshot.builder.consistencyMode,
      referenceStrength: snapshot.builder.referenceStrength,
      qualityMode: snapshot.builder.qualityMode,
      formatMode: normalizeCharacterFormatMode(snapshot.builder.formatMode, snapshot.builder.qualityMode),
      outputOptions: snapshot.builder.outputOptions,
      advancedNotes: snapshot.builder.advancedNotes,
      mustRemainVisible: snapshot.builder.mustRemainVisible,
      selectedResultId: selectedId ?? previous.selectedResultId,
    }));
    setAdvancedOpen(Boolean(snapshot.builder.advancedNotes));
    setStatusMessage(copy.duplicateDone);
  }

  async function handleRun(action: CharacterBuilderAction, generateCount?: 1 | 4) {
    if (!user) {
      openAuthGate();
      return;
    }
    setError(null);
    setStatusMessage(null);
    const loadingKey = getLoadingRequestKey(action, generateCount);
    const clientJobId =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? `img_${crypto.randomUUID()}`
        : `img_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const requestTraits = normalizeHairAndOutfitModes(state.traits);
    const pendingCreatedAt = new Date().toISOString();
    const pendingRun: PendingCharacterRun = {
      id: clientJobId,
      jobId: clientJobId,
      createdAt: pendingCreatedAt,
      action,
      outputMode: state.outputMode,
      qualityMode: state.qualityMode,
      formatMode: state.formatMode,
      generateCount: generateCount ?? 1,
    };

    setLoadingActions((previous) => incrementLoadingRequestCount(previous, loadingKey));
    setPendingRuns((previous) => [pendingRun, ...previous].slice(0, 12));

    emitClientMetric('tool_start', {
      tool_name: 'character_builder',
      tool_surface: 'workspace',
      logged_in: true,
      action: action.replace(/-/g, '_'),
      source_mode: state.sourceMode,
      output_mode: state.outputMode.replace(/-/g, '_'),
      quality_mode: state.qualityMode,
      format_mode: state.formatMode.replace(/-/g, '_'),
      generate_count: generateCount ?? 1,
    });

    try {
      const response = await runCharacterBuilderTool({
        jobId: clientJobId,
        action,
        sourceMode: state.sourceMode,
        outputMode: state.outputMode,
        consistencyMode: state.consistencyMode,
        referenceStrength: hasIdentityReference ? state.referenceStrength : null,
        qualityMode: state.qualityMode,
        formatMode: state.formatMode,
        referenceImages: state.referenceImages,
        traits: requestTraits,
        outputOptions: state.outputOptions,
        advancedNotes: state.advancedNotes,
        mustRemainVisible: state.mustRemainVisible,
        generateCount: generateCount ?? 1,
        selectedResultId: null,
        selectedResultUrl: null,
        pinnedReferenceResultId: null,
        pinnedReferenceResultUrl: null,
        lineage: {
          parentResultId: null,
          parentRunId: null,
          pinnedReferenceResultId: null,
        },
      });

      if (!response.run) {
        throw new Error(copy.missingRun);
      }

      setPendingRuns((previous) => previous.filter((entry) => entry.id !== clientJobId));
      setState((previous) => {
        const nextRuns = [response.run!, ...previous.runs].slice(0, 12);
        const firstResultId = response.run!.results[0]?.id ?? null;

        return {
          ...previous,
          runs: nextRuns,
          selectedResultId: firstResultId,
          pinnedReferenceResultId: null,
          refinementHistory: previous.refinementHistory,
        };
      });

      setStatusMessage(
        action === 'generate'
          ? generateCount === 4
            ? copy.runGenerateFourDone
            : copy.runGenerateOneDone
          : action === 'full-body-fix'
            ? copy.runFullBodyDone
            : copy.runLightingDone
      );
      emitClientMetric('tool_complete', {
        tool_name: 'character_builder',
        tool_surface: 'workspace',
        logged_in: true,
        action: action.replace(/-/g, '_'),
        source_mode: state.sourceMode,
        output_mode: state.outputMode.replace(/-/g, '_'),
        quality_mode: state.qualityMode,
        format_mode: state.formatMode.replace(/-/g, '_'),
        generate_count: generateCount ?? 1,
        result_count: response.run.results.length,
      });
      void mutateHistoricalJobs(undefined, { revalidate: true });
    } catch (runError) {
      setPendingRuns((previous) => previous.filter((entry) => entry.id !== clientJobId));
      if (isAuthRequiredError(runError)) {
        openAuthGate();
        return;
      }
      setError(runError instanceof Error ? runError.message : copy.runFailed);
    } finally {
      setLoadingActions((previous) => decrementLoadingRequestCount(previous, loadingKey));
    }
  }

  async function handleSaveResult(result: CharacterBuilderResult) {
    if (!user) {
      openAuthGate();
      return;
    }
    setSavingResultId(result.id);
    setError(null);
    setStatusMessage(null);
    try {
      await saveImageToLibrary({
        url: result.url,
        jobId: result.jobId,
        label: copy.generatePanel.portraitTitle,
        source: 'character',
      });
      setStatusMessage(copy.savedToLibrary);
    } catch (saveError) {
      if (isAuthRequiredError(saveError)) {
        openAuthGate();
        return;
      }
      setError(saveError instanceof Error ? saveError.message : copy.saveToLibraryFailed);
    } finally {
      setSavingResultId(null);
    }
  }

  async function handleSaveHistoricalResult(item: HistoricalCharacterGalleryItem) {
    if (!user) {
      openAuthGate();
      return;
    }
    setSavingResultId(item.id);
    setError(null);
    setStatusMessage(null);
    try {
      await saveImageToLibrary({
        url: item.imageUrl,
        jobId: item.jobId,
        label: copy.generatePanel.portraitTitle,
        source: 'character',
      });
      setStatusMessage(copy.savedToLibrary);
    } catch (saveError) {
      if (isAuthRequiredError(saveError)) {
        openAuthGate();
        return;
      }
      setError(saveError instanceof Error ? saveError.message : copy.saveToLibraryFailed);
    } finally {
      setSavingResultId(null);
    }
  }

  async function handleDuplicateHistoricalSettings(item: HistoricalCharacterGalleryItem) {
    if (!user) {
      openAuthGate();
      return;
    }
    setError(null);
    setStatusMessage(null);
    try {
      const response = await authFetch(`/api/jobs/${encodeURIComponent(item.jobId)}`);
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; settingsSnapshot?: unknown; error?: string }
        | null;
      if (!response.ok || !payload?.ok || !payload.settingsSnapshot) {
        throw new Error(payload?.error ?? copy.runFailed);
      }
      const snapshotState = parseCharacterBuilderSnapshot(payload.settingsSnapshot);
      if (!snapshotState) {
        throw new Error(copy.missingRun);
      }
      setState((previous) => ({
        ...previous,
        ...snapshotState,
        selectedResultId: item.id,
      }));
      setAdvancedOpen(Boolean(snapshotState.advancedNotes));
      setShowStyleReferenceSlot(Boolean(snapshotState.referenceImages?.some((image) => image.role === 'style')));
      setStatusMessage(copy.duplicateDone);
    } catch (duplicateError) {
      if (isAuthRequiredError(duplicateError)) {
        openAuthGate();
        return;
      }
      setError(duplicateError instanceof Error ? duplicateError.message : copy.runFailed);
    }
  }

  function renderResultsGallery(variant: 'desktop' | 'mobile') {
    if (!hasResults) {
      return variant === 'desktop' ? <EmptyResultsRail copy={copy} /> : null;
    }
    const itemClassName = variant === 'desktop' ? '' : 'min-w-[280px] shrink-0 snap-start';
    const items = (
      <>
        {pendingRuns.map((pendingRun) => {
          const pendingOutputLabel =
            findChoiceLabel(outputModeLabelOptions, pendingRun.outputMode) ?? copy.generatePanel.portraitTitle;
          const pendingQualityLabel =
            findChoiceLabel(qualityLabelOptions, pendingRun.qualityMode) ?? copy.options.quality.draft.label;
          const pendingFormatLabel = getFormatDisplayLabel(copy, pendingRun.formatMode, pendingRun.qualityMode);
          const subtitle = `${pendingOutputLabel} · ${pendingQualityLabel} · ${pendingFormatLabel}`;
          const badge = pendingRun.generateCount === 4 ? '4x' : null;
          return (
            <div key={pendingRun.id} className={itemClassName}>
              <PendingResultCard
                title={getResultActionLabel(copy, pendingRun.action)}
                subtitle={subtitle}
                badge={badge}
                copy={copy}
              />
            </div>
          );
        })}
        {flattenedResults.map((result) => {
          const run = state.runs.find((entry) => entry.id === result.runId);
          const resultOutputLabel =
            findChoiceLabel(outputModeLabelOptions, result.outputMode) ?? copy.generatePanel.portraitTitle;
          const resultQualityLabel =
            findChoiceLabel(qualityLabelOptions, result.qualityMode) ?? copy.options.quality.draft.label;
          const resultFormatLabel = getFormatDisplayLabel(copy, run?.formatMode ?? 'standard', result.qualityMode);
          const subtitle = `${resultOutputLabel} · ${resultQualityLabel} · ${resultFormatLabel}`;
          const badge = run && run.results.length > 1 ? `${run.results.length}x` : null;

          return (
            <div key={result.id} className={itemClassName}>
              <ResultCard
                result={result}
                selected={state.selectedResultId === result.id}
                title={getResultActionLabel(copy, result.action)}
                subtitle={subtitle}
                badge={badge}
                saving={savingResultId === result.id}
                onOpen={() => {
                  setState((previous) => ({
                    ...previous,
                    selectedResultId: result.id,
                  }));
                  setLightboxEntry({
                    id: result.id,
                    label: getResultActionLabel(copy, result.action),
                    thumbUrl: result.url,
                    mediaType: 'image',
                    status: 'completed',
                    engineLabel: result.engineLabel,
                    createdAt: result.createdAt,
                    jobId: result.jobId,
                    prompt: run?.settingsSnapshot?.prompt ?? null,
                  });
                }}
                onSelect={() =>
                  setState((previous) => ({
                    ...previous,
                    selectedResultId: result.id,
                  }))
                }
                onDownload={() =>
                  triggerAppDownload(
                    result.url,
                    suggestDownloadFilename(result.url, `character-reference-${result.id.replace(/[^a-z0-9]+/gi, '-')}`)
                  )
                }
                onSave={() => void handleSaveResult(result)}
                onDuplicateSettings={() => {
                  if (run?.settingsSnapshot) {
                    applySettingsSnapshot(run.settingsSnapshot, result.id);
                  }
                }}
                copy={copy}
              />
            </div>
          );
        })}
        {historicalResults.map((item) => {
          const createdLabel = (() => {
            try {
              return new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(item.createdAt));
            } catch {
              return item.createdAt;
            }
          })();

          return (
            <div key={item.id} className={itemClassName}>
              <ResultCard
                result={{
                  id: item.id,
                  runId: item.jobId,
                  jobId: item.jobId,
                  url: item.imageUrl,
                  thumbUrl: item.thumbUrl,
                  engineId: '',
                  engineLabel: item.engineLabel,
                  action: 'generate',
                  outputMode: 'portrait-reference',
                  qualityMode: state.qualityMode,
                  createdAt: item.createdAt,
                }}
                selected={state.selectedResultId === item.id}
                title={copy.resultCard.referenceOutput}
                subtitle={`${item.engineLabel} · ${createdLabel}`}
                saving={savingResultId === item.id}
                onOpen={() => {
                  setState((previous) => ({
                    ...previous,
                    selectedResultId: item.id,
                  }));
                  setLightboxEntry({
                    id: item.id,
                    label: copy.resultCard.referenceOutput,
                    thumbUrl: item.imageUrl,
                    mediaType: 'image',
                    status: 'completed',
                    engineLabel: item.engineLabel,
                    createdAt: item.createdAt,
                    jobId: item.jobId,
                    prompt: item.prompt,
                  });
                }}
                onSelect={() =>
                  setState((previous) => ({
                    ...previous,
                    selectedResultId: item.id,
                  }))
                }
                onDownload={() =>
                  triggerAppDownload(
                    item.imageUrl,
                    suggestDownloadFilename(item.imageUrl, `character-reference-${item.id.replace(/[^a-z0-9]+/gi, '-')}`)
                  )
                }
                onSave={() => void handleSaveHistoricalResult(item)}
                onDuplicateSettings={() => void handleDuplicateHistoricalSettings(item)}
                copy={copy}
              />
            </div>
          );
        })}
      </>
    );

    if (variant === 'desktop') {
      return (
        <div className="relative flex-1 min-h-0">
          <div ref={resultsScrollContainerRef} className="scrollbar-rail h-full overflow-y-auto space-y-3 pr-4 pt-1">
            {items}
            {historicalHasMore ? <div ref={resultsSentinelRef} className="h-6" /> : null}
            {historicalIsFetchingMore || historicalJobsLoading ? (
              <div className="flex justify-center py-3 text-xs font-medium text-text-secondary">
                {copy.resultCard.pending}
              </div>
            ) : null}
          </div>
        </div>
      );
    }

    return <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">{items}</div>;
  }

  if (authLoading || !hydrated) {
    return (
      <div className="flex min-h-screen flex-col bg-bg">
        <HeaderBar />
        <div className="flex flex-1 min-w-0 flex-col xl:flex-row">
          <div className="hidden xl:block">
            <AppSidebar />
          </div>
          <main className="flex-1 min-w-0 overflow-y-auto p-5 pb-80 lg:p-7 lg:pb-40 xl:pb-64">
            <div className="space-y-4 animate-pulse">
              <div className="h-40 rounded-card border border-border bg-surface" />
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_360px]">
                <div className="h-[720px] rounded-card border border-border bg-surface" />
                <div className="h-[560px] rounded-card border border-border bg-surface" />
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (!FEATURES.workflows.toolsSection) {
    return (
      <div className="flex min-h-screen flex-col bg-bg">
        <HeaderBar />
        <div className="flex flex-1 min-w-0 flex-col xl:flex-row">
          <div className="hidden xl:block">
            <AppSidebar />
          </div>
          <main className="flex-1 min-w-0 overflow-y-auto p-5 pb-80 lg:p-7 lg:pb-40 xl:pb-64">
            <Card className="border border-border p-6">
              <h1 className="text-2xl font-semibold text-text-primary">{copy.disabledTitle}</h1>
              <p className="mt-2 text-sm text-text-secondary">{copy.disabledBody}</p>
            </Card>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <HeaderBar />
      <div className="flex flex-1 min-w-0 flex-col xl:flex-row">
        <div className="hidden xl:block">
          <AppSidebar />
        </div>
        <main className="flex-1 min-w-0 overflow-y-auto p-5 pb-80 lg:p-7 lg:pb-40 xl:pb-64">
          <div className="mx-auto w-full max-w-[1500px] space-y-6">
            <div>
              <ButtonLink
                href="/app/tools"
                variant="ghost"
                size="sm"
                linkComponent={Link}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                {copy.back}
              </ButtonLink>
            </div>

            {error ? (
              <Card role="alert" className="border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                {error}
              </Card>
            ) : null}
            {statusMessage ? (
              <Card role="status" aria-live="polite" className="border border-border bg-surface p-4 text-sm text-text-secondary">
                {statusMessage}
              </Card>
            ) : null}

            <div className="flex flex-col gap-6 xl:flex-row">
              <div className="min-w-0 flex-1 space-y-6">
                <Card className="overflow-visible border border-border p-6 lg:p-7">
                  <div className="space-y-6">
                    <section className="space-y-4">
                      <SectionTitle title={copy.top.start} />
                      <div className="grid gap-4 md:grid-cols-2 md:items-stretch">
                        <OutputPreviewCard
                          selected={state.outputMode === 'character-sheet'}
                          title={copy.generatePanel.sheetTitle}
                          subtitle={copy.generatePanel.sheetBody}
                          mode="character-sheet"
                          onClick={() =>
                            setState((previous) => ({
                              ...previous,
                              outputMode: 'character-sheet',
                              outputOptions: {
                                ...previous.outputOptions,
                                fullBodyRequired: true,
                              },
                            }))
                          }
                        />
                        <OutputPreviewCard
                          selected={state.outputMode === 'portrait-reference'}
                          title={copy.generatePanel.portraitTitle}
                          subtitle={copy.generatePanel.portraitBody}
                          mode="portrait-reference"
                          onClick={() =>
                            setState((previous) => ({
                              ...previous,
                              outputMode: 'portrait-reference',
                              outputOptions: {
                                ...previous.outputOptions,
                                fullBodyRequired: false,
                              },
                            }))
                          }
                        />
                      </div>

                      <div className="grid gap-4 lg:grid-cols-2">
                        <ReferenceSlot
                          title={copy.references.identityTitle}
                          subtitle={copy.references.identityBody}
                          image={identityReference}
                          onUpload={() => {
                            if (!user) {
                              openAuthGate();
                              return;
                            }
                            identityFileRef.current?.click();
                          }}
                          onOpenLibrary={() => {
                            if (!user) {
                              openAuthGate();
                              return;
                            }
                            setLibraryModalRole('identity');
                          }}
                          removeLabel={copy.references.remove}
                          libraryLabel={copy.library.open}
                          optionalLabel={copy.sections.optional}
                          onRemove={() =>
                            setState((previous) => ({
                              ...previous,
                              sourceMode: previous.sourceMode === 'reference-image' ? 'scratch' : previous.sourceMode,
                              referenceStrength: previous.sourceMode === 'reference-image' ? null : previous.referenceStrength,
                              referenceImages: removeReferenceImage(previous.referenceImages, 'identity'),
                              traits:
                                previous.sourceMode === 'reference-image'
                                  ? normalizeTraitsForSourceMode(previous.traits, 'scratch')
                                  : previous.traits,
                            }))
                          }
                        />
                        {showStyleReferenceSlot || styleReference ? (
                          <ReferenceSlot
                            title={copy.references.styleTitle}
                            subtitle={copy.references.styleBody}
                            image={styleReference}
                            onUpload={() => {
                              if (!user) {
                                openAuthGate();
                                return;
                              }
                              styleFileRef.current?.click();
                            }}
                            onOpenLibrary={() => {
                              if (!user) {
                                openAuthGate();
                                return;
                              }
                              setShowStyleReferenceSlot(true);
                              setLibraryModalRole('style');
                            }}
                            removeLabel={copy.references.remove}
                            libraryLabel={copy.library.open}
                            optionalLabel={copy.sections.optional}
                            onRemove={() => {
                              setShowStyleReferenceSlot(false);
                              setState((previous) => ({
                                ...previous,
                                referenceImages: removeReferenceImage(previous.referenceImages, 'style'),
                              }));
                            }}
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => setShowStyleReferenceSlot(true)}
                            className="flex min-h-[180px] flex-col items-center justify-center rounded-card border border-dashed border-border bg-bg/40 px-4 py-6 text-center transition hover:border-border-hover hover:bg-surface-hover"
                          >
                            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand/10 text-brand">
                              <Upload className="h-5 w-5" />
                            </span>
                            <div className="mt-3 flex items-center justify-center gap-2">
                              <p className="text-sm font-semibold text-text-primary">{copy.references.addInspiration}</p>
                              <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-[10px] font-semibold uppercase tracking-micro text-text-secondary">
                                {copy.sections.optional}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-text-secondary">{copy.references.addInspirationBody}</p>
                          </button>
                        )}
                      </div>
                    </section>

                    <section className="space-y-4 border-t border-border pt-6">
                      <SectionTitle title={copy.top.buildLook}>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleResetBuilder}
                          disabled={!canResetBuilder}
                          className="shrink-0"
                        >
                          {copy.reset}
                        </Button>
                      </SectionTitle>
                      <div className="space-y-4">
                        <div className="overflow-x-auto pb-2">
                          <div className="flex min-w-max overflow-hidden rounded-[24px] border border-border bg-surface shadow-card md:min-w-0 md:w-full">
                            <BuildLookCarouselCard
                              title={copy.sections.gender}
                              summary={identitySummary}
                              active={activeBuildSection === 'identity'}
                              onClick={() => setActiveBuildSection('identity')}
                            />
                            <BuildLookCarouselCard
                              title={copy.sections.hair}
                              summary={hairSummary === copy.notSet ? copy.sections.hairOpenEditor : hairSummary}
                              active={activeBuildSection === 'hair'}
                              onClick={() => setActiveBuildSection('hair')}
                            />
                            <BuildLookCarouselCard
                              title={copy.sections.outfit}
                              summary={outfitSummary === copy.notSet ? copy.open : outfitSummary}
                              active={activeBuildSection === 'outfit'}
                              onClick={() => setActiveBuildSection('outfit')}
                            />
                            <BuildLookCarouselCard
                              title={copy.sections.accessoriesFeatures}
                              summary={accessoriesFeaturesSummary || copy.open}
                              active={activeBuildSection === 'details'}
                              onClick={() => setActiveBuildSection('details')}
                            />
                            <BuildLookCarouselCard
                              title={copy.sections.realism}
                              summary={realismSummary}
                              active={activeBuildSection === 'style'}
                              onClick={() => setActiveBuildSection('style')}
                            />
                          </div>
                        </div>

                        <div className="rounded-[24px] border border-border bg-surface shadow-card p-4 sm:p-5">
                          {activeBuildSection === 'identity' ? (
                            <div className="space-y-4">
                              <div className="grid grid-cols-[repeat(auto-fit,minmax(148px,172px))] justify-center gap-3 xl:justify-start">
                                {genderOptions.map((option) => {
                                  const meta = GENDER_CARD_META[option.id] ?? GENDER_CARD_META.custom;
                                  return (
                                    <IconChoiceCard
                                      key={option.id}
                                      selected={state.traits.genderPresentation.value === option.id}
                                      title={option.label}
                                      glyph={meta.glyph}
                                      background={meta.background}
                                      accent={meta.accent}
                                      onClick={() => updateTrait('genderPresentation', option.id)}
                                    />
                                  );
                                })}
                              </div>

                              <div className="max-w-xl">
                                <SegmentedControl
                                  label={copy.sections.age}
                                  options={ageOptions}
                                  value={state.traits.ageRange.value}
                                  onChange={(value) => updateTrait('ageRange', value)}
                                />
                              </div>

                              {state.traits.genderPresentation.value === 'custom' ? (
                                <Input
                                  value={state.traits.customGenderDescription ?? ''}
                                  onChange={(event) =>
                                    setState((previous) => ({
                                      ...previous,
                                      traits: {
                                        ...previous.traits,
                                        customGenderDescription: event.target.value,
                                      },
                                    }))
                                  }
                                  placeholder={copy.sections.customGenderPlaceholder}
                                />
                              ) : null}
                            </div>
                          ) : null}

                          {activeBuildSection === 'hair' ? (
                            <div className="space-y-4">
                              <div>
                                <p className="text-sm font-semibold text-text-primary">{copy.sections.hair}</p>
                                <p className="mt-1 text-xs text-text-secondary">
                                  {hairSummary === copy.notSet ? copy.sections.hairOpenEditor : hairSummary}
                                </p>
                              </div>

                              <button
                                type="button"
                                onClick={() => setHairOpen((previous) => !previous)}
                                className="flex w-full items-center justify-between gap-4 rounded-[24px] border border-border bg-surface px-4 py-4 text-left transition hover:border-border-hover hover:bg-surface-hover hover:shadow-card"
                              >
                                <div className="flex min-w-0 items-center gap-4">
                                  <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-surface-2/80">
                                    <div className="space-y-1">
                                      <div className="h-2 w-7 rounded-full bg-slate-500" />
                                      <div className="h-2 w-5 rounded-full bg-slate-400" />
                                      <div className="h-2 w-6 rounded-full bg-slate-300" />
                                    </div>
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-sm font-semibold text-text-primary">{copy.sections.hair}</p>
                                    <p className="truncate text-xs text-text-secondary">
                                      {hairSummary === copy.notSet ? copy.sections.hairOpenEditor : hairSummary}
                                    </p>
                                  </div>
                                </div>
                                <span className="rounded-full border border-border bg-surface-2/80 px-3 py-1 text-xs font-semibold text-text-secondary">
                                  {hairOpen ? copy.sections.hairClose : copy.sections.hairEdit}
                                </span>
                              </button>
                              <div className="space-y-2">
                                <label className="block text-sm font-semibold text-text-primary">{copy.sections.customHair}</label>
                                <Textarea
                                  value={state.traits.customHairDescription ?? ''}
                                  onChange={(event) =>
                                    setState((previous) => {
                                      const nextTraits = {
                                        ...previous.traits,
                                        customHairDescription: event.target.value,
                                      };
                                      return {
                                        ...previous,
                                        traits: {
                                          ...nextTraits,
                                          hairEnabled: hasCustomHairSettings(nextTraits),
                                        },
                                      };
                                    })
                                  }
                                  placeholder={copy.sections.customHairPlaceholder}
                                />
                              </div>
                              <HairEditorPanel
                                open={hairOpen}
                                onClose={() => setHairOpen(false)}
                                sourceMode={state.sourceMode}
                                traits={state.traits}
                                onChange={(key, value) => updateTrait(key, value)}
                                hairColorOptions={hairColorOptions}
                                hairLengthOptions={hairLengthOptions}
                                hairstyleOptions={hairstyleOptions}
                                copy={copy}
                              />
                            </div>
                          ) : null}

                          {activeBuildSection === 'outfit' ? (
                            <div className="space-y-4">
                              <div>
                                <p className="text-sm font-semibold text-text-primary">{copy.sections.outfit}</p>
                                <p className="mt-1 text-xs text-text-secondary">
                                  {outfitSummary === copy.notSet ? copy.open : outfitSummary}
                                </p>
                              </div>

                              <div className="flex flex-wrap gap-2">
                                {outfitOptions.map((option) => {
                                  const selected = state.traits.outfitStyle.value === option.id;
                                  return (
                                    <button
                                      key={option.id}
                                      type="button"
                                      onClick={() => updateTrait('outfitStyle', selected ? 'auto' : option.id)}
                                      className={clsx(
                                        'rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                                        selected
                                          ? 'border-brand bg-brand text-on-brand'
                                          : 'border-border bg-surface text-text-secondary hover:border-border-hover hover:bg-surface-hover'
                                      )}
                                    >
                                      {option.label}
                                    </button>
                                  );
                                })}
                              </div>
                              <div className="space-y-2">
                                <label className="block text-sm font-semibold text-text-primary">{copy.sections.customOutfit}</label>
                                <Textarea
                                  value={state.traits.customOutfitDescription ?? ''}
                                  onChange={(event) =>
                                    setState((previous) => {
                                      const nextTraits = {
                                        ...previous.traits,
                                        customOutfitDescription: event.target.value,
                                      };
                                      return {
                                        ...previous,
                                        traits: {
                                          ...nextTraits,
                                          outfitEnabled: hasCustomOutfitSettings(nextTraits),
                                        },
                                      };
                                    })
                                  }
                                  placeholder={copy.sections.customOutfitPlaceholder}
                                />
                              </div>
                            </div>
                          ) : null}

                          {activeBuildSection === 'style' ? (
                            <div className="grid grid-cols-[repeat(auto-fit,minmax(148px,172px))] justify-center gap-3 xl:justify-start">
                              {realismOptions.map((option) => {
                                const meta = REALISM_CARD_META[option.id];
                                return (
                                  <StyleChoiceCard
                                    key={option.id}
                                    selected={state.traits.realismStyle === option.id}
                                    title={option.label}
                                    background={meta.background}
                                    accent={meta.accent}
                                    onClick={() =>
                                      setState((previous) => ({
                                        ...previous,
                                        traits: {
                                          ...previous.traits,
                                          realismStyle: option.id,
                                        },
                                      }))
                                    }
                                  />
                                );
                              })}
                            </div>
                          ) : null}

                          {activeBuildSection === 'details' ? (
                            <div className="space-y-4">
                              <div>
                                <p className="text-sm font-semibold text-text-primary">{copy.sections.accessoriesFeatures}</p>
                                <p className="mt-1 text-xs text-text-secondary">
                                  {accessoriesFeaturesSummary || copy.open}
                                </p>
                              </div>
                              <MultiToggleGroup
                                label={copy.sections.accessories}
                                items={accessoryOptions}
                                values={state.traits.accessories}
                                onToggle={(value) => toggleListValue('accessories', value)}
                              />
                              <MultiToggleGroup
                                label={copy.sections.distinctiveFeatures}
                                items={distinctiveOptions}
                                values={state.traits.distinctiveFeatures}
                                onToggle={(value) => toggleListValue('distinctiveFeatures', value)}
                              />
                              <div className="space-y-2">
                                <label className="block text-sm font-semibold text-text-primary">{copy.sections.customDetails}</label>
                                <Textarea
                                  value={state.traits.customDetailsDescription ?? ''}
                                  onChange={(event) =>
                                    setState((previous) => ({
                                      ...previous,
                                      traits: {
                                        ...previous.traits,
                                        customDetailsDescription: event.target.value,
                                      },
                                    }))
                                  }
                                  placeholder={copy.sections.customDetailsPlaceholder}
                                />
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setAdvancedOpen((previous) => !previous)}
                        className="flex w-full items-center justify-between rounded-[20px] border border-border bg-bg/40 px-4 py-3 text-left transition hover:border-border-hover"
                      >
                        <div>
                          <p className="text-sm font-semibold text-text-primary">{copy.sections.moreControls}</p>
                        </div>
                        <span className="text-xs font-semibold uppercase tracking-micro text-text-muted">
                          {secondaryControlsCount
                            ? copy.sections.setCount.replace('{count}', String(secondaryControlsCount))
                            : copy.sections.optional}
                        </span>
                      </button>

                      {advancedOpen ? (
                        <div className="space-y-5 rounded-card border border-border bg-bg/40 p-4">
                          <div className="grid gap-4 lg:grid-cols-2">
                            <CompactSelectField
                              label={copy.sections.skinTone}
                              value={state.traits.skinTone.value}
                              options={skinToneOptions}
                              onChange={(value) => updateTrait('skinTone', value)}
                              placeholder={copy.choose}
                              autoLabel={copy.auto}
                              autoEnabled={state.sourceMode === 'reference-image' && AUTO_TRAIT_KEYS.has('skinTone')}
                            />
                            <CompactSelectField
                              label={copy.sections.faceCues}
                              value={state.traits.faceCues.value}
                              options={faceCueOptions}
                              onChange={(value) => updateTrait('faceCues', value)}
                              placeholder={copy.choose}
                              autoLabel={copy.auto}
                              autoEnabled={state.sourceMode === 'reference-image' && AUTO_TRAIT_KEYS.has('faceCues')}
                            />
                            <CompactSelectField
                              label={copy.sections.eyeColor}
                              value={state.traits.eyeColor.value}
                              options={eyeColorOptions}
                              onChange={(value) => updateTrait('eyeColor', value)}
                              placeholder={copy.choose}
                              autoLabel={copy.auto}
                              autoEnabled={state.sourceMode === 'reference-image' && AUTO_TRAIT_KEYS.has('eyeColor')}
                            />
                            <CompactSelectField
                              label={copy.sections.bodyBuild}
                              value={state.traits.bodyBuild.value}
                              options={bodyBuildOptions}
                              onChange={(value) => updateTrait('bodyBuild', value)}
                              placeholder={copy.choose}
                              autoLabel={copy.auto}
                              autoEnabled={state.sourceMode === 'reference-image' && AUTO_TRAIT_KEYS.has('bodyBuild')}
                            />
                            <CompactSelectField
                              label={copy.sections.consistency}
                              value={state.consistencyMode}
                              options={consistencyOptions}
                              onChange={(value) =>
                                setState((previous) => ({
                                  ...previous,
                                  consistencyMode: value as CharacterBuilderState['consistencyMode'],
                                }))
                              }
                              placeholder={copy.choose}
                              autoLabel={copy.auto}
                            />
                            {hasIdentityReference ? (
                              <CompactSelectField
                                label={copy.sections.referenceStrength}
                                value={state.referenceStrength}
                                options={referenceStrengthOptions}
                                onChange={(value) =>
                                  setState((previous) => ({
                                    ...previous,
                                    referenceStrength: value as CharacterBuilderState['referenceStrength'],
                                  }))
                                }
                                placeholder={copy.choose}
                                autoLabel={copy.auto}
                              />
                            ) : null}
                          </div>

                          <div className="grid gap-3 md:grid-cols-2">
                            {[
                              ['includeCloseUps', copy.outputOptions.includeCloseUps],
                              ['neutralStudioBackground', copy.outputOptions.neutralStudioBackground],
                              ['preserveFacialDetails', copy.outputOptions.preserveFacialDetails],
                              ['avoid3dRenderLook', copy.outputOptions.avoid3dRenderLook],
                            ].map(([key, label]) => {
                              const typedKey = key as keyof CharacterBuilderState['outputOptions'];
                              const active = state.outputOptions[typedKey];
                              return (
                                <button
                                  key={key}
                                  type="button"
                                  onClick={() =>
                                    setState((previous) => ({
                                      ...previous,
                                      outputOptions: {
                                        ...previous.outputOptions,
                                        [typedKey]: !previous.outputOptions[typedKey],
                                      },
                                    }))
                                  }
                                  className={clsx(
                                    'flex items-center justify-between rounded-card border px-4 py-3 text-left transition',
                                    active
                                      ? 'border-brand bg-brand/10'
                                      : 'border-border bg-surface text-text-secondary hover:border-border-hover hover:bg-surface-hover'
                                  )}
                                >
                                  <span className="text-sm font-semibold text-text-primary">{label}</span>
                                  <span className="text-xs font-semibold uppercase tracking-micro">
                                    {active ? copy.on : copy.off}
                                  </span>
                                </button>
                              );
                            })}
                          </div>

                          <div className="space-y-3">
                            <label className="block text-sm font-semibold text-text-primary">{copy.sections.advancedNotes}</label>
                            <Textarea
                              rows={3}
                              value={state.advancedNotes}
                              onChange={(event) =>
                                setState((previous) => ({
                                  ...previous,
                                  advancedNotes: event.target.value,
                                }))
                              }
                              placeholder={copy.sections.advancedNotesPlaceholder}
                            />
                          </div>

                          <div className="space-y-3">
                            <label className="block text-sm font-semibold text-text-primary">{copy.sections.mustRemainVisible}</label>
                            <div className="flex gap-2">
                              <Input
                                value={mustRemainDraft}
                                onChange={(event) => setMustRemainDraft(event.target.value)}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter') {
                                    event.preventDefault();
                                    addMustRemainTag();
                                  }
                                }}
                                placeholder={copy.sections.mustRemainPlaceholder}
                              />
                              <Button onClick={addMustRemainTag}>{copy.add}</Button>
                            </div>
                            {state.mustRemainVisible.length ? (
                              <div className="flex flex-wrap gap-2">
                                {state.mustRemainVisible.map((tag) => (
                                  <button
                                    key={tag}
                                    type="button"
                                    onClick={() => removeMustRemainTag(tag)}
                                    className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold uppercase tracking-micro text-text-secondary hover:border-border-hover"
                                  >
                                    {tag}
                                  </button>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ) : null}

                      <div className="rounded-[24px] border border-border bg-surface/95 p-4 shadow-card">
                        <CharacterBuilderStickyDock
                          identityReference={identityReference}
                          hairSummary={hairSummary}
                          outfitSummary={outfitSummary}
                          traits={state.traits}
                          outputMode={state.outputMode}
                          qualityMode={state.qualityMode}
                          formatMode={state.formatMode}
                          genderOptions={genderOptions}
                          ageOptions={ageOptions}
                          realismOptions={realismOptions.map((option) => ({ id: option.id, label: option.label }))}
                          outputOptions={outputModeOptions.map((option) => ({ id: option.id, label: option.label }))}
                          qualityOptions={qualityOptions.map((option) => ({ id: option.id, label: option.label }))}
                          formatOptions={formatLabelOptions}
                          estimatedImageCostUsd={estimatedImageCostUsd}
                          onQualityChange={(value) =>
                            setState((previous) => ({
                              ...previous,
                              qualityMode: value,
                              formatMode: normalizeCharacterFormatMode(previous.formatMode, value),
                            }))
                          }
                          onFormatChange={(value) =>
                            setState((previous) => ({
                              ...previous,
                              formatMode: normalizeCharacterFormatMode(value, previous.qualityMode),
                            }))
                          }
                          onGenerateOne={() => void handleRun('generate', 1)}
                          onGenerateFour={() => void handleRun('generate', 4)}
                          loadingGenerateOne={isActionLoading('generate-1')}
                          loadingGenerateFour={isActionLoading('generate-4')}
                          copy={copy}
                        />
                      </div>
                    </section>

                  </div>

                  <input
                    ref={identityFileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => void triggerUpload('identity', event.target.files)}
                  />
                  <input
                    ref={styleFileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => void triggerUpload('style', event.target.files)}
                  />
                </Card>

                {hasResults ? (
                  <Card className="border border-border p-5 xl:hidden">
                    <SectionTitle eyebrow={copy.top.resultsEyebrow} title={copy.top.resultsTitle} />
                    <div className="mt-4">{renderResultsGallery('mobile')}</div>
                  </Card>
                ) : null}
              </div>

              <div className="hidden xl:flex xl:w-[340px] xl:min-h-0 xl:flex-col">
                <div className="sticky top-6 flex h-[calc(100vh-3rem)] min-h-0 w-full flex-col gap-4">
                  <Card className="flex h-full min-h-0 flex-1 flex-col overflow-hidden border border-border p-5">
                    <SectionTitle eyebrow={copy.top.resultsEyebrow} title={copy.top.resultsTitle} />
                    <div className="mt-4 flex min-h-0 flex-1 flex-col">
                      {renderResultsGallery('desktop')}
                    </div>
                  </Card>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
      {lightboxEntry ? (
        <MediaLightbox
          title={copy.top.resultsTitle}
          subtitle={lightboxEntry.engineLabel ?? undefined}
          prompt={lightboxEntry.prompt ?? null}
          entries={[lightboxEntry]}
          onClose={() => setLightboxEntry(null)}
        />
      ) : null}
      <CharacterReferenceLibraryModal
        open={libraryModalRole !== null}
        onClose={() => setLibraryModalRole(null)}
        onSelect={handleLibrarySelect}
        copy={copy}
      />
      {authModalOpen ? (
        <div className="fixed inset-0 z-[10050] flex items-center justify-center bg-surface-on-media-dark-60 px-3 py-6 sm:px-6">
          <div className="absolute inset-0" role="presentation" onClick={() => setAuthModalOpen(false)} />
          <div className="relative z-10 w-full max-w-md rounded-modal border border-border bg-surface p-6 shadow-float">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h2 className="text-base font-semibold text-text-primary">{copy.authGate.title}</h2>
                <p className="mt-2 text-sm text-text-secondary">{copy.authGate.body}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAuthModalOpen(false)}
                className="rounded-full border-hairline bg-surface-glass-80 px-3 py-1.5 text-sm text-text-muted hover:bg-surface-2"
                aria-label={copy.authGate.close}
              >
                {copy.authGate.close}
              </Button>
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <ButtonLink href={`/login?next=${encodeURIComponent(loginRedirectTarget)}`} size="sm" className="px-4">
                {copy.authGate.primary}
              </ButtonLink>
              <ButtonLink
                href={`/login?mode=signin&next=${encodeURIComponent(loginRedirectTarget)}`}
                variant="outline"
                size="sm"
                className="px-4"
              >
                {copy.authGate.secondary}
              </ButtonLink>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
