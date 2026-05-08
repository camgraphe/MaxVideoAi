'use client';

/* eslint-disable @next/next/no-img-element */

import deepmerge from 'deepmerge';
import clsx from 'clsx';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent as ReactClipboardEvent,
  type DragEvent as ReactDragEvent,
} from 'react';
import { ArrowLeft, Images, Loader2, Upload, WandSparkles, X } from 'lucide-react';
import { HeaderBar } from '@/components/HeaderBar';
import { AppSidebar } from '@/components/AppSidebar';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { saveImageToLibrary, useInfiniteJobs } from '@/lib/api';
import { authFetch } from '@/lib/authFetch';
import { suggestDownloadFilename, triggerAppDownload } from '@/lib/download';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { resolveAngleEngineForParams } from '@/lib/tools-angle';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { FEATURES } from '@/content/feature-flags';
import type { AngleToolEngineId, AngleToolNumericParams, AngleToolResponse } from '@/types/tools-angle';
import { AngleAuthGateModal } from './angle/_components/angle-auth-gate-modal';
import { AngleImageLibraryModal } from './angle/_components/angle-image-library-modal';
import { AngleOrbitSelector } from './angle/_components/angle-orbit-selector';
import { AngleOutputMosaic } from './angle/_components/angle-output-mosaic';
import { AngleRecentJobModal } from './angle/_components/angle-recent-job-modal';
import { useAngleGenerationRunner } from './angle/_hooks/useAngleGenerationRunner';
import { DEFAULT_ANGLE_COPY, type AngleCopy } from './angle/_lib/angle-workspace-copy';
import {
  ANGLE_GUEST_EXAMPLE_OUTPUT_URL,
  ANGLE_GUEST_EXAMPLE_SOURCE_URL,
  ANGLE_TOOL_STORAGE_KEY,
  cleanupSourcePreview,
  collectAnglePreviewImages,
  DEFAULT_ENGINE_ID,
  ENGINES,
  formatUsdCompact,
  getAngleBillingProductKey,
  isAuthRequiredError,
  parsePersistedAngleToolState,
  sanitizeParams,
  uploadImage,
} from './angle/_lib/angle-workspace-helpers';
import type {
  BillingProductResponse,
  LibraryAsset,
  PersistedAngleToolState,
  RecentAngleJobEntry,
  UploadedImage,
} from './angle/_lib/angle-workspace-types';

