'use client';

/* eslint-disable @next/next/no-img-element */

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Camera, Clapperboard, Film, ImagePlus, Loader2, Sparkles, Smartphone, UserRound } from 'lucide-react';
import { AppSidebar } from '@/components/AppSidebar';
import { AssetDropzone, type AssetSlotAttachment } from '@/components/AssetDropzone';
import { HeaderBar } from '@/components/HeaderBar';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FEATURES } from '@/content/feature-flags';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { runImageGeneration, saveImageToLibrary } from '@/lib/api';
import { authFetch } from '@/lib/authFetch';
import { suggestDownloadFilename, triggerAppDownload } from '@/lib/download';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { STORYBOARD_EDIT_SOURCE, STORYBOARD_SOURCE } from '@/lib/storyboard-pricing';
import type { EngineCaps, EngineInputField } from '@/types/engines';
import type { ImageGenerationResponse } from '@/types/image-generation';
import { StoryboardReferenceLibraryModal } from './storyboard/_components/StoryboardReferenceLibraryModal';
import { StoryboardResultPanel } from './storyboard/_components/StoryboardResultPanel';
import {
  useStoryboardRecentOutputs,
  type StoryboardRecentOutput,
} from './storyboard/_hooks/useStoryboardRecentOutputs';
import { DEFAULT_STORYBOARD_COPY, type StoryboardCopy } from './storyboard/_lib/storyboard-workspace-copy';
import {
  cleanupStoryboardReferenceImage,
  uploadStoryboardReferenceImage,
  type StoryboardReferenceImage,
} from './storyboard/_lib/storyboard-reference-image';
import {
  buildStoryboardPrompt,
  type StoryboardStyle,
  type StoryboardTargetModel,
} from './storyboard/_lib/storyboard-prompt';
import {
  CLOSED_STORYBOARD_LIBRARY_MODAL,
  STORYBOARD_REFERENCE_SUPPORTED_FORMATS,
  createStoryboardReferenceImageFromLibraryAsset,
  resolveStoryboardReferenceLibrarySlotIndex,
  type StoryboardLibraryAsset,
  type StoryboardLibraryModalState,
} from './storyboard/_lib/storyboard-reference-library';
import { buildStoryboardShotPlan } from './storyboard/_lib/storyboard-shot-plan';
import { isStoryboardTargetRecommended, resolveStoryboardRecommendedTarget } from './storyboard/_lib/storyboard-target';
import {
  STORYBOARD_LENGTH_PRESETS,
  STORYBOARD_ORIENTATION_OPTIONS,
  STORYBOARD_TEMPLATE_SIZES,
  STORYBOARD_TIER_OPTIONS,
  getAbsoluteStoryboardTemplateUrl,
  getStoryboardEditOutputConfig,
  getStoryboardOutputConfig,
  getStoryboardLengthPreset,
  getStoryboardTemplatePath,
  type StoryboardLengthPresetId,
  type StoryboardOrientation,
  type StoryboardTier,
} from './storyboard/_lib/storyboard-templates';

type StoryboardOptionalField = 'action' | 'dialogue' | 'visualNotes';

const STYLE_OPTIONS: StoryboardStyle[] = ['realistic', 'anime', 'ugc', 'cinema'];
const TARGET_OPTIONS: StoryboardTargetModel[] = ['seedance', 'kling'];
const STORYBOARD_REFERENCE_SLOT_COUNT = 4;
const STORYBOARD_REFERENCE_FIELD: EngineInputField = {
  id: 'storyboard_reference_images',
  type: 'image',
  label: 'Reference images',
  description: 'Upload character, product, object, packaging, scene or style references.',
  maxCount: STORYBOARD_REFERENCE_SLOT_COUNT,
  minCount: 0,
};
const STORYBOARD_REFERENCE_ENGINE: EngineCaps = {
  id: 'gpt-image-2',
  label: 'GPT Image 2',
  provider: 'OpenAI',
  status: 'live',
  latencyTier: 'standard',
  modes: ['i2i'],
  maxDurationSec: 0,
  resolutions: ['1k'],
  aspectRatios: ['4:3'],
  fps: [],
  audio: false,
  upscale4k: false,
  extend: false,
  motionControls: false,
  keyframes: false,
  params: {},
  inputLimits: { imageMaxMB: 25 },
  inputSchema: { constraints: { supportedFormats: STORYBOARD_REFERENCE_SUPPORTED_FORMATS, maxImageSizeMB: 25 } },
  updatedAt: '2026-06-03',
  ttlSec: 3600,
  availability: 'available',
};

type PriceValue = { cents: number; currency: string } | null;
type PriceState = Record<StoryboardTier, PriceValue>;

