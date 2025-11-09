'use client';

/* eslint-disable @next/next/no-img-element */

import clsx from 'clsx';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { runImageGeneration, useInfiniteJobs } from '@/lib/api';
import type { ImageGenerationMode, GeneratedImage } from '@/types/image-generation';
import type { EngineCaps } from '@/types/engines';
import type { Job } from '@/types/jobs';

const EMPTY_STATE_COPY = {
  history: 'Launch a generation to populate your history. Each image variant appears below.',
};

type PromptPreset = {
  title: string;
  prompt: string;
  notes?: string;
  mode: ImageGenerationMode;
};

export type ImageEngineOption = {
  id: string;
  name: string;
  description?: string;
  pricePerImage: number;
  currency: string;
  prompts: PromptPreset[];
  modes: ImageGenerationMode[];
  engineCaps: EngineCaps;
};

type HistoryEntry = {
  id: string;
  engineId: string;
  engineLabel: string;
  mode: ImageGenerationMode;
  prompt: string;
  createdAt: number;
  description?: string | null;
  images: GeneratedImage[];
};

interface ImageWorkspaceProps {
  engines: ImageEngineOption[];
}

function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 3,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(3)}`;
  }
}

function formatTimestamp(timestamp: number): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    day: 'numeric',
  }).format(new Date(timestamp));
}

function parseImageUrls(input: string): string[] {
  return input
    .split(/\n|,/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length);
}

function mapJobToHistoryEntry(job: Job): HistoryEntry | null {
  const renderUrls = Array.isArray(job.renderIds)
    ? job.renderIds.filter((url): url is string => typeof url === 'string' && url.length)
    : [];
  const images: GeneratedImage[] =
    renderUrls.length > 0
      ? renderUrls.map((url) => ({ url }))
      : job.thumbUrl
        ? [{ url: job.thumbUrl }]
        : [];
  if (!images.length) return null;
  const timestamp = Date.parse(job.createdAt ?? '');
  return {
    id: job.jobId,
    engineId: job.engineId ?? '',
    engineLabel: job.engineLabel ?? job.engineId ?? 'Image generation',
    mode: 't2i',
    prompt: job.prompt ?? '',
    createdAt: Number.isNaN(timestamp) ? Date.now() : timestamp,
    description: job.message ?? null,
    images,
  };
}

export default function ImageWorkspace({ engines }: ImageWorkspaceProps) {
  const [engineId, setEngineId] = useState(() => engines[0]?.id ?? '');
  const [mode, setMode] = useState<ImageGenerationMode>('t2i');
  const [prompt, setPrompt] = useState('');
  const [numImages, setNumImages] = useState(1);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [localHistory, setLocalHistory] = useState<HistoryEntry[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const selectedEngine = useMemo(
    () => engines.find((engine) => engine.id === engineId) ?? engines[0],
    [engineId, engines]
  );
  const selectedEngineCaps = selectedEngine?.engineCaps ?? engines[0]?.engineCaps;

  useEffect(() => {
    if (!selectedEngine) return;
    if (!selectedEngine.modes.includes(mode)) {
      setMode(selectedEngine.modes[0] ?? 't2i');
    }
  }, [selectedEngine, mode]);

  const priceLabel = useMemo(() => {
    if (!selectedEngine) return '$0.039';
    return `${formatCurrency(selectedEngine.pricePerImage, selectedEngine.currency)} / image`;
  }, [selectedEngine]);

  const estimatedCostLabel = useMemo(() => {
    if (!selectedEngine) return '$0.00';
    const estimate = selectedEngine.pricePerImage * numImages;
    return formatCurrency(estimate, selectedEngine.currency);
  }, [numImages, selectedEngine]);

  const imageUrls = useMemo(() => parseImageUrls(imageUrlInput), [imageUrlInput]);
  const referenceSlots = useMemo(() => {
    const slots = imageUrls.slice(0, 4);
    while (slots.length < 4) {
      slots.push('');
    }
    return slots;
  }, [imageUrls]);
  const imageEngineIds = useMemo(() => new Set(engines.map((engine) => engine.engineCaps.id)), [engines]);

  const {
    data: jobPages,
    isLoading: jobsLoading,
    isValidating: jobsValidating,
    size: jobsSize,
    setSize: setJobsSize,
  } = useInfiniteJobs(24);

  const remoteHistory = useMemo(() => {
    if (!jobPages) return [];
    return jobPages
      .flatMap((page) => page.jobs ?? [])
      .filter((job) => job.engineId && imageEngineIds.has(job.engineId))
      .map((job) => mapJobToHistoryEntry(job))
      .filter((entry): entry is HistoryEntry => Boolean(entry));
  }, [jobPages, imageEngineIds]);

  const combinedHistory = useMemo(() => {
    const map = new Map<string, HistoryEntry>();
    remoteHistory.forEach((entry) => {
      map.set(entry.id, entry);
    });
    localHistory.forEach((entry) => {
      map.set(entry.id, entry);
    });
    return Array.from(map.values()).sort((a, b) => b.createdAt - a.createdAt);
  }, [localHistory, remoteHistory]);

  const handleRun = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!selectedEngine) return;
      if (!prompt.trim()) {
        setError('Prompt is required.');
        return;
      }
      if (mode === 'i2i' && !imageUrls.length) {
        setError('Provide at least one source image URL for edit mode.');
        return;
      }
      setIsGenerating(true);
      setError(null);
      setStatusMessage(null);
      try {
        const response = await runImageGeneration({
          engineId: selectedEngine.id,
          mode,
          prompt: prompt.trim(),
          numImages,
          imageUrls: mode === 'i2i' ? imageUrls : undefined,
        });
        const entry: HistoryEntry = {
          id: response.jobId ?? response.requestId ?? crypto.randomUUID(),
          engineId: response.engineId ?? selectedEngine.id,
          engineLabel: response.engineLabel ?? selectedEngine.name,
          mode,
          prompt: prompt.trim(),
          createdAt: Date.now(),
          description: response.description,
          images: response.images,
        };
        setLocalHistory((prev) => [entry, ...prev].slice(0, 24));
        setStatusMessage(`Generated ${response.images.length} image${response.images.length === 1 ? '' : 's'}.`);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Image generation failed.');
      } finally {
        setIsGenerating(false);
      }
    },
    [imageUrls, mode, numImages, prompt, selectedEngine]
  );

  const handlePreset = useCallback((preset: PromptPreset) => {
    setPrompt(preset.prompt);
    setMode(preset.mode);
  }, []);

  const handleCopy = useCallback((url: string) => {
    if (!navigator?.clipboard) {
      setCopiedUrl(url);
      return;
    }
    navigator.clipboard
      .writeText(url)
      .then(() => {
        setCopiedUrl(url);
        setTimeout(() => setCopiedUrl(null), 2000);
      })
      .catch(() => setCopiedUrl(null));
  }, []);

  const handleDownload = useCallback((url: string) => {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = '';
    anchor.target = '_blank';
    anchor.rel = 'noreferrer';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  }, []);

  if (!selectedEngine || !selectedEngineCaps) {
    return (
      <main className="flex flex-1 items-center justify-center bg-bg text-text-secondary">
        No image engines available.
      </main>
    );
  }

  const historyEntries = combinedHistory;
  const previewEntry = historyEntries[0];

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <main className="flex flex-1 flex-col gap-6 p-6">
        <div className="grid gap-6 xl:grid-cols-[400px,1fr]">
          <form
            className="rounded-[24px] border border-white/10 bg-white/70 p-6 shadow-card backdrop-blur"
            onSubmit={handleRun}
          >
            <div className="flex flex-col gap-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-text-muted">Engine</p>
                <div className="mt-2 flex flex-col gap-3">
                  <select
                    className="w-full rounded-2xl border border-hairline bg-white/80 px-4 py-2 text-sm font-medium text-text-primary"
                    value={engineId}
                    onChange={(event) => setEngineId(event.target.value)}
                  >
                    {engines.map((engine) => (
                      <option key={engine.id} value={engine.id}>
                        {engine.name}
                      </option>
                    ))}
                  </select>
                  <span className="inline-flex items-center gap-2 rounded-full bg-accentSoft/15 px-3 py-1 text-xs font-semibold text-accent">
                    {priceLabel}
                  </span>
                  {selectedEngine.description && (
                    <p className="text-sm text-text-secondary">{selectedEngine.description}</p>
                  )}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-text-muted">Mode</p>
                <div className="mt-2 inline-flex rounded-full border border-hairline bg-white/80 p-1">
                  {(['t2i', 'i2i'] as ImageGenerationMode[]).map((candidate) => {
                    const disabled = !selectedEngine.modes.includes(candidate);
                    return (
                      <button
                        key={candidate}
                        type="button"
                        disabled={disabled}
                        className={clsx(
                          'rounded-full px-4 py-1 text-sm font-semibold transition',
                          candidate === mode ? 'bg-text-primary text-white' : 'text-text-secondary',
                          disabled && 'cursor-not-allowed opacity-40'
                        )}
                        onClick={() => setMode(candidate)}
                      >
                        {candidate === 't2i' ? 'Generate' : 'Edit'}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label htmlFor="prompt" className="text-xs font-semibold uppercase tracking-[0.25em] text-text-muted">
                    Prompt
                  </label>
                  <span className="text-xs text-text-secondary">{prompt.length} chars</span>
                </div>
                <textarea
                  id="prompt"
                  className="mt-2 min-h-[140px] w-full rounded-2xl border border-hairline bg-white/80 px-4 py-3 text-sm text-text-primary outline-none focus:border-accent"
                  placeholder="Describe the image you’d like to generate..."
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                />
                {selectedEngine.prompts.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedEngine.prompts.map((preset) => (
                      <button
                        key={`${preset.title}-${preset.mode}`}
                        type="button"
                        onClick={() => handlePreset(preset)}
                        className="rounded-full border border-hairline px-3 py-1 text-xs font-medium text-text-secondary transition hover:border-accent hover:text-text-primary"
                      >
                        {preset.title}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div>
                <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.25em] text-text-muted">
                  <span>Number of images</span>
                  <span className="text-text-secondary">{numImages}</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={8}
                  value={numImages}
                  onChange={(event) => setNumImages(Number(event.target.value))}
                  className="mt-2 w-full accent-accent"
                />
                <p className="mt-1 text-xs text-text-secondary">Estimated cost: {estimatedCostLabel}</p>
              </div>

              {mode === 'i2i' && (
                <div>
                  <label htmlFor="image-urls" className="text-xs font-semibold uppercase tracking-[0.25em] text-text-muted">
                    Source image URLs
                  </label>
                  <textarea
                    id="image-urls"
                    className="mt-2 min-h-[120px] w-full rounded-2xl border border-hairline bg-white/80 px-4 py-3 text-sm text-text-primary outline-none focus:border-accent"
                    placeholder="Paste 1–4 URLs, one per line."
                    value={imageUrlInput}
                    onChange={(event) => setImageUrlInput(event.target.value)}
                  />
                  <p className="mt-1 text-xs text-text-secondary">Nano Banana supports up to 4 reference images.</p>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.25em] text-text-muted">
                  <span>Reference slots</span>
                  <Link
                    href="/app/library"
                    className="text-[11px] font-semibold text-accent underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Open library
                  </Link>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {referenceSlots.map((url, index) => (
                    <div
                      key={`slot-${index}`}
                      className={clsx(
                        'flex aspect-square flex-col items-center justify-center rounded-2xl border border-dashed border-hairline bg-white/70 text-center text-[11px] text-text-secondary',
                        url && 'border-solid border-accent/40 bg-white'
                      )}
                    >
                      {url ? (
                        <img src={url} alt="" className="h-full w-full rounded-2xl object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <>
                          <span>Slot {index + 1}</span>
                          <span className="mt-1 text-[10px] text-text-muted">Paste or import</span>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {error && (
                <p className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                  {error}
                </p>
              )}

              {statusMessage && (
                <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  {statusMessage}
                </p>
              )}

              <button
                type="submit"
                disabled={isGenerating}
                className={clsx(
                  'inline-flex items-center justify-center rounded-2xl bg-text-primary px-5 py-3 text-sm font-semibold text-white transition',
                  isGenerating ? 'opacity-60' : 'hover:bg-text-secondary'
                )}
              >
                {isGenerating ? 'Generating…' : 'Generate images'}
              </button>
            </div>
          </form>

          <div className="flex flex-col gap-6">
            <section className="rounded-[24px] border border-white/20 bg-white/70 p-6 shadow-card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-text-muted">Generate preview</p>
                  <h2 className="text-2xl font-semibold text-text-primary">Latest output</h2>
                </div>
                {previewEntry ? (
                  <span className="text-xs text-text-secondary">{formatTimestamp(previewEntry.createdAt)}</span>
                ) : null}
              </div>
              <div className="mt-4 rounded-2xl border border-white/60 bg-white/80 p-4">
                {previewEntry?.images[0] ? (
                  <div className="flex flex-col gap-3 lg:flex-row">
                    <div className="flex-1">
                      <div className="relative overflow-hidden rounded-2xl bg-[#f2f4f8]" style={{ aspectRatio: '1 / 1' }}>
                        <img
                          src={previewEntry.images[0].url}
                          alt={previewEntry.prompt}
                          className="h-full w-full object-cover"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    </div>
                    <div className="flex-1 space-y-2 text-sm text-text-secondary">
                      <p className="font-semibold text-text-primary">{previewEntry.engineLabel}</p>
                      <p className="text-text-secondary">{previewEntry.prompt}</p>
                      <div className="text-[11px] uppercase tracking-[0.25em] text-text-muted">
                        {previewEntry.mode === 't2i' ? 'Generate' : 'Edit'}
                      </div>
                      <div className="flex gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => handleDownload(previewEntry.images[0].url)}
                          className="rounded-full bg-text-primary/10 px-3 py-1 text-[11px] font-semibold text-text-primary"
                        >
                          Download
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopy(previewEntry.images[0].url)}
                          className="rounded-full border border-text-primary/20 px-3 py-1 text-[11px] font-semibold text-text-primary"
                        >
                          {copiedUrl === previewEntry.images[0].url ? 'Copied' : 'Copy link'}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-hairline bg-white/60 px-6 py-12 text-center text-sm text-text-secondary">
                    <p>No preview yet.</p>
                    <p className="text-xs text-text-muted">Run a generation to see the latest image here.</p>
                  </div>
                )}
              </div>
            </section>

            <div className="rounded-[24px] border border-dashed border-white/20 bg-white/60 p-6 shadow-inner">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-text-muted">Recent run</p>
                <h2 className="text-2xl font-semibold text-text-primary">{selectedEngine.name}</h2>
              </div>
              <span className="text-xs text-text-secondary">
                {historyEntries.length ? `${historyEntries.length} run${historyEntries.length === 1 ? '' : 's'}` : 'No runs yet'}
              </span>
            </div>
            {historyEntries.length === 0 ? (
              <div className="mt-8 rounded-2xl border border-white/50 bg-white/70 p-8 text-center text-sm text-text-secondary">
                {EMPTY_STATE_COPY.history}
              </div>
            ) : (
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {historyEntries.map((entry) => {
                  const displayImages = entry.images.slice(0, 4);
                  const primaryImage = displayImages[0];
                  return (
                    <div key={entry.id} className="rounded-2xl border border-white/40 bg-white/80 shadow-card">
                      <div className="rounded-t-2xl bg-[#f2f4f8] p-1">
                        {displayImages.length ? (
                          <div className="grid grid-cols-2 gap-1">
                            {displayImages.map((image, index) => (
                              <div key={`${entry.id}-${index}`} className="relative aspect-square overflow-hidden rounded-xl bg-neutral-100">
                                <img
                                  src={image.url}
                                  alt={entry.prompt}
                                  className="h-full w-full object-cover"
                                  loading="lazy"
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="flex aspect-square items-center justify-center text-xs text-text-secondary">No preview</div>
                        )}
                      </div>
                      <div className="space-y-2 border-t border-white/60 px-4 py-3 text-xs text-text-secondary">
                        <p className="font-semibold text-text-primary">{entry.engineLabel}</p>
                        <p className="line-clamp-2 text-text-secondary">{entry.prompt}</p>
                        <div className="flex items-center justify-between text-[11px] text-text-muted">
                          <span>{entry.mode === 't2i' ? 'Generate' : 'Edit'}</span>
                          <span>{formatTimestamp(entry.createdAt)}</span>
                        </div>
                        <div className="flex items-center gap-2 pt-2">
                          <button
                            type="button"
                            onClick={() => primaryImage && handleDownload(primaryImage.url)}
                            className="rounded-full bg-text-primary/10 px-3 py-1 text-[11px] font-semibold text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
                            disabled={!primaryImage}
                          >
                            Download
                          </button>
                          <button
                            type="button"
                            onClick={() => primaryImage && handleCopy(primaryImage.url)}
                            className="rounded-full border border-text-primary/20 px-3 py-1 text-[11px] font-semibold text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
                            disabled={!primaryImage}
                          >
                            {copiedUrl === primaryImage?.url ? 'Copied' : 'Copy link'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {jobsLoading && historyEntries.length === 0 && (
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={`history-skeleton-${index}`} className="rounded-2xl border border-white/40 bg-white/60 p-0" aria-hidden>
                    <div className="relative aspect-square overflow-hidden rounded-t-2xl bg-neutral-100">
                      <div className="skeleton absolute inset-0" />
                    </div>
                    <div className="border-t border-white/60 px-4 py-3">
                      <div className="h-3 w-24 rounded-full bg-neutral-200" />
                    </div>
                  </div>
                ))}
              </div>
            )}
            {jobsValidating && historyEntries.length > 0 && (
              <div className="mt-4 text-center text-xs text-text-secondary">Refreshing history…</div>
            )}
            {jobPages && jobPages[jobPages.length - 1]?.nextCursor && (
              <div className="mt-4 flex justify-center">
                <button
                  type="button"
                  onClick={() => setJobsSize(jobsSize + 1)}
                  className="rounded-full border border-white/60 px-4 py-2 text-xs font-semibold text-text-primary hover:bg-white/80"
                >
                  Load more
                </button>
              </div>
            )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