export default function AngleToolPage() {
  const { loading: authLoading, user } = useRequireAuth({ redirectIfLoggedOut: false });
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { locale, t } = useI18n();
  const rawCopy = t('workspace.toolsAngle', DEFAULT_ANGLE_COPY);
  const copy = useMemo<AngleCopy>(() => {
    return deepmerge(DEFAULT_ANGLE_COPY, (rawCopy ?? {}) as Partial<AngleCopy>);
  }, [rawCopy]);
  const hasHydratedStorageRef = useRef(false);
  const [storageHydrated, setStorageHydrated] = useState(false);
  const [engineId, setEngineId] = useState<AngleToolEngineId>(DEFAULT_ENGINE_ID as AngleToolEngineId);
  const [params, setParams] = useState<AngleToolNumericParams>({ rotation: 8, tilt: 2, zoom: 1.2 });
  const [safeMode, setSafeMode] = useState(true);
  const [generateBestAngles, setGenerateBestAngles] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sourceImage, setSourceImage] = useState<UploadedImage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AngleToolResponse | null>(null);
  const [selectedOutputIndex, setSelectedOutputIndex] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [savingOutputUrl, setSavingOutputUrl] = useState<string | null>(null);
  const [sourceDragActive, setSourceDragActive] = useState(false);
  const [libraryModalOpen, setLibraryModalOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [guestExampleDismissed, setGuestExampleDismissed] = useState(false);
  const [activeRecentJobId, setActiveRecentJobId] = useState<string | null>(null);
  const [activeRecentOutputIndex, setActiveRecentOutputIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const visitorSanitizedRef = useRef(false);
  const loginRedirectTarget = useMemo(() => {
    const base = pathname || '/app/tools/angle';
    const search = searchParams?.toString();
    return search ? `${base}?${search}` : base;
  }, [pathname, searchParams]);

  const openAuthGate = useCallback(() => {
    setAuthModalOpen(true);
  }, []);

  const selectedEngine = useMemo(() => ENGINES.find((engine) => engine.id === engineId) ?? ENGINES[0], [engineId]);
  const effectiveEngineId = useMemo(() => resolveAngleEngineForParams(engineId, params), [engineId, params]);
  const negativeTiltActive = params.tilt < 0;
  const tiltFillPercent = useMemo(() => ((params.tilt + 30) / 60) * 100, [params.tilt]);
  const tiltTrackStyle = useMemo(
    () => ({
      background: `linear-gradient(to right, ${
        negativeTiltActive ? '#d97706' : '#0ea5e9'
      } 0%, ${negativeTiltActive ? '#d97706' : '#0ea5e9'} ${tiltFillPercent}%, #d9e0ea ${tiltFillPercent}%, #d9e0ea 100%)`,
    }),
    [negativeTiltActive, tiltFillPercent]
  );
  const billingProductKey = getAngleBillingProductKey(effectiveEngineId, generateBestAngles);

  const { data: billingProductData } = useSWR(
    `/api/billing-products?productKey=${encodeURIComponent(billingProductKey)}`,
    async (url: string) => {
      const response = await authFetch(url);
      const payload = (await response.json().catch(() => null)) as BillingProductResponse | null;
      if (!response.ok || !payload?.ok || !payload.product) {
        throw new Error(payload?.error ?? copy.priceError);
      }
      return payload.product;
    },
    { keepPreviousData: true }
  );

  const estimatedCostUsd = useMemo(() => {
    if (!billingProductData?.unitPriceCents) return 0;
    return Number((billingProductData.unitPriceCents / 100).toFixed(4));
  }, [billingProductData?.unitPriceCents]);

  const selectedOutput = result?.outputs[selectedOutputIndex] ?? null;
  const { stableJobs: angleJobs } = useInfiniteJobs(12, { surface: 'angle' });
  const recentAngleJobs = useMemo<RecentAngleJobEntry[]>(() => {
    const currentJobId = result?.jobId ?? null;
    return angleJobs
      .filter((job) => job.jobId && job.jobId !== currentJobId)
      .map((job) => {
        const outputs = collectAnglePreviewImages(job.renderIds, job.renderThumbUrls, job.thumbUrl ?? null);
        if (!outputs.length) return null;
        return {
          jobId: job.jobId,
          createdAt: job.createdAt,
          engineLabel: job.engineLabel,
          outputs,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
      .slice(0, 8);
  }, [angleJobs, result?.jobId]);
  const activeRecentJob = useMemo(
    () => recentAngleJobs.find((entry) => entry.jobId === activeRecentJobId) ?? null,
    [activeRecentJobId, recentAngleJobs]
  );

  useEffect(() => {
    return () => {
      cleanupSourcePreview(sourceImage);
    };
  }, [sourceImage]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (hasHydratedStorageRef.current) return;
    hasHydratedStorageRef.current = true;
    try {
      const stored = window.localStorage.getItem(ANGLE_TOOL_STORAGE_KEY);
      if (!stored) return;
      const parsed = parsePersistedAngleToolState(stored);
      if (!parsed) return;
      setEngineId(parsed.engineId);
      setParams(parsed.params);
      setSafeMode(parsed.safeMode);
      setGenerateBestAngles(parsed.generateBestAngles);
      setSourceImage(parsed.sourceImage);
      setResult(parsed.result);
      setSelectedOutputIndex(parsed.selectedOutputIndex);
    } catch {
      // ignore storage failures
    } finally {
      setStorageHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!storageHydrated) return;
    const payload: PersistedAngleToolState = {
      version: 1,
      engineId,
      params,
      safeMode,
      generateBestAngles,
      sourceImage: sourceImage
        ? {
            ...sourceImage,
            previewUrl: sourceImage.previewUrl?.startsWith('blob:') ? sourceImage.url : sourceImage.previewUrl ?? sourceImage.url,
          }
        : null,
      result,
      selectedOutputIndex,
    };
    try {
      window.localStorage.setItem(ANGLE_TOOL_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // ignore storage failures
    }
  }, [engineId, generateBestAngles, params, result, safeMode, selectedOutputIndex, sourceImage, storageHydrated]);

  useEffect(() => {
    if (authLoading) return;
    if (user) {
      visitorSanitizedRef.current = false;
      setGuestExampleDismissed(false);
      return;
    }
    if (visitorSanitizedRef.current) return;
    visitorSanitizedRef.current = true;
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(ANGLE_TOOL_STORAGE_KEY);
      } catch {
        // ignore storage failures
      }
    }
    setSourceImage((previous) => {
      cleanupSourcePreview(previous);
      return null;
    });
    setResult(null);
    setSelectedOutputIndex(0);
    setError(null);
  }, [authLoading, user]);

  useEffect(() => {
    if (authLoading || user) return;
    if (guestExampleDismissed) return;
    if (sourceImage?.url) return;
    setSourceImage({
      id: 'guest-example:angle-stage',
      url: ANGLE_GUEST_EXAMPLE_SOURCE_URL,
      previewUrl: ANGLE_GUEST_EXAMPLE_SOURCE_URL,
      width: 640,
      height: 357,
      name: copy.referenceName,
      source: 'example',
    });
  }, [authLoading, user, guestExampleDismissed, sourceImage?.url, copy.referenceName]);

  useEffect(() => {
    if (effectiveEngineId !== engineId) {
      setEngineId(effectiveEngineId);
    }
  }, [effectiveEngineId, engineId]);

  useEffect(() => {
    if (!result?.outputs?.length) {
      if (selectedOutputIndex !== 0) setSelectedOutputIndex(0);
      return;
    }
    if (selectedOutputIndex >= result.outputs.length) {
      setSelectedOutputIndex(0);
    }
  }, [result?.outputs, selectedOutputIndex]);

  useEffect(() => {
    if (!activeRecentJob?.outputs?.length) {
      if (activeRecentOutputIndex !== 0) setActiveRecentOutputIndex(0);
      return;
    }
    if (activeRecentOutputIndex >= activeRecentJob.outputs.length) {
      setActiveRecentOutputIndex(0);
    }
  }, [activeRecentJob?.outputs, activeRecentOutputIndex]);

  const handleParamChange = (key: keyof AngleToolNumericParams) => (event: ChangeEvent<HTMLInputElement>) => {
    const value = Number(event.target.value);
    setParams((previous) => sanitizeParams({ ...previous, [key]: value }));
  };

  const handleSourceFile = async (file: File | null) => {
    if (!file) return;
    if (!user) {
      openAuthGate();
      return;
    }
    const localPreviewUrl = URL.createObjectURL(file);
    setUploading(true);
    setError(null);

    try {
      const uploaded = await uploadImage(file, copy);
      setSourceImage((previous) => {
        cleanupSourcePreview(previous);
        return {
          ...uploaded,
          previewUrl: localPreviewUrl,
          source: 'upload',
        };
      });
      setResult(null);
      setSelectedOutputIndex(0);
    } catch (uploadError) {
      cleanupSourcePreview({ url: '', previewUrl: localPreviewUrl });
      setError(uploadError instanceof Error ? uploadError.message : copy.uploadFailed);
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = '';
    await handleSourceFile(file);
  };

  const handleSourceUrl = (url: string, source: UploadedImage['source']) => {
    const trimmed = url.trim();
    if (!/^https?:\/\//i.test(trimmed)) {
      setError(copy.invalidUrl);
      return;
    }
    setError(null);
    setSourceImage((previous) => {
      cleanupSourcePreview(previous);
      return {
        id: crypto.randomUUID(),
        url: trimmed,
        previewUrl: trimmed,
        name: trimmed.split('/').pop() ?? copy.referenceName,
        source,
      };
    });
    setResult(null);
    setSelectedOutputIndex(0);
  };

  const handleSourceDrop = (event: ReactDragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setSourceDragActive(false);
    const files = event.dataTransfer.files;
    if (files && files.length) {
      void handleSourceFile(files[0]);
      return;
    }
    const uri = event.dataTransfer.getData('text/uri-list') || event.dataTransfer.getData('text/plain');
    if (uri && /^https?:\/\//i.test(uri.trim())) {
      handleSourceUrl(uri, 'paste');
    }
  };

  const handleSourcePaste = (event: ReactClipboardEvent<HTMLDivElement>) => {
    const clipboard = event.clipboardData;
    if (!clipboard) return;
    const items = clipboard.items;
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        event.preventDefault();
        const file = item.getAsFile();
        void handleSourceFile(file);
        return;
      }
    }
    const text = clipboard.getData('text/plain');
    if (text && /^https?:\/\//i.test(text.trim())) {
      event.preventDefault();
      handleSourceUrl(text, 'paste');
    }
  };

  const handleLibrarySelect = (asset: LibraryAsset) => {
    if (!user) {
      openAuthGate();
      return;
    }
    setSourceImage((previous) => {
      cleanupSourcePreview(previous);
      return {
        id: asset.id,
        url: asset.url,
        previewUrl: asset.url,
        width: asset.width,
        height: asset.height,
        name: asset.url.split('/').pop() ?? copy.libraryImageName,
        source: 'library',
      };
    });
    setResult(null);
    setSelectedOutputIndex(0);
    setError(null);
    setLibraryModalOpen(false);
  };

  const handleGenerate = useAngleGenerationRunner({
    copy,
    engineId,
    generateBestAngles,
    openAuthGate,
    params,
    safeMode,
    setError,
    setGenerating,
    setParams,
    setResult,
    setSelectedOutputIndex,
    sourceImage,
    user,
  });

  const handleAddOutputToLibrary = async (url: string, jobId?: string | null) => {
    if (!user) {
      openAuthGate();
      return;
    }
    setSavingOutputUrl(url);
    try {
      await saveImageToLibrary({
        url,
        jobId: jobId ?? result?.jobId ?? result?.requestId ?? result?.providerJobId ?? null,
        label: copy.angleOutputLabel,
        source: 'angle',
      });
    } catch (saveError) {
      if (isAuthRequiredError(saveError)) {
        openAuthGate();
        return;
      }
      setError(saveError instanceof Error ? saveError.message : copy.librarySaveFailed);
    } finally {
      setSavingOutputUrl((current) => (current === url ? null : current));
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen flex-col bg-bg">
        <HeaderBar />
        <div className="flex flex-1 min-w-0 flex-col md:flex-row">
          <AppSidebar />
          <main className="flex-1 min-w-0 overflow-y-auto p-5 lg:p-7">
            <div className="w-full animate-pulse space-y-4 rounded-card border border-border bg-surface p-8">
              <div className="h-4 w-40 rounded bg-surface-2" />
              <div className="h-10 w-72 rounded bg-surface-2" />
              <div className="h-72 rounded bg-surface-2" />
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
        <div className="flex flex-1 min-w-0 flex-col md:flex-row">
          <AppSidebar />
          <main className="flex-1 min-w-0 overflow-y-auto p-5 lg:p-7">
            <div className="w-full rounded-card border border-border bg-surface p-6">
              <h1 className="text-2xl font-semibold text-text-primary">{copy.disabledTitle}</h1>
              <p className="mt-2 text-sm text-text-secondary">{copy.disabledBody}</p>
            </div>
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
          <div className="w-full space-y-6">
            <div>
              <ButtonLink href="/app/tools" variant="outline" linkComponent={Link} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                {copy.back}
              </ButtonLink>
            </div>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
              <Card className="border border-border bg-surface p-5">
                <div className="space-y-5">
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(320px,1.05fr)]">
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{copy.engine}</p>
                        <label className="mt-2 block">
                          <span className="sr-only">{copy.engineSelect}</span>
                          <select
                            value={engineId}
                            onChange={(event) => setEngineId(event.target.value as AngleToolEngineId)}
                            className="w-full rounded-input border border-border bg-bg px-3 py-2 text-sm text-text-primary"
                          >
                            {ENGINES.map((engine) => (
                              <option key={engine.id} value={engine.id}>
                                {copy.engines[engine.id].label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <p className="mt-2 text-xs text-text-muted">{selectedEngine ? copy.engines[selectedEngine.id].description : null}</p>
                        {engineId === 'flux-multiple-angles' ? (
                          <p className="mt-1 text-xs text-text-muted">
                            {copy.engineHelpFlux}
                          </p>
                        ) : null}
                        {engineId === 'qwen-multiple-angles' && params.tilt < 0 ? (
                          <p className="mt-1 text-xs text-warning">{copy.engineHelpQwen}</p>
                        ) : null}
                      </div>

                      <div>
                        <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{copy.sourceImage}</p>
                        <div
                          className={clsx(
                            'mt-2 rounded-card border border-dashed bg-bg p-4 transition',
                            sourceDragActive ? 'border-brand bg-brand/5' : 'border-border'
                          )}
                          onDragOver={(event) => {
                            event.preventDefault();
                            event.dataTransfer.dropEffect = 'copy';
                            setSourceDragActive(true);
                          }}
                          onDragLeave={(event) => {
                            if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
                            setSourceDragActive(false);
                          }}
                          onDrop={handleSourceDrop}
                          onPaste={handleSourcePaste}
                          tabIndex={0}
                        >
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleFileSelect}
                            className="hidden"
                          />
                          {sourceImage?.url ? (
                            <div className="overflow-hidden rounded-card border border-border bg-bg">
                              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3">
                                <div>
                                  <p className="text-sm font-medium text-text-primary">{copy.sourceReady}</p>
                                  <p className="text-xs text-text-muted">
                                    {sourceImage?.width && sourceImage?.height
                                      ? `${sourceImage.width} x ${sourceImage.height}`
                                      : sourceImage.source === 'library'
                                        ? copy.sourceFromLibrary
                                        : sourceImage.source === 'example'
                                          ? copy.sourceFromExample
                                        : sourceImage.source === 'paste'
                                          ? copy.sourceFromPaste
                                          : copy.sourceFromDevice}
                                  </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="gap-2"
                                    onClick={() => {
                                      if (!user) {
                                        openAuthGate();
                                        return;
                                      }
                                      fileInputRef.current?.click();
                                    }}
                                    disabled={uploading}
                                  >
                                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                                    {uploading ? copy.uploading : copy.replace}
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="gap-2"
                                    onClick={() => {
                                      if (!user) {
                                        openAuthGate();
                                        return;
                                      }
                                      setLibraryModalOpen(true);
                                    }}
                                  >
                                    <Images className="h-4 w-4" />
                                    {copy.library}
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="gap-2"
                                    onClick={() => {
                                      setSourceImage((previous) => {
                                        cleanupSourcePreview(previous);
                                        return null;
                                      });
                                      setResult(null);
                                      setSelectedOutputIndex(0);
                                      if (!user) {
                                        setGuestExampleDismissed(true);
                                      }
                                    }}
                                  >
                                    <X className="h-4 w-4" />
                                    {copy.remove}
                                  </Button>
                                </div>
                              </div>
                              <div className="overflow-hidden bg-bg">
                                <img src={sourceImage.url} alt={copy.sourceAlt} className="h-56 w-full object-contain" />
                              </div>
                            </div>
                          ) : (
                            <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 rounded-card border border-dashed border-border bg-bg px-4 text-center">
                              <div>
                                <p className="text-sm font-medium text-text-primary">{copy.addSourceTitle}</p>
                                <p className="mt-1 text-xs text-text-muted">{copy.addSourceBody}</p>
                              </div>
                              <div className="flex flex-wrap justify-center gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="gap-2"
                                  onClick={() => {
                                    if (!user) {
                                      openAuthGate();
                                      return;
                                    }
                                    fileInputRef.current?.click();
                                  }}
                                  disabled={uploading}
                                >
                                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                                  {uploading ? copy.uploading : copy.upload}
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="gap-2"
                                  onClick={() => {
                                    if (!user) {
                                      openAuthGate();
                                      return;
                                    }
                                    setLibraryModalOpen(true);
                                  }}
                                >
                                  <Images className="h-4 w-4" />
                                  {copy.library}
                                </Button>
                              </div>
                              <p className="text-[11px] text-text-muted">{copy.formats}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <AngleOrbitSelector
                      params={params}
                      onParamsChange={setParams}
                      generateBestAngles={generateBestAngles}
                      onGenerateBestAnglesChange={setGenerateBestAngles}
                      supportsMultiOutput={Boolean(selectedEngine?.supportsMultiOutput)}
                      sourceImage={sourceImage}
                      copy={copy}
                    />
                  </div>

                  <div className="space-y-3 rounded-card border border-border bg-bg p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{copy.cameraControls}</p>
                    </div>

                    <label className="block">
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="font-medium text-text-primary">{copy.rotationRange}</span>
                        <span className="text-text-muted">{params.rotation.toFixed(0)} {copy.degreeUnit}</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={360}
                        step={1}
                        value={params.rotation}
                        onChange={handleParamChange('rotation')}
                        className="range-input h-1 w-full appearance-none overflow-hidden rounded-full bg-hairline"
                      />
                    </label>

                    <label className="block">
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="font-medium text-text-primary">{copy.tiltRange}</span>
                        <span className="text-text-muted">{params.tilt.toFixed(0)} {copy.degreeUnit}</span>
                      </div>
                      <input
                        type="range"
                        min={-30}
                        max={30}
                        step={1}
                        value={params.tilt}
                        onChange={handleParamChange('tilt')}
                        className="range-input h-1 w-full appearance-none overflow-hidden rounded-full"
                        style={tiltTrackStyle}
                      />
                    </label>

                    <label className="block">
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="font-medium text-text-primary">{copy.zoomRange}</span>
                        <span className="text-text-muted">{params.zoom.toFixed(1)}</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={10}
                        step={0.1}
                        value={params.zoom}
                        onChange={handleParamChange('zoom')}
                        className="range-input h-1 w-full appearance-none overflow-hidden rounded-full bg-hairline"
                      />
                    </label>
                  </div>

                  <div className="rounded-card border border-border bg-bg p-4">
                    <p className="text-xs uppercase tracking-micro text-text-muted">{copy.estimatedCost}</p>
                    <p className="mt-2 text-2xl font-semibold leading-none text-text-primary">
                      {formatUsdCompact(estimatedCostUsd)}
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant={user ? 'primary' : 'outline'}
                    className="w-full gap-2"
                    onClick={user ? handleGenerate : openAuthGate}
                    disabled={generating || uploading || !sourceImage?.url}
                  >
                    {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}
                    {generating ? copy.generating : user ? copy.generate : copy.generateLocked}
                  </Button>

                  {error ? (
                    <p role="alert" className="text-sm text-error">
                      {error}
                    </p>
                  ) : null}
                </div>
              </Card>

              <Card className="border border-border bg-surface p-5">
                <div className="flex h-full flex-col gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{copy.output}</p>
                    <h2 className="mt-1 text-lg font-semibold text-text-primary">{copy.outputTitle}</h2>
                  </div>

                  {selectedOutput ? (
                    <>
                      <div className="relative">
                        <AngleOutputMosaic
                          outputs={(result?.outputs ?? []).map((output) => ({ url: output.url, thumbUrl: output.thumbUrl ?? output.url }))}
                          selectedIndex={selectedOutputIndex}
                          onSelect={setSelectedOutputIndex}
                          onDownload={(url) => triggerAppDownload(url, suggestDownloadFilename(url, `angle-preview-${Date.now()}`))}
                          onAddToLibrary={(url) => handleAddOutputToLibrary(url)}
                          libraryDisabled={Boolean(selectedOutput?.persisted) || Boolean(savingOutputUrl)}
                          copy={copy}
                        />

                        {generating ? (
                          <div className="absolute inset-0 flex items-center justify-center rounded-card bg-surface-on-media-dark-45 backdrop-blur-[2px]">
                            <div className="rounded-card border border-white/20 bg-surface-on-media-dark-55 px-4 py-3 text-center text-on-inverse shadow-card">
                              <div className="flex items-center justify-center gap-2 text-sm font-medium">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                {copy.generatingOverlayTitle}
                              </div>
                              <p className="mt-1 text-xs text-on-inverse/80">{copy.generatingOverlayBody}</p>
                            </div>
                          </div>
                        ) : null}
                      </div>

                      <div className="rounded-card border border-border bg-bg p-4">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
                          <span>{copy.latency}: {result?.latencyMs ?? 0} ms</span>
                          <span>·</span>
                          <span>{formatUsdCompact(result?.pricing.actualCostUsd ?? result?.pricing.estimatedCostUsd ?? null)}</span>
                        </div>
                        {result?.applied.safeApplied ? (
                          <p className="mt-2 text-xs text-warning">{copy.safeGuardrails}</p>
                        ) : null}
                      </div>

                    </>
                  ) : !user && sourceImage?.source === 'example' ? (
                    <div className="overflow-hidden rounded-card border border-border bg-bg">
                      <div className="relative overflow-hidden bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.12),transparent_38%),linear-gradient(180deg,rgba(255,255,255,0.02),rgba(15,23,42,0.06))]">
                        <img src={ANGLE_GUEST_EXAMPLE_OUTPUT_URL} alt="" className="max-h-[420px] w-full object-contain" />
                      </div>
                    </div>
                  ) : (
                    <div className="flex min-h-[420px] items-center justify-center rounded-card border border-dashed border-border bg-bg p-6 text-center">
                      <div>
                        {generating ? (
                          <>
                            <div className="flex items-center justify-center gap-2 text-sm font-medium text-text-primary">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              {copy.generatingOverlayTitle}
                            </div>
                            <p className="mt-2 text-xs text-text-muted">
                              {copy.generatingOverlayBody}
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="text-sm font-medium text-text-primary">{copy.emptyTitle}</p>
                            <p className="mt-2 text-xs text-text-muted">{copy.emptyBody}</p>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {recentAngleJobs.length ? (
                    <div className="rounded-card border border-border bg-bg p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{copy.previousJobs}</p>
                        <Link href="/jobs" className="text-xs font-medium text-brand hover:underline">
                          {copy.openJobs}
                        </Link>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {recentAngleJobs.map((entry) => (
                          <button
                            key={entry.jobId}
                            type="button"
                            onClick={() => {
                              setActiveRecentJobId(entry.jobId);
                              setActiveRecentOutputIndex(0);
                            }}
                            className="overflow-hidden rounded-card border border-border bg-surface text-left transition hover:border-brand/40"
                          >
                            <div className="h-20 w-full overflow-hidden bg-bg">
                              <AngleOutputMosaic outputs={entry.outputs} compact copy={copy} />
                            </div>
                            <div className="px-2 py-1.5">
                              <p className="truncate text-[10px] font-medium text-text-primary">{entry.engineLabel}</p>
                              <p className="truncate text-[10px] text-text-muted">
                              {new Date(entry.createdAt).toLocaleDateString(locale)}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </Card>
            </div>
          </div>
        </main>
      </div>
      <AngleRecentJobModal
        copy={copy}
        job={activeRecentJob}
        locale={locale}
        onAddToLibrary={handleAddOutputToLibrary}
        onClose={() => setActiveRecentJobId(null)}
        onOutputIndexChange={setActiveRecentOutputIndex}
        outputIndex={activeRecentOutputIndex}
        savingOutputUrl={savingOutputUrl}
      />
      <AngleImageLibraryModal
        open={libraryModalOpen}
        onClose={() => setLibraryModalOpen(false)}
        onSelect={handleLibrarySelect}
        copy={copy}
      />
      <AngleAuthGateModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        loginRedirectTarget={loginRedirectTarget}
        copy={copy}
      />
    </div>
  );
}
