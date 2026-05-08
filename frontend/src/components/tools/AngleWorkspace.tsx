'use client';

/* eslint-disable @next/next/no-img-element */

import deepmerge from 'deepmerge';
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
import { ArrowLeft, Loader2, WandSparkles } from 'lucide-react';
import { HeaderBar } from '@/components/HeaderBar';
import { AppSidebar } from '@/components/AppSidebar';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { saveImageToLibrary, useInfiniteJobs } from '@/lib/api';
import { authFetch } from '@/lib/authFetch';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { resolveAngleEngineForParams } from '@/lib/tools-angle';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { FEATURES } from '@/content/feature-flags';
import type { AngleToolEngineId, AngleToolNumericParams, AngleToolResponse } from '@/types/tools-angle';
import { AngleAuthGateModal } from './angle/_components/angle-auth-gate-modal';
import { AngleCameraControls } from './angle/_components/angle-camera-controls';
import { AngleImageLibraryModal } from './angle/_components/angle-image-library-modal';
import { AngleOrbitSelector } from './angle/_components/angle-orbit-selector';
import { AngleOutputPanel } from './angle/_components/angle-output-panel';
import { AngleRecentJobModal } from './angle/_components/angle-recent-job-modal';
import { AngleSourceImagePanel } from './angle/_components/angle-source-image-panel';
import { useAngleGenerationRunner } from './angle/_hooks/useAngleGenerationRunner';
import { DEFAULT_ANGLE_COPY, type AngleCopy } from './angle/_lib/angle-workspace-copy';
import {
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

  const handleRemoveSource = () => {
    setSourceImage((previous) => {
      cleanupSourcePreview(previous);
      return null;
    });
    setResult(null);
    setSelectedOutputIndex(0);
    if (!user) {
      setGuestExampleDismissed(true);
    }
  };

  const handleUploadRequest = () => {
    if (!user) {
      openAuthGate();
      return;
    }
    fileInputRef.current?.click();
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

                      <AngleSourceImagePanel
                        copy={copy}
                        fileInputRef={fileInputRef}
                        onAuthRequired={openAuthGate}
                        onFileSelect={handleFileSelect}
                        onLibraryOpen={() => setLibraryModalOpen(true)}
                        onRemoveSource={handleRemoveSource}
                        onSourceDragActiveChange={setSourceDragActive}
                        onSourceDrop={handleSourceDrop}
                        onSourcePaste={handleSourcePaste}
                        onUploadRequest={handleUploadRequest}
                        sourceDragActive={sourceDragActive}
                        sourceImage={sourceImage}
                        uploading={uploading}
                        userPresent={Boolean(user)}
                      />
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

                  <AngleCameraControls copy={copy} onParamsChange={setParams} params={params} />

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

              <AngleOutputPanel
                copy={copy}
                generating={generating}
                locale={locale}
                onAddOutputToLibrary={handleAddOutputToLibrary}
                onRecentJobOpen={setActiveRecentJobId}
                onRecentOutputIndexReset={() => setActiveRecentOutputIndex(0)}
                onSelectedOutputIndexChange={setSelectedOutputIndex}
                recentAngleJobs={recentAngleJobs}
                result={result}
                savingOutputUrl={savingOutputUrl}
                selectedOutputIndex={selectedOutputIndex}
                showGuestExampleOutput={!user && sourceImage?.source === 'example'}
              />
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
