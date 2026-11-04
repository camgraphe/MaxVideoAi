'use client';
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Clapperboard, ImagePlus, Plus, Download, Upload, X } from 'lucide-react';
import type { StudioCopy } from '../_lib/character-studio-copy';
import type { StudioRecastSelection } from '@/types/character-studio';

import { buildRecastBrief, isRecastAudioFile } from '@/lib/character-studio-recast';
import { CharacterStudioRecastDirection } from './CharacterStudioRecastDirection.client';

import { getRecastTiming, RECAST_MAX_SOURCE_SECONDS } from '@/lib/character-studio-recast-timing';
import { CharacterStudioRecastTiming } from './CharacterStudioRecastTiming.client';

type LocalMedia = { url: string; name: string; seconds?: number };
/** Local draft only: no upload, provider request, fabricated output, or billing. */
export function CharacterStudioRecast({
  copy,
  navigation,
  active,
  selection,
}: {
  copy: StudioCopy;
  navigation: ReactNode;
  active: boolean;
  selection?: StudioRecastSelection | null;
}) {
  const readerRoot = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!active)
      readerRoot.current
        ?.querySelectorAll<HTMLMediaElement>('video, audio')
        .forEach((video) => video.pause());
  }, [active]);
  const [video, setVideo] = useState<LocalMedia | null>(null);
  const [portrait, setPortrait] = useState<LocalMedia | null>(null);
  useEffect(() => {
    if (selection) setPortrait({ url: selection.imageUrl, name: selection.name });
  }, [selection]);
  const [product, setProduct] = useState<LocalMedia | null>(null);
  const [audio, setAudio] = useState<LocalMedia | null>(null);
  const [dialogue, setDialogue] = useState('');
  const productInput = useRef<HTMLInputElement>(null);
  const audioInput = useRef<HTMLInputElement>(null);
  const audioEpoch = useRef(0);
  useEffect(
    () => () => {
      audioEpoch.current++;
    },
    [],
  );
  useEffect(
    () => () => {
      if (product) URL.revokeObjectURL(product.url);
    },
    [product],
  );
  useEffect(
    () => () => {
      if (audio) URL.revokeObjectURL(audio.url);
    },
    [audio],
  );
  const [prompt, setPrompt] = useState('');
  const [error, setError] = useState('');
  const [manualSeconds, setManualSeconds] = useState<number | null>(null);
  const timing = getRecastTiming({
    sourceSeconds: video?.seconds ?? null,
    audioSeconds: audio?.seconds ?? null,
    dialogue,
    manualSeconds,
  });
  const mode = video ? 'v2v' : audio || product ? 'ref2v' : 'i2v';
  const hasDirection = Boolean(video || prompt.trim() || dialogue.trim() || audio);
  const canEstimate = hasDirection && (!video || video.seconds !== undefined);
  const canExport = Boolean(portrait && canEstimate && timing.valid);
  const videoInput = useRef<HTMLInputElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  useEffect(
    () => () => {
      if (video) URL.revokeObjectURL(video.url);
    },
    [video],
  );
  useEffect(
    () => () => {
      if (portrait?.url.startsWith('blob:')) URL.revokeObjectURL(portrait.url);
    },
    [portrait],
  );
  function select(file: File | undefined, kind: 'video' | 'image' | 'product') {
    if (!file) return;
    if (
      (kind === 'video'
        ? !(/\.(mp4|mov)$/i.test(file.name) && file.type.startsWith('video/'))
        : !file.type.startsWith('image/')) ||
      file.size > (kind === 'video' ? 100 : 20) * 1024 * 1024
    ) {
      setError(kind === 'video' ? copy.invalidVideo : copy.invalidImage);
      return;
    }
    setError('');
    const asset = { url: URL.createObjectURL(file), name: file.name };
    if (kind === 'video') setVideo(asset);
    else if (kind === 'product') setProduct(asset);
    else setPortrait(asset);
  }
  async function selectAudio(file?: File) {
    if (!file) return;
    const epoch = ++audioEpoch.current;
    if (!isRecastAudioFile(file)) {
      setError(copy.invalidAudio);
      return;
    }
    const url = URL.createObjectURL(file);
    const probe = document.createElement('audio');
    const duration = await new Promise<number>((resolve) => {
      const settle = (n: number) => {
        clearTimeout(timer);
        probe.onloadedmetadata = null;
        probe.onerror = null;
        probe.removeAttribute('src');
        resolve(n);
      };
      const timer = setTimeout(() => settle(NaN), 8000);
      probe.onloadedmetadata = () => settle(probe.duration);
      probe.onerror = () => settle(NaN);
      probe.preload = 'metadata';
      probe.src = url;
    });
    if (epoch !== audioEpoch.current || !Number.isFinite(duration) || duration <= 0 || duration > 15) {
      URL.revokeObjectURL(url);
      if (epoch === audioEpoch.current) setError(copy.invalidAudio);
      return;
    }
    setAudio({ url, name: file.name, seconds: duration });
    setError('');
  }
  function downloadBrief() {
    if (!canExport || !portrait) return;
    const brief = buildRecastBrief({
      source: video?.name,
      durationSec: timing.seconds,
      sourceDurationSec: video?.seconds,
      character: portrait.name,
      product: product?.name,
      direction: prompt,
      dialogue,
      audio: audio?.name,
    });
    const url = URL.createObjectURL(new Blob([JSON.stringify(brief, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'maxvideoai-recast.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div ref={readerRoot} className="grid h-full min-h-0 gap-3 lg:grid-cols-[340px_minmax(0,1fr)]">
      <aside className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-surface">
        {navigation}
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 pb-4">
          <div className="pt-1">
            <h2 className="text-sm font-semibold">MaxVideoAI Recast</h2>
            <p className="mt-2 text-xs leading-relaxed text-text-secondary">{copy.recastDraft}</p>
          </div>
          <section>
            <h3 className="mb-2 text-xs font-medium text-text-secondary">
              01 · {copy.sourceVideo} · {copy.optional}
            </h3>
            {video ? (
              <div className="relative overflow-hidden rounded-xl border border-border">
                <video
                  key={video.url}
                  onLoadedMetadata={(event) => {
                    const seconds = event.currentTarget.duration;
                    if (Number.isFinite(seconds) && seconds > 0 && seconds <= RECAST_MAX_SOURCE_SECONDS) {
                      setVideo((current) => (current?.url === video.url ? { ...current, seconds } : current));
                    } else {
                      setVideo(null);
                      setError(copy.invalidVideo);
                    }
                  }}
                  onError={() => {
                    setVideo(null);
                    setError(copy.invalidVideo);
                  }}
                  src={video.url}
                  controls
                  playsInline
                  preload="metadata"
                  className="max-h-48 w-full bg-black"
                  aria-label={copy.sourceVideo}
                />
                <button
                  type="button"
                  aria-label={`${copy.remove} · ${copy.sourceVideo}`}
                  onClick={() => setVideo(null)}
                  className="absolute right-2 top-2 rounded-full bg-black/70 p-1.5 text-white"
                >
                  <X size={14} />
                </button>
                <p className="truncate p-2 text-xs text-text-secondary">{video.name}</p>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => videoInput.current?.click()}
                className="flex min-h-32 w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-bg text-sm hover:border-brand"
              >
                <Upload size={24} />
                {copy.addVideo}
              </button>
            )}
          </section>
          <section>
            <h3 className="mb-2 text-xs font-medium text-text-secondary">02 · {copy.replacement}</h3>
            {portrait ? (
              <div className="relative">
                <img
                  src={portrait.url}
                  alt={portrait.name}
                  className="h-40 w-full rounded-xl bg-bg object-contain"
                />
                <p className="mt-2 truncate text-xs text-text-secondary">{portrait.name}</p>
                <button
                  type="button"
                  aria-label={`${copy.remove} · ${copy.replacement}`}
                  onClick={() => setPortrait(null)}
                  className="absolute right-2 top-2 rounded-full bg-black/70 p-1.5 text-white"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => imageInput.current?.click()}
                className="flex min-h-28 w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-bg px-3 text-sm hover:border-brand"
              >
                <ImagePlus size={24} />
                {copy.addReplacement}
              </button>
            )}
          </section>
          <section>
            <h3 className="mb-2 text-xs font-medium text-text-secondary">03 · {copy.product}</h3>
            {product ? (
              <div className="flex items-center gap-3 rounded-xl border border-border p-2">
                <img
                  src={product.url}
                  alt={product.name}
                  className="h-14 w-14 rounded-lg bg-bg object-contain"
                />
                <span className="min-w-0 flex-1 truncate text-xs">{product.name}</span>
                <button
                  type="button"
                  aria-label={copy.remove + ' · ' + copy.product}
                  onClick={() => setProduct(null)}
                  className="p-2"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => productInput.current?.click()}
                className="flex w-full items-center gap-3 rounded-xl border border-dashed border-border bg-bg p-3 text-sm"
              >
                <Plus size={18} />
                {copy.addProduct}
              </button>
            )}
            <p className="mt-2 text-xs text-text-secondary">{copy.productHint}</p>
          </section>
          <CharacterStudioRecastDirection
            copy={copy}
            prompt={prompt}
            onPrompt={setPrompt}
            dialogue={dialogue}
            onDialogue={setDialogue}
            audio={audio}
            addAudio={() => audioInput.current?.click()}
            removeAudio={() => {
              audioEpoch.current++;
              setAudio(null);
            }}
          />
          <input
            ref={productInput}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/bmp"
            className="hidden"
            onChange={(e) => {
              select(e.target.files?.[0], 'product');
              e.target.value = '';
            }}
          />
          <input
            ref={audioInput}
            type="file"
            accept=".mp3,.wav,audio/mpeg,audio/wav"
            className="hidden"
            onChange={(e) => {
              void selectAudio(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          {canExport && (
            <div>
              <button
                type="button"
                onClick={downloadBrief}
                className="flex items-center gap-2 text-xs font-medium underline underline-offset-4"
              >
                <Download size={14} />
                {copy.exportBrief}
              </button>
              <p className="mt-1 text-xs text-text-secondary">{copy.exportHint}</p>
            </div>
          )}
          {error && (
            <p role="alert" className="text-xs text-text-secondary">
              {error}
            </p>
          )}
          <p className="text-xs leading-relaxed text-text-secondary">{copy.localDraft}</p>
        </div>
        <div className="shrink-0 space-y-2 border-t border-border p-3">
          <CharacterStudioRecastTiming
            copy={copy}
            timing={timing}
            hasVideo={Boolean(video)}
            sourceSeconds={video?.seconds ?? null}
            hasAudio={Boolean(audio || dialogue.trim())}
            manual={manualSeconds}
            onManual={setManualSeconds}
            mode={mode}
            ready={active && canEstimate}
          />
          <p className="text-center text-xs text-text-secondary">{copy.recastSoon}</p>
          <button
            type="button"
            disabled
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand text-sm font-medium text-on-brand opacity-50"
          >
            <Clapperboard size={16} />
            {copy.recastGenerate}
          </button>
        </div>
        <input
          ref={videoInput}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => {
            select(e.target.files?.[0], 'video');
            e.target.value = '';
          }}
        />
        <input
          ref={imageInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            select(e.target.files?.[0], 'image');
            e.target.value = '';
          }}
        />
      </aside>
      <section className="hidden min-h-0 flex-col rounded-2xl border border-border bg-surface lg:flex">
        <h2 className="border-b border-border p-4 text-sm font-medium">{copy.recastPreview}</h2>
        <div className="flex min-h-0 flex-1 items-center justify-center p-6">
          {video ? (
            <video
              key={video.url}
              src={video.url}
              controls
              playsInline
              preload="none"
              className="max-h-full max-w-full rounded-xl bg-black"
              aria-label={copy.recastPreview}
            />
          ) : (
            <div className="max-w-xs text-center">
              <Clapperboard size={36} className="mx-auto mb-4 text-text-secondary" />
              <p className="text-sm leading-relaxed text-text-secondary">{copy.recastPreviewHint}</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