function formatPrice(value: PriceValue, locale: string): string {
  if (!value) return '...';
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: value.currency }).format(value.cents / 100);
  } catch {
    return `${value.currency} ${(value.cents / 100).toFixed(2)}`;
  }
}

export default function StoryboardWorkspace() {
  const { loading: authLoading, user } = useRequireAuth({ redirectIfLoggedOut: false });
  const { locale, t } = useI18n();
  const copy = {
    ...DEFAULT_STORYBOARD_COPY,
    ...((t('workspace.storyboard') ?? {}) as Partial<typeof DEFAULT_STORYBOARD_COPY>),
    targetNotes: {
      ...DEFAULT_STORYBOARD_COPY.targetNotes,
      ...(((t('workspace.storyboard') as Partial<typeof DEFAULT_STORYBOARD_COPY> | undefined)?.targetNotes) ?? {}),
    },
    styles: {
      ...DEFAULT_STORYBOARD_COPY.styles,
      ...(((t('workspace.storyboard') as Partial<typeof DEFAULT_STORYBOARD_COPY> | undefined)?.styles) ?? {}),
    },
  };
  const [subject, setSubject] = useState('');
  const [action, setAction] = useState('');
  const [dialogue, setDialogue] = useState('');
  const [visualNotes, setVisualNotes] = useState('');
  const [activeOptionalField, setActiveOptionalField] = useState<StoryboardOptionalField | null>(null);
  const [targetModel, setTargetModel] = useState<StoryboardTargetModel>('seedance');
  const [recognizablePeople, setRecognizablePeople] = useState(false);
  const [style, setStyle] = useState<StoryboardStyle>('cinema');
  const [lengthPresetId, setLengthPresetId] = useState<StoryboardLengthPresetId>('medium');
  const [storyboardOrientation, setStoryboardOrientation] = useState<StoryboardOrientation>('landscape');
  const [storyboardTier, setStoryboardTier] = useState<StoryboardTier>('hd');
  const [referenceImages, setReferenceImages] = useState<(StoryboardReferenceImage | null)[]>(
    () => Array.from({ length: STORYBOARD_REFERENCE_SLOT_COUNT }, () => null)
  );
  const [editInstruction, setEditInstruction] = useState('');
  const [tierPrices, setTierPrices] = useState<PriceState>({ hd: null, '4k': null, ultra: null });
  const [editPrice, setEditPrice] = useState<PriceValue>(null);
  const [result, setResult] = useState<ImageGenerationResponse | null>(null);
  const [previewingTemplate, setPreviewingTemplate] = useState(false);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [libraryModal, setLibraryModal] = useState<StoryboardLibraryModalState>(CLOSED_STORYBOARD_LIBRARY_MODAL);
  const [selectedRecentOutput, setSelectedRecentOutput] = useState<StoryboardRecentOutput | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const referenceImagesRef = useRef(referenceImages);
  const {
    outputs: recentOutputs,
    loading: recentOutputsLoading,
    refresh: refreshRecentOutputs,
  } = useStoryboardRecentOutputs(Boolean(user));

  referenceImagesRef.current = referenceImages;

  useEffect(() => {
    const requestedTarget = new URLSearchParams(window.location.search).get('target');
    if (requestedTarget === 'seedance' || requestedTarget === 'kling') {
      setTargetModel(requestedTarget);
    }
  }, []);

  useEffect(() => {
    let active = true;
    async function loadPrices() {
      const entries = await Promise.all(
        STORYBOARD_TIER_OPTIONS.map(async (tier) => {
          const config = getStoryboardOutputConfig(tier, storyboardOrientation);
          const response = await authFetch('/api/images/estimate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              engineId: 'gpt-image-2',
              mode: 'i2i',
              numImages: 1,
              referenceImageSizes: [STORYBOARD_TEMPLATE_SIZES[storyboardOrientation]],
              resolution: config.resolution,
              customImageSize: config.customImageSize,
              quality: config.quality,
              source: STORYBOARD_SOURCE,
            }),
          });
          const payload = (await response.json().catch(() => null)) as {
            ok?: boolean;
            pricing?: { totalCents?: number; currency?: string };
          } | null;
          return [
            tier,
            payload?.ok && payload.pricing?.totalCents != null
              ? { cents: payload.pricing.totalCents, currency: payload.pricing.currency ?? 'USD' }
              : null,
          ] as const;
        })
      );
      if (!active) return;
      setTierPrices(Object.fromEntries(entries) as PriceState);
    }
    void loadPrices().catch(() => {
      if (active) setTierPrices({ hd: null, '4k': null, ultra: null });
    });
    return () => {
      active = false;
    };
  }, [storyboardOrientation]);

  useEffect(() => {
    return () => {
      referenceImagesRef.current.forEach(cleanupStoryboardReferenceImage);
    };
  }, []);

  const lengthPreset = useMemo(() => getStoryboardLengthPreset(lengthPresetId), [lengthPresetId]);
  const recommendedTarget = useMemo(
    () => resolveStoryboardRecommendedTarget(recognizablePeople),
    [recognizablePeople]
  );
  const durationSec = lengthPreset.durationSec;
  const frameCount = lengthPreset.frameCount;
  const storyboardTemplateSize = STORYBOARD_TEMPLATE_SIZES[storyboardOrientation];
  const templateImagePath = useMemo(
    () => getStoryboardTemplatePath(frameCount, storyboardOrientation),
    [frameCount, storyboardOrientation]
  );
  const generatedImage = result?.images[0] ?? null;
  const selectedRecentImage = selectedRecentOutput
    ? {
        url: selectedRecentOutput.url,
        thumbUrl: selectedRecentOutput.thumbUrl ?? selectedRecentOutput.previewUrl ?? null,
        width: selectedRecentOutput.width,
        height: selectedRecentOutput.height,
        mimeType: selectedRecentOutput.mime,
      }
    : null;
  const selectedImage = previewingTemplate ? null : selectedRecentImage ?? generatedImage;
  const selectedImageJobId = previewingTemplate ? null : selectedRecentOutput?.jobId ?? result?.jobId ?? null;
  const tierConfig = getStoryboardOutputConfig(storyboardTier, storyboardOrientation);
  const editOutputConfig = getStoryboardEditOutputConfig();
  const activePrice = useMemo(() => formatPrice(tierPrices[storyboardTier], locale), [locale, storyboardTier, tierPrices]);
  const editPriceLabel = useMemo(() => formatPrice(editPrice, locale), [editPrice, locale]);
  const referenceUploading = referenceImages.some((image) => image?.status === 'uploading');
  const readyReferenceImages = useMemo(
    () => referenceImages.filter((image): image is StoryboardReferenceImage => Boolean(image?.url && image.status === 'ready')),
    [referenceImages]
  );

  useEffect(() => {
    if (!selectedImage?.url) {
      setEditPrice(null);
      return;
    }

    let active = true;
    const selectedImageWidth = selectedImage.width ?? null;
    const selectedImageHeight = selectedImage.height ?? null;
    async function loadEditPrice() {
      const response = await authFetch('/api/images/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          engineId: 'gpt-image-2',
          mode: 'i2i',
          numImages: 1,
          referenceImageSizes: [{ width: selectedImageWidth, height: selectedImageHeight }],
          resolution: editOutputConfig.resolution,
          customImageSize: editOutputConfig.customImageSize,
          quality: editOutputConfig.quality,
          source: STORYBOARD_EDIT_SOURCE,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        pricing?: { totalCents?: number; currency?: string };
      } | null;
      if (!active) return;
      setEditPrice(
        payload?.ok && payload.pricing?.totalCents != null
          ? { cents: payload.pricing.totalCents, currency: payload.pricing.currency ?? 'USD' }
          : null
      );
    }
    void loadEditPrice().catch(() => {
      if (active) setEditPrice(null);
    });
    return () => {
      active = false;
    };
  }, [
    selectedImage?.height,
    selectedImage?.url,
    selectedImage?.width,
    editOutputConfig.customImageSize,
    editOutputConfig.quality,
    editOutputConfig.resolution,
  ]);

  const storyboardReferenceField = useMemo<EngineInputField>(
    () => ({
      ...STORYBOARD_REFERENCE_FIELD,
      label: copy.referenceImageLabel,
      description: copy.referenceImageBody,
    }),
    [copy.referenceImageBody, copy.referenceImageLabel]
  );
  const storyboardReferenceAssets = useMemo<Record<string, (AssetSlotAttachment | null)[]>>(
    () => ({
      [STORYBOARD_REFERENCE_FIELD.id]: referenceImages.map((image) =>
        image
          ? {
              kind: 'image',
              name: image.name ?? copy.referenceSlotNameFallback,
              size: image.size ?? 0,
              type: image.type ?? 'image/*',
              previewUrl: image.previewUrl,
              status: image.status,
              error: image.error ?? undefined,
            }
          : null
      ),
    }),
    [copy.referenceSlotNameFallback, referenceImages]
  );
  const shotPlan = useMemo(
    () =>
      buildStoryboardShotPlan({
        subject,
        action,
        dialogue,
        style,
        targetModel,
        durationSec,
        frameCount,
        referenceImageCount: readyReferenceImages.length,
      }),
    [action, dialogue, durationSec, frameCount, readyReferenceImages.length, style, subject, targetModel]
  );
  const canRun = Boolean(subject.trim()) && !running && !referenceUploading;
  const saveLabel = copy.saveToLibrary ?? 'Save to Storyboard library';

  function handleRecognizablePeopleToggle() {
    const next = !recognizablePeople;
    setRecognizablePeople(next);
    setTargetModel(resolveStoryboardRecommendedTarget(next));
  }

  async function handleReferenceFile(_field: EngineInputField, file: File, slotIndex = 0) {
    if (!user) {
      setAuthModalOpen(true);
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setError(null);
    setMessage(null);
    setReferenceImages((current) => {
      const next = current.slice();
      cleanupStoryboardReferenceImage(next[slotIndex] ?? null);
      next[slotIndex] = {
        url: previewUrl,
        previewUrl,
        name: file.name,
        size: file.size,
        type: file.type,
        status: 'uploading',
      };
      return next;
    });
    try {
      const uploaded = await uploadStoryboardReferenceImage(file, copy);
      setReferenceImages((current) => {
        const next = current.slice();
        next[slotIndex] = { ...uploaded, previewUrl, size: file.size, type: file.type, status: 'ready' };
        return next;
      });
    } catch (uploadError) {
      const messageText = uploadError instanceof Error ? uploadError.message : copy.uploadFailed;
      setReferenceImages((current) => {
        const next = current.slice();
        next[slotIndex] = {
          url: previewUrl,
          previewUrl,
          name: file.name,
          size: file.size,
          type: file.type,
          status: 'error',
          error: messageText,
        };
        return next;
      });
      setError(messageText);
    }
  }

  function handleRemoveReferenceSlot(_field: EngineInputField, index: number) {
    setReferenceImages((current) => {
      const next = current.slice();
      cleanupStoryboardReferenceImage(next[index] ?? null);
      next[index] = null;
      return next;
    });
  }

  function openReferenceLibrary(_field: EngineInputField, slotIndex = 0) {
    if (!user) {
      setAuthModalOpen(true);
      return;
    }
    setError(null);
    setMessage(null);
    setLibraryModal({
      open: true,
      slotIndex,
      selectionMode: 'reference',
      initialSource: 'all',
    });
  }

  function closeReferenceLibrary() {
    setLibraryModal(CLOSED_STORYBOARD_LIBRARY_MODAL);
  }

  function handleReferenceLibrarySelect(asset: StoryboardLibraryAsset) {
    if (!asset.url) return;
    const slotIndex = resolveStoryboardReferenceLibrarySlotIndex(
      referenceImages,
      libraryModal.slotIndex,
      STORYBOARD_REFERENCE_SLOT_COUNT
    );
    setError(null);
    setMessage(null);
    setReferenceImages((current) => {
      const next = current.slice();
      cleanupStoryboardReferenceImage(next[slotIndex] ?? null);
      next[slotIndex] = createStoryboardReferenceImageFromLibraryAsset(asset, copy.referenceSlotNameFallback);
      return next;
    });
    closeReferenceLibrary();
  }

  function handleSelectRecentOutput(output: StoryboardRecentOutput) {
    setPreviewingTemplate(false);
    setSelectedRecentOutput(output);
    setError(null);
    setMessage(null);
  }

  function showTemplatePreview() {
    setPreviewingTemplate(true);
    setSelectedRecentOutput(null);
    setEditInstruction('');
    setError(null);
    setMessage(null);
  }

  function handleLengthPresetSelect(presetId: StoryboardLengthPresetId) {
    setLengthPresetId(presetId);
    showTemplatePreview();
  }

  function handleOrientationSelect(orientation: StoryboardOrientation) {
    setStoryboardOrientation(orientation);
    showTemplatePreview();
  }

  async function runStoryboard(edit = false) {
    if (!user) {
      setAuthModalOpen(true);
      return;
    }
    if (!subject.trim()) {
      setError(copy.missingSubject);
      return;
    }
    if (edit && !selectedImage?.url) return;

    setRunning(true);
    setError(null);
    setMessage(null);
    try {
      const templateReference = {
        url: getAbsoluteStoryboardTemplateUrl(frameCount, storyboardOrientation, window.location.origin),
        width: storyboardTemplateSize.width,
        height: storyboardTemplateSize.height,
      };
      const sourceImages = edit && selectedImage ? [selectedImage] : [templateReference, ...readyReferenceImages];
      const outputConfig = edit ? editOutputConfig : tierConfig;
      const prompt = buildStoryboardPrompt({
        subject,
        action,
        dialogue,
        visualNotes,
        style,
        targetModel,
        orientation: storyboardOrientation,
        durationSec,
        frameCount,
        templateReference: !edit,
        referenceImageCount: edit ? 0 : readyReferenceImages.length,
        shotPlan,
        editInstruction: edit ? editInstruction : null,
      });
      const response = await runImageGeneration({
        jobId: `storyboard_${crypto.randomUUID()}`,
        engineId: 'gpt-image-2',
        mode: 'i2i',
        prompt,
        numImages: 1,
        imageUrls: sourceImages.map((image) => image.url),
        referenceImageSizes: sourceImages.map((image) => ({ width: image.width ?? null, height: image.height ?? null })),
        resolution: outputConfig.resolution,
        customImageSize: outputConfig.customImageSize,
        quality: outputConfig.quality,
        outputFormat: 'png',
        source: edit ? STORYBOARD_EDIT_SOURCE : STORYBOARD_SOURCE,
      });
      setResult(response);
      setPreviewingTemplate(false);
      setSelectedRecentOutput(null);
      setMessage(`${copy.outputTitle} · ${edit ? editPriceLabel : activePrice}`);
      if (edit) setEditInstruction('');
      void refreshRecentOutputs();
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : copy.generationFailed);
    } finally {
      setRunning(false);
    }
  }

  async function saveSelectedImage() {
    if (!selectedImage?.url) return;
    if (!user) {
      setAuthModalOpen(true);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveImageToLibrary({
        url: selectedImage.url,
        jobId: selectedImageJobId,
        label: copy.outputTitle,
        source: STORYBOARD_SOURCE,
      });
      setMessage(copy.savedToLibrary);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : copy.generationFailed);
    } finally {
      setSaving(false);
    }
  }

  if (authLoading) {
    return (
      <div className="flex min-h-screen flex-col bg-bg">
        <HeaderBar />
        <div className="flex flex-1 min-w-0 flex-col md:flex-row">
          <AppSidebar />
          <main className="flex-1 p-5 lg:p-7">
            <div className="h-96 animate-pulse rounded-card border border-border bg-surface" />
          </main>
        </div>
      </div>
    );
  }

  if (!FEATURES.workflows.toolsSection) {
    return (
      <div className="flex min-h-screen flex-col bg-bg">
        <HeaderBar />
        <div className="flex flex-1 min-w-0 flex-col md:flex-row">
          <AppSidebar />
          <main className="flex-1 p-5 lg:p-7">
            <Card className="border border-border bg-surface p-6">
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
      <div className="flex flex-1 min-w-0 flex-col md:flex-row">
        <AppSidebar />
        <main className="flex-1 min-w-0 overflow-y-auto p-5 lg:p-7">
          <div className="mx-auto w-full max-w-[1540px]">
            <div className="mb-4 max-w-xl">
              <ButtonLink href="/app/tools" variant="ghost" size="sm" linkComponent={Link} className="px-0">
                <ArrowLeft className="h-4 w-4" />
                {copy.backToTools}
              </ButtonLink>
              <div className="mt-4">
                <h1 className="text-3xl font-semibold text-text-primary">{copy.title}</h1>
                <p className="mt-2 max-w-xl text-sm text-text-secondary">{copy.subtitle}</p>
              </div>
            </div>

            <div className="grid gap-5 xl:grid-cols-[minmax(360px,520px)_minmax(0,1fr)]">
              <section>
              <div className="rounded-[16px] border border-border bg-surface p-3.5 shadow-card">
                <div className="space-y-3.5">
                  <BuilderStep number={1} title={copy.subjectStepTitle}>
                    <label className="relative block">
                      <span className="sr-only">{copy.subjectLabel}</span>
                      <textarea
                        value={subject}
                        onChange={(event) => setSubject(event.currentTarget.value)}
                        placeholder={copy.subjectPlaceholder}
                        rows={2}
                        className="min-h-[72px] w-full resize-y rounded-[12px] border border-border bg-bg px-4 py-2.5 pr-10 text-sm leading-5 text-text-primary outline-none transition placeholder:text-text-muted focus:border-text-primary"
                      />
                      <Sparkles className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-text-muted" />
                    </label>
                    <div className="space-y-2">
                      <div className="grid gap-2 sm:grid-cols-3">
                        <OptionalPromptButton
                          active={activeOptionalField === 'action'}
                          filled={Boolean(action.trim())}
                          label={copy.actionLabel}
                          onClick={() => setActiveOptionalField((current) => (current === 'action' ? null : 'action'))}
                        />
                        <OptionalPromptButton
                          active={activeOptionalField === 'dialogue'}
                          filled={Boolean(dialogue.trim())}
                          label={copy.dialogueLabel}
                          onClick={() => setActiveOptionalField((current) => (current === 'dialogue' ? null : 'dialogue'))}
                        />
                        <OptionalPromptButton
                          active={activeOptionalField === 'visualNotes'}
                          filled={Boolean(visualNotes.trim())}
                          label={copy.visualNotesLabel}
                          onClick={() =>
                            setActiveOptionalField((current) => (current === 'visualNotes' ? null : 'visualNotes'))
                          }
                        />
                      </div>
                      {activeOptionalField === 'action' ? (
                        <label className="block">
                          <span className="sr-only">{copy.actionLabel}</span>
                          <textarea
                            autoFocus
                            value={action}
                            onChange={(event) => setAction(event.currentTarget.value)}
                            placeholder={copy.actionPlaceholder}
                            rows={3}
                            className="min-h-[76px] w-full resize-y rounded-[10px] border border-border bg-bg px-3 py-2 text-sm leading-5 text-text-primary outline-none transition placeholder:text-text-muted focus:border-text-primary"
                          />
                        </label>
                      ) : null}
                      {activeOptionalField === 'dialogue' ? (
                        <label className="block">
                          <span className="sr-only">{copy.dialogueLabel}</span>
                          <textarea
                            autoFocus
                            value={dialogue}
                            onChange={(event) => setDialogue(event.currentTarget.value)}
                            placeholder={copy.dialoguePlaceholder}
                            rows={3}
                            className="min-h-[76px] w-full resize-y rounded-[10px] border border-border bg-bg px-3 py-2 text-sm leading-5 text-text-primary outline-none transition placeholder:text-text-muted focus:border-text-primary"
                          />
                        </label>
                      ) : null}
                      {activeOptionalField === 'visualNotes' ? (
                        <label className="block">
                          <span className="sr-only">{copy.visualNotesLabel}</span>
                          <textarea
                            autoFocus
                            value={visualNotes}
                            onChange={(event) => setVisualNotes(event.currentTarget.value)}
                            placeholder={copy.visualNotesPlaceholder}
                            rows={3}
                            className="min-h-[76px] w-full resize-y rounded-[10px] border border-border bg-bg px-3 py-2 text-sm leading-5 text-text-primary outline-none transition placeholder:text-text-muted focus:border-text-primary"
                          />
                        </label>
                      ) : null}
                    </div>
                  </BuilderStep>

                  <BuilderStep hint={copy.optionalAutoLabel} number={2} title={copy.referenceStepTitle}>
                    <AssetDropzone
                      engine={STORYBOARD_REFERENCE_ENGINE}
                      field={storyboardReferenceField}
                      required={false}
                      role="reference"
                      assets={storyboardReferenceAssets[STORYBOARD_REFERENCE_FIELD.id] ?? []}
                      disabled={running}
                      density="compact"
                      className="[&>div]:rounded-[12px]"
                      onSelect={(field, file, slotIndex) => {
                        void handleReferenceFile(field, file, slotIndex);
                      }}
                      onOpenLibrary={openReferenceLibrary}
                      onRemove={handleRemoveReferenceSlot}
                      onError={setError}
                    />
                  </BuilderStep>

                  <BuilderStep number={3} title={copy.styleStepTitle}>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {STYLE_OPTIONS.map((option) => (
                        <ChoiceButton key={option} active={style === option} onClick={() => setStyle(option)}>
                          <StyleIcon style={option} />
                          {copy.styles[option]}
                        </ChoiceButton>
                      ))}
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{copy.modelStepTitle}</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {TARGET_OPTIONS.map((option) => (
                          <ChoiceButton
                            key={option}
                            active={targetModel === option}
                            className="justify-between px-3"
                            onClick={() => setTargetModel(option)}
                          >
                            <span className="inline-flex min-w-0 items-center gap-2">
                              {option === 'seedance' ? <Film className="h-4 w-4 shrink-0" /> : <Camera className="h-4 w-4 shrink-0" />}
                              <span className="truncate">{option === 'seedance' ? copy.targetSeedance : copy.targetKling}</span>
                            </span>
                            {isStoryboardTargetRecommended(option, recognizablePeople) ? (
                              <span
                                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-micro ${
                                  targetModel === option ? 'bg-on-inverse/15 text-on-inverse' : 'bg-surface-2 text-text-secondary'
                                }`}
                              >
                                {copy.targetRecommendedLabel}
                              </span>
                            ) : null}
                          </ChoiceButton>
                        ))}
                      </div>
                      <button
                        type="button"
                        aria-pressed={recognizablePeople}
                        onClick={handleRecognizablePeopleToggle}
                        className={`flex min-h-[38px] w-full items-center justify-between gap-3 rounded-[10px] border px-3 py-2 text-left text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg ${
                          recognizablePeople
                            ? 'border-text-primary bg-bg text-text-primary'
                            : 'border-border bg-surface text-text-secondary hover:border-border-hover hover:bg-surface-hover hover:text-text-primary'
                        }`}
                      >
                        <span className="inline-flex min-w-0 items-center gap-2">
                          <UserRound className="h-4 w-4 shrink-0" />
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold">{copy.recognizablePeopleLabel}</span>
                            <span className="mt-0.5 block leading-4 text-text-secondary">{copy.recognizablePeopleMeta}</span>
                          </span>
                        </span>
                        <span
                          className={`h-5 w-9 shrink-0 rounded-full border p-0.5 transition ${
                            recognizablePeople ? 'border-text-primary bg-text-primary' : 'border-border bg-surface-2'
                          }`}
                          aria-hidden="true"
                        >
                          <span
                            className={`block h-4 w-4 rounded-full bg-surface shadow-sm transition ${
                              recognizablePeople ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </span>
                      </button>
                      <p className="text-xs leading-5 text-text-secondary">
                        {targetModel === 'seedance'
                          ? copy.targetNotes.seedance
                          : targetModel === recommendedTarget
                            ? copy.targetNotes.kling
                            : copy.targetNotes.klingFallback}
                      </p>
                    </div>
                  </BuilderStep>

                  <BuilderStep number={4} title={copy.lengthStepTitle}>
                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{copy.formatLabel}</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {STORYBOARD_ORIENTATION_OPTIONS.map((option) => (
                          <ChoiceButton
                            key={option}
                            active={storyboardOrientation === option}
                            className="justify-start px-3 py-2 text-left"
                            onClick={() => handleOrientationSelect(option)}
                          >
                            {option === 'landscape' ? <Film className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}
                            <span className="min-w-0">
                              <span className="block truncate">
                                {option === 'landscape' ? copy.landscapeLabel : copy.portraitLabel}
                              </span>
                              <span
                                className={`mt-0.5 block text-xs font-medium ${
                                  storyboardOrientation === option ? 'text-on-inverse/70' : 'text-text-secondary'
                                }`}
                              >
                                {option === 'landscape' ? copy.landscapeMeta : copy.portraitMeta}
                              </span>
                            </span>
                          </ChoiceButton>
                        ))}
                      </div>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {STORYBOARD_LENGTH_PRESETS.map((preset) => (
                        <LengthPresetButton
                          key={preset.id}
                          active={lengthPresetId === preset.id}
                          label={getLengthPresetLabel(copy, preset.id)}
                          meta={getLengthPresetMeta(copy, preset.id)}
                          onClick={() => handleLengthPresetSelect(preset.id)}
                        />
                      ))}
                    </div>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {STORYBOARD_TIER_OPTIONS.map((tier) => (
                        <TierButton
                          key={tier}
                          active={storyboardTier === tier}
                          label={getTierLabel(copy, tier)}
                          price={formatPrice(tierPrices[tier], locale)}
                          onClick={() => setStoryboardTier(tier)}
                        />
                      ))}
                    </div>
                  </BuilderStep>

                  <div className="border-t border-border pt-3">
                    <button
                      type="button"
                      onClick={() => void runStoryboard(false)}
                      disabled={!canRun}
                      className="flex h-11 w-full items-center justify-between rounded-[12px] bg-text-primary px-5 text-sm font-semibold text-on-inverse transition hover:bg-text-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <span className="inline-flex items-center gap-2">
                        {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                        {running ? copy.generating : copy.generate}
                      </span>
                      <span>{activePrice}</span>
                    </button>
                    <p className="mt-2 text-center text-xs text-text-muted">{copy.generationFootnote}</p>
                    {error ? <p className="mt-3 text-sm text-error">{error}</p> : null}
                    {message ? <p className="mt-3 text-sm text-success">{message}</p> : null}
                  </div>
                </div>
              </div>
            </section>

            <StoryboardResultPanel
              activeRecentOutputId={previewingTemplate ? null : selectedRecentOutput?.id ?? null}
              copy={copy}
              durationSec={durationSec}
              editInstruction={editInstruction}
              editPriceLabel={editPriceLabel}
              frameCount={frameCount}
              orientation={storyboardOrientation}
              onApplyEdit={() => void runStoryboard(true)}
              onDownload={() =>
                selectedImage && triggerAppDownload(selectedImage.url, suggestDownloadFilename(selectedImage.url, 'storyboard-reference'))
              }
              onEditInstructionChange={setEditInstruction}
              onSave={() => void saveSelectedImage()}
              onSelectRecentOutput={handleSelectRecentOutput}
              recentOutputs={recentOutputs}
              recentOutputsLoading={recentOutputsLoading}
              result={result}
              running={running}
              saveLabel={saveLabel}
              saving={saving}
              selectedImage={selectedImage}
              templateImagePath={templateImagePath}
            />
            </div>
          </div>
        </main>
      </div>
      {authModalOpen ? (
        <div className="fixed inset-0 z-[10050] flex items-center justify-center bg-surface-on-media-dark-60 px-3 py-6 sm:px-6" role="dialog" aria-modal="true">
          <div className="absolute inset-0" role="presentation" onClick={() => setAuthModalOpen(false)} />
          <div className="relative z-10 w-full max-w-md rounded-modal border border-border bg-surface p-6 shadow-float">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-text-primary">{copy.authTitle}</h2>
                <p className="mt-2 text-sm text-text-secondary">{copy.authBody}</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setAuthModalOpen(false)} aria-label={copy.close}>
                {copy.close}
              </Button>
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <ButtonLink href={`/login?next=${encodeURIComponent('/app/tools/storyboard')}`} size="sm">
                {copy.authPrimary}
              </ButtonLink>
              <ButtonLink href={`/login?mode=signin&next=${encodeURIComponent('/app/tools/storyboard')}`} variant="outline" size="sm">
                {copy.authSecondary}
              </ButtonLink>
            </div>
          </div>
        </div>
      ) : null}
      <StoryboardReferenceLibraryModal
        libraryModal={libraryModal}
        onClose={closeReferenceLibrary}
        onSelect={handleReferenceLibrarySelect}
        toolsEnabled={FEATURES.workflows.toolsSection}
      />
    </div>
  );
}

function BuilderStep({
  children,
  hint,
  number,
  title,
}: {
  children: ReactNode;
  hint?: string;
  number: number;
  title: string;
}) {
  return (
    <div className="grid gap-2 border-t border-border pt-3.5 first:border-t-0 first:pt-0">
      <div className="flex items-center gap-2.5">
        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[11px] font-semibold text-text-secondary">
          {number}
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
          {hint ? <p className="mt-0.5 text-[11px] text-text-muted">{hint}</p> : null}
        </div>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function OptionalPromptButton({
  active,
  filled,
  label,
  onClick,
}: {
  active: boolean;
  filled: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex min-h-[38px] items-center justify-between gap-2 rounded-[10px] border px-3 text-xs font-semibold uppercase tracking-micro transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg ${
        active
          ? 'border-text-primary bg-text-primary text-on-inverse'
          : filled
            ? 'border-text-primary/40 bg-bg text-text-primary'
            : 'border-border bg-surface text-text-secondary hover:border-border-hover hover:bg-surface-hover hover:text-text-primary'
      }`}
    >
      <span className="truncate">{label}</span>
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${filled ? 'bg-current' : 'bg-text-muted/35'}`} />
    </button>
  );
}

function ChoiceButton({
  active,
  children,
  className = '',
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  className?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-[40px] items-center justify-center gap-2 rounded-[10px] border px-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg ${
        active
          ? 'border-text-primary bg-text-primary text-on-inverse'
          : 'border-border bg-surface text-text-primary hover:border-border-hover hover:bg-surface-hover'
      } ${className}`}
    >
      {children}
    </button>
  );
}

function LengthPresetButton({
  active,
  label,
  meta,
  onClick,
}: {
  active: boolean;
  label: string;
  meta: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[10px] border px-3 py-1.5 text-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg ${
        active
          ? 'border-text-primary bg-bg text-text-primary shadow-sm'
          : 'border-border bg-surface text-text-primary hover:border-border-hover hover:bg-surface-hover'
      }`}
    >
      <span className="block text-sm font-semibold">{label}</span>
      <span className="mt-0.5 block text-xs text-text-secondary">{meta}</span>
    </button>
  );
}

function TierButton({
  active,
  label,
  onClick,
  price,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  price: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[46px] items-center justify-between gap-3 rounded-[10px] border px-3 py-1.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg ${
        active
          ? 'border-text-primary bg-text-primary text-on-inverse'
          : 'border-border bg-surface text-text-primary hover:border-border-hover hover:bg-surface-hover'
      }`}
    >
      <span className="text-sm font-semibold">{label}</span>
      <span className="text-sm font-semibold">{price}</span>
    </button>
  );
}

function StyleIcon({ style }: { style: StoryboardStyle }) {
  if (style === 'realistic') return <Camera className="h-4 w-4" />;
  if (style === 'ugc') return <Smartphone className="h-4 w-4" />;
  if (style === 'anime') return <Sparkles className="h-4 w-4" />;
  return <Clapperboard className="h-4 w-4" />;
}

function getLengthPresetLabel(copy: StoryboardCopy, presetId: StoryboardLengthPresetId) {
  if (presetId === 'short') return copy.shortPreset;
  if (presetId === 'long') return copy.longPreset;
  return copy.mediumPreset;
}

function getLengthPresetMeta(copy: StoryboardCopy, presetId: StoryboardLengthPresetId) {
  if (presetId === 'short') return copy.shortPresetMeta;
  if (presetId === 'long') return copy.longPresetMeta;
  return copy.mediumPresetMeta;
}

function getTierLabel(copy: StoryboardCopy, tier: StoryboardTier) {
  if (tier === '4k') return copy.fourKTier;
  if (tier === 'ultra') return copy.ultraTier;
  return copy.hdTier;
}
