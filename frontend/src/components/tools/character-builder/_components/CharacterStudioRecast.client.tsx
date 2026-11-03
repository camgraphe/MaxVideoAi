'use client';
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Clapperboard, ImagePlus, Upload, X } from 'lucide-react';
import type { StudioCopy } from '../_lib/character-studio-copy';

type LocalMedia = { url: string; name: string };
/** Local draft only: no upload, provider request, fabricated output, or billing. */
export function CharacterStudioRecast({
  copy,
  navigation,
  active,
}: {
  copy: StudioCopy;
  navigation: ReactNode;
  active: boolean;
}) {
  const readerRoot = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!active) readerRoot.current?.querySelectorAll('video').forEach((video) => video.pause());
  }, [active]);
  const [video, setVideo] = useState<LocalMedia | null>(null);
  const [portrait, setPortrait] = useState<LocalMedia | null>(null);
  const [prompt, setPrompt] = useState('');
  const [error, setError] = useState('');
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
      if (portrait) URL.revokeObjectURL(portrait.url);
    },
    [portrait],
  );
  function select(file: File | undefined, kind: 'video' | 'image') {
    if (!file) return;
    if (!file.type.startsWith(`${kind}/`) || file.size > (kind === 'video' ? 200 : 20) * 1024 * 1024) {
      setError(kind === 'video' ? copy.invalidVideo : copy.invalidImage);
      return;
    }
    setError('');
    const asset = { url: URL.createObjectURL(file), name: file.name };
    if (kind === 'video') setVideo(asset);
    else setPortrait(asset);
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
            <h3 className="mb-2 text-xs font-medium text-text-secondary">01 · {copy.sourceVideo}</h3>
            {video ? (
              <div className="relative overflow-hidden rounded-xl border border-border">
                <video
                  src={video.url}
                  controls
                  playsInline
                  preload="none"
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
          <label className="block text-xs font-medium text-text-secondary">
            {copy.recastPrompt}
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              maxLength={2000}
              rows={3}
              placeholder={copy.recastPromptHint}
              className="mt-2 w-full resize-y rounded-xl border border-border bg-bg p-3 text-sm font-normal"
            />
          </label>
          {error && (
            <p role="alert" className="text-xs text-text-secondary">
              {error}
            </p>
          )}
          <p className="text-xs leading-relaxed text-text-secondary">{copy.localDraft}</p>
        </div>
        <div className="shrink-0 space-y-2 border-t border-border p-3">
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
