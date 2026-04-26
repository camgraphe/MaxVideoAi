'use client';

/* eslint-disable @next/next/no-img-element */

import Link from 'next/link';
import { useMemo, useState, type ChangeEvent } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  Image as ImageIcon,
  Loader2,
  Maximize2,
  Save,
  Sparkles,
  Upload,
  Video,
  WandSparkles,
} from 'lucide-react';
import { AppSidebar } from '@/components/AppSidebar';
import { HeaderBar } from '@/components/HeaderBar';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { SelectMenu } from '@/components/ui/SelectMenu';
import { authFetch } from '@/lib/authFetch';
import { runUpscaleTool, saveAssetToLibrary, useInfiniteJobs } from '@/lib/api';
import { suggestDownloadFilename, triggerAppDownload } from '@/lib/download';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { FEATURES } from '@/content/feature-flags';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import {
  DEFAULT_UPSCALE_IMAGE_ENGINE_ID,
  DEFAULT_UPSCALE_VIDEO_ENGINE_ID,
  listUpscaleToolEngines,
} from '@/config/tools-upscale-engines';
import type {
  UpscaleMediaType,
  UpscaleMode,
  UpscaleOutputFormat,
  UpscaleTargetResolution,
  UpscaleToolEngineId,
  UpscaleToolOutput,
  UpscaleToolResponse,
} from '@/types/tools-upscale';

const SAMPLE_IMAGE_URL =
  'https://videohub-uploads-us.s3.amazonaws.com/rendersthumbs/301cc489-d689-477f-94c4-0b051deda0bc/44d08767-2bba-4ece-9e37-00991db207af.webp';

const DEFAULT_COPY = {
  disabledTitle: 'Tools are disabled',
  disabledBody: 'Enable `FEATURES.workflows.toolsSection` to access this area.',
  back: 'Back to Tools',
  eyebrow: 'AI Upscale Studio',
  title: 'Upscale images and videos',
  subtitle: 'A clean finishing pass for stills and short clips before they go back into Library, Image, or Video.',
  image: 'Image',
  video: 'Video',
  sourceTitle: 'Source',
  upload: 'Drop or choose file',
  urlPlaceholder: 'Paste an image or video URL',
  uploadFailed: 'Upload failed.',
  settingsTitle: 'Upscale recipe',
  mediaType: 'Media type',
  engine: 'Engine',
  mode: 'Mode',
  factor: 'Factor',
  target: 'Target',
  output: 'Format',
  run: 'Run Upscale',
  running: 'Upscaling...',
  outputTitle: 'Studio preview',
  emptyOutput: 'Add a source and run an upscale to compare the finished asset here.',
  save: 'Save',
  saved: 'Saved to Library.',
  saveFailed: 'Failed to save to Library.',
  download: 'Download',
  recentTitle: 'Recent upscales',
  authTitle: 'Sign in to upscale',
  authBody: 'Uploads, wallet billing, and Library actions require an account.',
  authPrimary: 'Create account',
  authSecondary: 'Sign in',
} as const;

type UploadedAsset = {
  id?: string | null;
  url: string;
  width?: number | null;
  height?: number | null;
  mime?: string | null;
  name?: string | null;
};

function isOutputVideo(output?: UpscaleToolOutput | null) {
  return Boolean(output?.mimeType?.startsWith('video/') || output?.url.match(/\.(mp4|webm|mov)(\?|$)/i));
}

function mediaTypeFromMime(mime?: string | null): UpscaleMediaType | null {
  if (!mime) return null;
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  return null;
}

async function uploadSourceFile(file: File, mediaType: UpscaleMediaType): Promise<UploadedAsset> {
  const form = new FormData();
  form.append('file', file);
  const response = await authFetch(mediaType === 'video' ? '/api/uploads/video' : '/api/uploads/image', {
    method: 'POST',
    body: form,
  });
  const payload = (await response.json().catch(() => null)) as {
    ok?: boolean;
    error?: string;
    asset?: UploadedAsset;
  } | null;
  if (!response.ok || !payload?.ok || !payload.asset?.url) {
    throw new Error(payload?.error ?? `Upload failed (${response.status})`);
  }
  return payload.asset;
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">{children}</span>;
}

