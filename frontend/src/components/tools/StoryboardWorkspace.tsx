'use client';

/* eslint-disable @next/next/no-img-element */

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Download, ImagePlus, Loader2, Pencil, Save } from 'lucide-react';
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
import type { EngineCaps, EngineInputField } from '@/types/engines';
import type { ImageGenerationResponse } from '@/types/image-generation';
import { DEFAULT_STORYBOARD_COPY } from './storyboard/_lib/storyboard-workspace-copy';
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

type StoryboardTier = 'normal' | 'hq';

const STYLE_OPTIONS: StoryboardStyle[] = ['realistic', 'anime', 'ugc', 'cinema'];
const TARGET_OPTIONS: StoryboardTargetModel[] = ['seedance', 'kling'];
const DURATION_OPTIONS = [6, 10, 15] as const;
const FRAME_COUNT_OPTIONS = [4, 6, 8] as const;
const STORYBOARD_TIER_CONFIG: Record<StoryboardTier, { resolution: string; quality: 'medium' | 'high' }> = {
  normal: { resolution: '1024x768', quality: 'medium' },
  hq: { resolution: '3840x2160', quality: 'high' },
};
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
  inputSchema: { constraints: { supportedFormats: ['png', 'jpg', 'jpeg', 'webp'], maxImageSizeMB: 25 } },
  updatedAt: '2026-06-03',
  ttlSec: 3600,
  availability: 'available',
};

type PriceState = Record<StoryboardTier, { cents: number; currency: string } | null>;