function SegmentButton({
  active,
  disabled,
  children,
  onClick,
}: {
  active: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex min-h-[46px] items-center justify-center gap-2 rounded-input border px-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
        active
          ? 'border-brand bg-brand text-on-brand shadow-[0_12px_28px_rgba(37,99,235,0.20)]'
          : 'border-hairline bg-surface text-text-secondary hover:border-border-hover hover:bg-surface-hover hover:text-text-primary'
      }`}
    >
      {children}
    </button>
  );
}

export default function UpscaleWorkspace() {
  const { loading: authLoading, user } = useRequireAuth({ redirectIfLoggedOut: false });
  const { t } = useI18n();
  const copy = {
    ...DEFAULT_COPY,
    ...((t('workspace.upscale') ?? {}) as Partial<typeof DEFAULT_COPY>),
  };
  const [mediaType, setMediaType] = useState<UpscaleMediaType>('image');
  const [engineId, setEngineId] = useState<UpscaleToolEngineId>(DEFAULT_UPSCALE_IMAGE_ENGINE_ID);
  const [source, setSource] = useState<UploadedAsset | null>(null);
  const [mediaUrl, setMediaUrl] = useState('');
  const [mode, setMode] = useState<UpscaleMode>('factor');
  const [upscaleFactor, setUpscaleFactor] = useState(2);
  const [targetResolution, setTargetResolution] = useState<UpscaleTargetResolution>('1080p');
  const [outputFormat, setOutputFormat] = useState<UpscaleOutputFormat>('jpg');
  const [uploading, setUploading] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<UpscaleToolResponse | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { stableJobs: recentJobs, mutate } = useInfiniteJobs(8, { surface: 'upscale' });

  const engines = useMemo(() => listUpscaleToolEngines(mediaType), [mediaType]);
  const engine = useMemo(() => engines.find((entry) => entry.id === engineId) ?? engines[0], [engineId, engines]);
  const output = result?.output ?? null;
  const canRun = Boolean(user && mediaUrl.trim() && engine && !running && !uploading);
  const previewUrl = output?.url || mediaUrl || SAMPLE_IMAGE_URL;
  const previewIsVideo = output ? isOutputVideo(output) : mediaType === 'video' && Boolean(mediaUrl);

  function changeMediaType(next: UpscaleMediaType) {
    setMediaType(next);
    const nextEngine = next === 'video' ? DEFAULT_UPSCALE_VIDEO_ENGINE_ID : DEFAULT_UPSCALE_IMAGE_ENGINE_ID;
    const resolved = listUpscaleToolEngines(next).find((entry) => entry.id === nextEngine) ?? listUpscaleToolEngines(next)[0];
    setEngineId(resolved.id);
    setMode(resolved.defaultMode);
    setUpscaleFactor(resolved.defaultUpscaleFactor);
    setTargetResolution(resolved.defaultTargetResolution ?? '1080p');
    setOutputFormat(resolved.defaultOutputFormat);
    setSource(null);
    setMediaUrl('');
    setResult(null);
    setError(null);
    setMessage(null);
  }

  function changeEngine(nextId: UpscaleToolEngineId) {
    const nextEngine = engines.find((entry) => entry.id === nextId);
    if (!nextEngine) return;
    setEngineId(nextEngine.id);
    setMode(nextEngine.defaultMode);
    setUpscaleFactor(nextEngine.defaultUpscaleFactor);
    setTargetResolution(nextEngine.defaultTargetResolution ?? '1080p');
    setOutputFormat(nextEngine.defaultOutputFormat);
  }

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const detectedType = mediaTypeFromMime(file.type);
    const nextMediaType = detectedType ?? mediaType;
    if (nextMediaType !== mediaType) changeMediaType(nextMediaType);
    setUploading(true);
    setError(null);
    setMessage(null);
    try {
      const uploaded = await uploadSourceFile(file, nextMediaType);
      setSource(uploaded);
      setMediaUrl(uploaded.url);
      setMessage(uploaded.name ?? file.name);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : copy.uploadFailed);
    } finally {
      setUploading(false);
    }
  }

  async function handleRun() {
    if (!canRun || !engine) return;
    setRunning(true);
    setError(null);
    setMessage(null);
    try {
      const response = await runUpscaleTool({
        mediaType,
        mediaUrl: mediaUrl.trim(),
        engineId: engine.id,
        mode,
        upscaleFactor,
        targetResolution,
        outputFormat,
        sourceAssetId: source?.id ?? null,
        imageWidth: source?.width ?? null,
        imageHeight: source?.height ?? null,
      });
      setResult(response);
      setMessage(`${response.engineLabel} · $${response.pricing.estimatedCostUsd.toFixed(2)}`);
      void mutate();
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : 'Upscale failed.');
    } finally {
      setRunning(false);
    }
  }

  async function handleSave() {
    if (!output?.url) return;
    setError(null);
    try {
      await saveAssetToLibrary({
        url: output.url,
        jobId: result?.jobId ?? null,
        label: result?.engineLabel ?? 'Upscale',
        source: 'upscale',
        kind: mediaType,
      });
      setMessage(copy.saved);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : copy.saveFailed);
    }
  }

  function handleDownload() {
    if (!output?.url) return;
    triggerAppDownload(output.url, suggestDownloadFilename(output.url, `upscale-${mediaType}`));
  }

  if (authLoading) {
    return (
      <div className="flex min-h-screen flex-col bg-bg">
        <HeaderBar />
        <div className="flex flex-1 min-w-0 flex-col md:flex-row">
          <AppSidebar />
          <main className="flex-1 min-w-0 overflow-y-auto p-5 lg:p-7">
            <div className="h-64 animate-pulse rounded-card border border-border bg-surface" />
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
            <Card>
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
        <main className="flex-1 min-w-0 overflow-y-auto p-4 lg:p-6">
          <div className="mx-auto w-full max-w-[1360px] space-y-5">
            <section className="overflow-hidden rounded-[24px] border border-hairline bg-[linear-gradient(135deg,#f8fafc,#eef4ff_52%,#fff7ed)] shadow-card">
              <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:p-5">
                <div className="min-w-0">
                  <ButtonLink href="/app/tools" variant="ghost" size="sm" linkComponent={Link} className="-ml-2">
                    <ArrowLeft className="h-4 w-4" />
                    {copy.back}
                  </ButtonLink>
                  <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-brand">{copy.eyebrow}</p>
                  <h1 className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight text-text-primary lg:text-4xl">
                    {copy.title}
                  </h1>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-text-secondary">{copy.subtitle}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {['SeedVR2', 'Topaz', 'FlashVSR', 'Recraft Crisp'].map((label) => (
                      <span key={label} className="rounded-full border border-white/70 bg-white/70 px-3 py-1 text-xs font-semibold text-text-secondary shadow-sm">
                        {label}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="rounded-[20px] border border-white/70 bg-white/72 p-3 shadow-[0_18px_60px_rgba(15,23,42,0.10)] backdrop-blur">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-input bg-brand text-on-brand">
                      <Sparkles className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-text-primary">{engine?.label ?? 'Upscale engine'}</p>
                      <p className="text-xs text-text-muted">{mediaType === 'video' ? 'Dynamic video pricing' : 'Fixed image run'}</p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-input bg-bg/80 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">Mode</p>
                      <p className="mt-1 text-sm font-semibold text-text-primary">{mode === 'target' ? targetResolution : `${upscaleFactor}x`}</p>
                    </div>
                    <div className="rounded-input bg-bg/80 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">Type</p>
                      <p className="mt-1 text-sm font-semibold text-text-primary">{mediaType}</p>
                    </div>
                    <div className="rounded-input bg-bg/80 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">Out</p>
                      <p className="mt-1 text-sm font-semibold text-text-primary">{outputFormat.toUpperCase()}</p>
                    </div>
                  </div>
                  <Button className="mt-3 w-full" onClick={handleRun} disabled={!canRun}>
                    {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}
                    {running ? copy.running : copy.run}
                  </Button>
                </div>
              </div>
            </section>

            <div className="grid gap-5 lg:grid-cols-[410px_minmax(0,1fr)]">
              <section className="space-y-4 lg:sticky lg:top-4 lg:self-start">
                <Card className="border-hairline bg-surface p-5 shadow-card">
                  <div className="mb-5 flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold text-text-primary">{copy.sourceTitle}</h2>
                      <p className="mt-1 text-xs text-text-muted">Input asset and output intent</p>
                    </div>
                    <Upload className="h-5 w-5 text-brand" />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <SegmentButton active={mediaType === 'image'} disabled={running || uploading} onClick={() => changeMediaType('image')}>
                      <ImageIcon className="h-4 w-4" />
                      {copy.image}
                    </SegmentButton>
                    <SegmentButton active={mediaType === 'video'} disabled={running || uploading} onClick={() => changeMediaType('video')}>
                      <Video className="h-4 w-4" />
                      {copy.video}
                    </SegmentButton>
                  </div>

                  <label className="mt-4 block cursor-pointer rounded-[18px] border border-dashed border-border bg-bg p-5 text-center transition hover:border-brand/50 hover:bg-surface-hover">
                    <Input
                      type="file"
                      accept={mediaType === 'image' ? 'image/*' : 'video/*'}
                      onChange={handleUpload}
                      disabled={!user || uploading || running}
                      className="sr-only"
                    />
                    <span className="mx-auto inline-flex h-11 w-11 items-center justify-center rounded-full bg-brand/10 text-brand">
                      {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                    </span>
                    <span className="mt-3 block text-sm font-semibold text-text-primary">{copy.upload}</span>
                    <span className="mt-1 block text-xs text-text-muted">{source?.name ?? (mediaType === 'video' ? 'MP4, WebM, MOV' : 'JPG, PNG, WebP')}</span>
                  </label>

                  <label className="mt-4 block">
                    <Label>URL</Label>
                    <Input
                      value={mediaUrl}
                      onChange={(event) => {
                        setMediaUrl(event.target.value);
                        setSource(null);
                      }}
                      placeholder={copy.urlPlaceholder}
                      disabled={running || uploading}
                    />
                  </label>
                </Card>

                <Card className="border-hairline bg-surface p-5 shadow-card">
                  <div className="mb-5 flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold text-text-primary">{copy.settingsTitle}</h2>
                      <p className="mt-1 text-xs text-text-muted">Model, scale and export</p>
                    </div>
                    <Maximize2 className="h-5 w-5 text-brand" />
                  </div>

                  <div className="space-y-4">
                    <label className="block">
                      <Label>{copy.engine}</Label>
                      <SelectMenu
                        value={engine?.id ?? engineId}
                        onChange={(value) => changeEngine(value as UpscaleToolEngineId)}
                        options={engines.map((entry) => ({ value: entry.id, label: entry.label }))}
                        disabled={running}
                      />
                    </label>

                    <div className="grid grid-cols-2 gap-3">
                      <label className="block">
                        <Label>{copy.mode}</Label>
                        <SelectMenu
                          value={mode}
                          onChange={(value) => setMode(value as UpscaleMode)}
                          options={(engine?.supportedModes ?? ['factor']).map((entry) => ({
                            value: entry,
                            label: entry === 'target' ? copy.target : copy.factor,
                          }))}
                          disabled={running}
                        />
                      </label>
                      <label className="block">
                        <Label>{mode === 'target' ? copy.target : copy.factor}</Label>
                        {mode === 'target' ? (
                          <SelectMenu
                            value={targetResolution}
                            onChange={(value) => setTargetResolution(value as UpscaleTargetResolution)}
                            options={(engine?.supportedTargetResolutions ?? ['1080p']).map((entry) => ({ value: entry, label: entry }))}
                            disabled={running}
                          />
                        ) : (
                          <SelectMenu
                            value={upscaleFactor}
                            onChange={(value) => setUpscaleFactor(Number(value))}
                            options={(engine?.supportedUpscaleFactors ?? [2]).map((entry) => ({ value: entry, label: `${entry}x` }))}
                            disabled={running}
                          />
                        )}
                      </label>
                    </div>

                    <label className="block">
                      <Label>{copy.output}</Label>
                      <SelectMenu
                        value={outputFormat}
                        onChange={(value) => setOutputFormat(value as UpscaleOutputFormat)}
                        options={(engine?.supportedOutputFormats ?? ['jpg']).map((entry) => ({ value: entry, label: entry.toUpperCase() }))}
                        disabled={running}
                      />
                    </label>
                  </div>

                  <Button className="mt-5 w-full" size="lg" onClick={handleRun} disabled={!canRun}>
                    {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}
                    {running ? copy.running : copy.run}
                  </Button>
                  {message ? <p className="mt-3 text-sm text-text-secondary">{message}</p> : null}
                  {error ? <p className="mt-3 text-sm font-medium text-danger">{error}</p> : null}
                </Card>
              </section>

              <section className="space-y-4">
                <Card className="overflow-hidden border-hairline bg-surface p-0 shadow-card">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-5 py-4">
                    <div>
                      <h2 className="text-lg font-semibold text-text-primary">{copy.outputTitle}</h2>
                      <p className="mt-1 text-xs text-text-muted">{output ? 'Completed upscale output' : copy.emptyOutput}</p>
                    </div>
                    {output?.url ? (
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={handleSave}>
                          <Save className="h-4 w-4" />
                          {copy.save}
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleDownload}>
                          <Download className="h-4 w-4" />
                          {copy.download}
                        </Button>
                      </div>
                    ) : null}
                  </div>

                  <div className="bg-[linear-gradient(180deg,#111827,#18233a)] p-4 sm:p-6">
                    <div className="grid gap-4 xl:grid-cols-[minmax(0,0.72fr)_minmax(0,1fr)]">
                      <div className="rounded-[20px] border border-white/10 bg-white/[0.06] p-3">
                        <div className="mb-3 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                          <span>Source</span>
                          <span>{mediaType}</span>
                        </div>
                        <div className="relative aspect-[4/3] overflow-hidden rounded-[16px] bg-black/35">
                          {mediaUrl && mediaType === 'video' ? (
                            <video className="h-full w-full object-contain" src={mediaUrl} controls muted />
                          ) : (
                            <img className="h-full w-full scale-[1.02] object-contain opacity-75 blur-[0.8px]" src={mediaUrl || SAMPLE_IMAGE_URL} alt="" />
                          )}
                        </div>
                      </div>

                      <div className="rounded-[20px] border border-white/10 bg-white/[0.08] p-3 shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
                        <div className="mb-3 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.18em] text-white">
                          <span>Upscaled</span>
                          <span>{output ? 'Ready' : 'Preview'}</span>
                        </div>
                        <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-[16px] bg-black/45">
                          {previewIsVideo ? (
                            <video className="h-full w-full object-contain" src={previewUrl} controls={Boolean(output)} muted />
                          ) : (
                            <img className="h-full w-full object-contain" src={previewUrl} alt="" />
                          )}
                          {!output ? (
                            <div className="absolute inset-x-5 bottom-5 rounded-[16px] border border-white/10 bg-black/45 p-4 text-white backdrop-blur">
                              <p className="text-sm font-semibold">Ready for a high-resolution pass</p>
                              <p className="mt-1 text-xs leading-5 text-slate-300">Choose a model and run the upscale to replace this preview with the final asset.</p>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>

                <Card className="border-hairline bg-surface p-5 shadow-card">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold text-text-primary">{copy.recentTitle}</h2>
                    <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-3 py-1 text-xs font-semibold text-success">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Surface ready
                    </span>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {recentJobs.slice(0, 8).map((job) => {
                      const imageUrl = job.heroRenderId ?? job.renderIds?.[0] ?? job.thumbUrl ?? job.previewFrame ?? null;
                      const videoUrl = job.videoUrl ?? job.readyVideoUrl ?? null;
                      return (
                        <div key={job.jobId} className="overflow-hidden rounded-[16px] border border-hairline bg-bg transition hover:-translate-y-0.5 hover:shadow-card">
                          <div className="aspect-video bg-surface-2">
                            {videoUrl ? (
                              <video className="h-full w-full object-cover" src={videoUrl} muted />
                            ) : imageUrl ? (
                              <img className="h-full w-full object-cover" src={imageUrl} alt="" />
                            ) : (
                              <div className="flex h-full items-center justify-center text-xs text-text-muted">No preview</div>
                            )}
                          </div>
                          <div className="p-3">
                            <p className="truncate text-xs font-semibold text-text-primary">{job.engineLabel}</p>
                            <p className="mt-1 truncate text-xs text-text-muted">{job.status ?? 'completed'}</p>
                          </div>
                        </div>
                      );
                    })}
                    {!recentJobs.length ? (
                      <div className="rounded-[16px] border border-dashed border-border bg-bg p-4 text-sm text-text-muted sm:col-span-2 xl:col-span-4">
                        No upscale runs yet.
                      </div>
                    ) : null}
                  </div>
                </Card>
              </section>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