function formatPrice(value: PriceState[StoryboardTier], locale: string): string {
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
  const [targetModel, setTargetModel] = useState<StoryboardTargetModel>('seedance');
  const [style, setStyle] = useState<StoryboardStyle>('cinema');
  const [durationSec, setDurationSec] = useState<number>(10);
  const [frameCount, setFrameCount] = useState<number>(6);
  const [storyboardTier, setStoryboardTier] = useState<StoryboardTier>('normal');
  const [referenceImages, setReferenceImages] = useState<(StoryboardReferenceImage | null)[]>(
    () => Array.from({ length: STORYBOARD_REFERENCE_SLOT_COUNT }, () => null)
  );
  const [editInstruction, setEditInstruction] = useState('');
  const [tierPrices, setTierPrices] = useState<PriceState>({ normal: null, hq: null });
  const [result, setResult] = useState<ImageGenerationResponse | null>(null);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const referenceImagesRef = useRef(referenceImages);

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
        (Object.keys(STORYBOARD_TIER_CONFIG) as StoryboardTier[]).map(async (tier) => {
          const config = STORYBOARD_TIER_CONFIG[tier];
          const response = await authFetch('/api/images/estimate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              engineId: 'gpt-image-2',
              mode: 't2i',
              numImages: 1,
              resolution: config.resolution,
              quality: config.quality,
              source: 'storyboard',
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
      if (active) setTierPrices({ normal: null, hq: null });
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      referenceImagesRef.current.forEach(cleanupStoryboardReferenceImage);
    };
  }, []);

  const selectedImage = result?.images[0] ?? null;
  const tierConfig = STORYBOARD_TIER_CONFIG[storyboardTier];
  const activePrice = useMemo(() => formatPrice(tierPrices[storyboardTier], locale), [locale, storyboardTier, tierPrices]);
  const referenceUploading = referenceImages.some((image) => image?.status === 'uploading');
  const readyReferenceImages = useMemo(
    () => referenceImages.filter((image): image is StoryboardReferenceImage => Boolean(image?.url && image.status === 'ready')),
    [referenceImages]
  );
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
  const canRun = Boolean(subject.trim()) && !running && !referenceUploading;
  const saveLabel = copy.saveToLibrary ?? 'Save to Storyboard library';

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
      const sourceImages = edit && selectedImage ? [selectedImage] : readyReferenceImages;
      const prompt = buildStoryboardPrompt({
        subject,
        action,
        dialogue,
        style,
        targetModel,
        durationSec,
        frameCount,
        referenceImageCount: edit ? 0 : readyReferenceImages.length,
        editInstruction: edit ? editInstruction : null,
      });
      const response = await runImageGeneration({
        jobId: `storyboard_${crypto.randomUUID()}`,
        engineId: 'gpt-image-2',
        mode: sourceImages.length ? 'i2i' : 't2i',
        prompt,
        numImages: 1,
        imageUrls: sourceImages.length ? sourceImages.map((image) => image.url) : undefined,
        referenceImageSizes: sourceImages.length
          ? sourceImages.map((image) => ({ width: image.width ?? null, height: image.height ?? null }))
          : undefined,
        resolution: tierConfig.resolution,
        quality: tierConfig.quality,
        outputFormat: 'png',
        source: 'storyboard',
      });
      setResult(response);
      setMessage(`${copy.outputTitle} · ${activePrice}`);
      if (edit) setEditInstruction('');
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
        jobId: result?.jobId ?? null,
        label: copy.outputTitle,
        source: 'storyboard',
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
          <div className="mx-auto grid w-full max-w-7xl gap-5 xl:grid-cols-[minmax(320px,430px)_minmax(0,1fr)]">
            <section className="space-y-4">
              <ButtonLink href="/app/tools" variant="ghost" size="sm" linkComponent={Link} className="px-0">
                <ArrowLeft className="h-4 w-4" />
                {copy.backToTools}
              </ButtonLink>
              <div>
                <h1 className="text-3xl font-semibold text-text-primary">{copy.title}</h1>
                <p className="mt-2 max-w-xl text-sm text-text-secondary">{copy.subtitle}</p>
              </div>

              <Card className="border border-border bg-surface p-5">
                <div className="space-y-5">
                  <Field label={copy.subjectLabel}>
                    <input
                      value={subject}
                      onChange={(event) => setSubject(event.currentTarget.value)}
                      placeholder={copy.subjectPlaceholder}
                      className="h-11 w-full rounded-input border border-border bg-bg px-3 text-sm text-text-primary outline-none transition focus:border-brand"
                    />
                  </Field>
                  <Field label={copy.actionLabel}>
                    <input
                      value={action}
                      onChange={(event) => setAction(event.currentTarget.value)}
                      placeholder={copy.actionPlaceholder}
                      className="h-11 w-full rounded-input border border-border bg-bg px-3 text-sm text-text-primary outline-none transition focus:border-brand"
                    />
                  </Field>
                  <Field label={copy.dialogueLabel}>
                    <textarea
                      value={dialogue}
                      onChange={(event) => setDialogue(event.currentTarget.value)}
                      placeholder={copy.dialoguePlaceholder}
                      rows={3}
                      className="min-h-[88px] w-full resize-y rounded-input border border-border bg-bg px-3 py-2 text-sm leading-5 text-text-primary outline-none transition placeholder:text-text-muted focus:border-brand"
                    />
                  </Field>

                  <AssetDropzone
                    engine={STORYBOARD_REFERENCE_ENGINE}
                    field={storyboardReferenceField}
                    required={false}
                    role="reference"
                    assets={storyboardReferenceAssets[STORYBOARD_REFERENCE_FIELD.id] ?? []}
                    disabled={running}
                    onSelect={(field, file, slotIndex) => {
                      void handleReferenceFile(field, file, slotIndex);
                    }}
                    onRemove={handleRemoveReferenceSlot}
                    onError={setError}
                  />

	                  <Segmented label={copy.targetLabel}>
                    {TARGET_OPTIONS.map((option) => (
                      <SegmentButton
                        key={option}
                        active={targetModel === option}
                        onClick={() => setTargetModel(option)}
                      >
                        {option === 'seedance' ? copy.targetSeedance : copy.targetKling}
                      </SegmentButton>
                    ))}
                  </Segmented>
                  <p className="rounded-input border border-border bg-bg px-3 py-2 text-xs text-text-secondary">
                    {targetModel === 'seedance' ? copy.targetNotes.seedance : copy.targetNotes.kling}
                  </p>

                  <Segmented label={copy.styleLabel}>
                    {STYLE_OPTIONS.map((option) => (
                      <SegmentButton key={option} active={style === option} onClick={() => setStyle(option)}>
                        {copy.styles[option]}
                      </SegmentButton>
                    ))}
                  </Segmented>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Segmented label={copy.durationLabel}>
                      {DURATION_OPTIONS.map((option) => (
                        <SegmentButton key={option} active={durationSec === option} onClick={() => setDurationSec(option)}>
                          {option}s
                        </SegmentButton>
                      ))}
                    </Segmented>
                    <Segmented label={copy.frameCountLabel}>
                      {FRAME_COUNT_OPTIONS.map((option) => (
                        <SegmentButton key={option} active={frameCount === option} onClick={() => setFrameCount(option)}>
                          {option}
                        </SegmentButton>
                      ))}
                    </Segmented>
                  </div>

                  <Segmented label={copy.tierLabel}>
                    {(Object.keys(STORYBOARD_TIER_CONFIG) as StoryboardTier[]).map((tier) => (
                      <SegmentButton key={tier} active={storyboardTier === tier} onClick={() => setStoryboardTier(tier)}>
                        {tier === 'normal' ? copy.normalTier : copy.hqTier}
                        <span className="text-[10px] opacity-80">{formatPrice(tierPrices[tier], locale)}</span>
                      </SegmentButton>
                    ))}
                  </Segmented>

                  <Button type="button" onClick={() => void runStoryboard(false)} disabled={!canRun} className="w-full">
                    {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                    {running ? copy.generating : `${copy.generate} · ${activePrice}`}
                  </Button>
                  {error ? <p className="text-sm text-error">{error}</p> : null}
                  {message ? <p className="text-sm text-success">{message}</p> : null}
                </div>
              </Card>
            </section>

            <section className="min-w-0">
              <Card className="flex min-h-[620px] flex-col border border-border bg-surface p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{copy.outputTitle}</p>
                    <h2 className="mt-1 text-lg font-semibold text-text-primary">{selectedImage ? result?.engineLabel : copy.emptyTitle}</h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!selectedImage}
                      onClick={() => selectedImage && triggerAppDownload(selectedImage.url, suggestDownloadFilename(selectedImage.url, 'storyboard-reference'))}
                    >
                      <Download className="h-4 w-4" />
                      {copy.download}
                    </Button>
                    <Button type="button" variant="outline" size="sm" disabled={!selectedImage || saving} onClick={() => void saveSelectedImage()}>
                      <Save className="h-4 w-4" />
                      {saving ? copy.generating : saveLabel}
                    </Button>
                  </div>
                </div>

                <div className="flex min-h-[420px] flex-1 items-center justify-center overflow-hidden rounded-card border border-border bg-bg">
                  {selectedImage ? (
                    <img src={selectedImage.url} alt="" className="max-h-[620px] w-full object-contain" />
                  ) : running ? (
                    <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {copy.generating}
                    </div>
                  ) : (
                    <div className="max-w-sm px-6 text-center">
                      <p className="text-sm font-medium text-text-primary">{copy.emptyTitle}</p>
                      <p className="mt-2 text-xs text-text-muted">{copy.emptyBody}</p>
                    </div>
                  )}
                </div>

                {selectedImage ? (
                  <div className="mt-4 rounded-card border border-border bg-bg p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-end">
                      <Field label={copy.editLabel} className="flex-1">
                        <input
                          value={editInstruction}
                          onChange={(event) => setEditInstruction(event.currentTarget.value)}
                          placeholder={copy.editPlaceholder}
                          className="h-10 w-full rounded-input border border-border bg-surface px-3 text-sm text-text-primary outline-none transition focus:border-brand"
                        />
                      </Field>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!editInstruction.trim() || running}
                        onClick={() => void runStoryboard(true)}
                      >
                        {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
                        {copy.editAction}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </Card>
            </section>
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
    </div>
  );
}

function Field({ children, className = '', label }: { children: ReactNode; className?: string; label: string }) {
  return (
    <label className={`block space-y-2 ${className}`}>
      <span className="text-xs font-semibold uppercase tracking-micro text-text-muted">{label}</span>
      {children}
    </label>
  );
}

function Segmented({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function SegmentButton({ active, children, onClick }: { active: boolean; children: ReactNode; onClick: () => void }) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? 'primary' : 'outline'}
      onClick={onClick}
      className="min-h-0 h-9 rounded-full px-3 py-0 text-[11px]"
    >
      {children}
    </Button>
  );
}
