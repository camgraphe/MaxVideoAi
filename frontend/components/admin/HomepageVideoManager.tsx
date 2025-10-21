"use client";

import { useCallback, useMemo, useState } from 'react';
import Image from 'next/image';
import clsx from 'clsx';

type SlotVideo = {
  id: string;
  engineLabel?: string;
  durationSec?: number;
  thumbUrl?: string;
  videoUrl?: string;
  createdAt?: string;
};

type HomepageSlotState = {
  sectionId: string | null;
  key: string;
  type: 'hero' | 'gallery';
  title: string;
  subtitle: string | null;
  videoId: string | null;
  orderIndex: number;
  video?: SlotVideo | null;
};

type SlotCardState = HomepageSlotState & {
  draftTitle: string;
  draftSubtitle: string;
  draftVideoId: string;
  saving: boolean;
  dirty: boolean;
  feedback: string | null;
  error: string | null;
};

type HomepageVideoManagerProps = {
  initialHero: HomepageSlotState[];
  initialGallery: HomepageSlotState[];
};

function prepareSlotState(slot: HomepageSlotState): SlotCardState {
  return {
    ...slot,
    draftTitle: slot.title ?? '',
    draftSubtitle: slot.subtitle ?? '',
    draftVideoId: slot.videoId ?? '',
    saving: false,
    dirty: false,
    feedback: null,
    error: null,
  };
}

async function fetchVideoPreview(videoId: string): Promise<SlotVideo | null> {
  const res = await fetch(`/api/videos/${encodeURIComponent(videoId)}`, {
    cache: 'no-store',
    credentials: 'include',
  }).catch(() => null);
  if (!res || !res.ok) return null;
  const json = await res.json().catch(() => null);
  if (!json?.ok || !json.video) return null;
  const video = json.video as Record<string, unknown>;
  return {
    id: typeof video.id === 'string' ? video.id : typeof video.videoId === 'string' ? video.videoId : videoId,
    engineLabel: typeof video.engineLabel === 'string' ? video.engineLabel : undefined,
    durationSec: typeof video.durationSec === 'number' ? video.durationSec : undefined,
    thumbUrl: typeof video.thumbUrl === 'string' ? video.thumbUrl : undefined,
    videoUrl: typeof video.videoUrl === 'string' ? video.videoUrl : undefined,
    createdAt: typeof video.createdAt === 'string' ? video.createdAt : undefined,
  };
}

export function HomepageVideoManager({ initialHero, initialGallery }: HomepageVideoManagerProps) {
  const [heroSlots, setHeroSlots] = useState(() => initialHero.map(prepareSlotState));
  const [gallerySlots, setGallerySlots] = useState(() => initialGallery.map(prepareSlotState));

  const updateSlotState = useCallback(
    (
      type: 'hero' | 'gallery',
      key: string,
      updater: (slot: SlotCardState) => SlotCardState
    ) => {
      if (type === 'hero') {
        setHeroSlots((current) => current.map((slot) => (slot.key === key ? updater(slot) : slot)));
      } else {
        setGallerySlots((current) => current.map((slot) => (slot.key === key ? updater(slot) : slot)));
      }
    },
    []
  );

  const slotsByType = useMemo(() => (
    [
      { title: 'Hero spotlight videos', description: 'Configure the four hero tiles displayed above the fold.', slots: heroSlots },
      { title: 'Featured gallery videos', description: 'Pick three clips highlighted in the Gallery section.', slots: gallerySlots },
    ]
  ), [heroSlots, gallerySlots]);

  const handleFieldChange = useCallback(
    (slot: SlotCardState, field: 'title' | 'subtitle' | 'videoId', value: string) => {
      updateSlotState(slot.type, slot.key, (current) => ({
        ...current,
        draftTitle: field === 'title' ? value : current.draftTitle,
        draftSubtitle: field === 'subtitle' ? value : current.draftSubtitle,
        draftVideoId: field === 'videoId' ? value : current.draftVideoId,
        dirty: true,
        feedback: null,
        error: null,
      }));
    },
    [updateSlotState]
  );

  const handleReset = useCallback(
    (slot: SlotCardState) => {
      updateSlotState(slot.type, slot.key, (current) => ({
        ...current,
        draftTitle: current.title ?? '',
        draftSubtitle: current.subtitle ?? '',
        draftVideoId: current.videoId ?? '',
        dirty: false,
        feedback: null,
        error: null,
      }));
    },
    [updateSlotState]
  );

  const handleClearVideo = useCallback(
    (slot: SlotCardState) => {
      updateSlotState(slot.type, slot.key, (current) => ({
        ...current,
        draftVideoId: '',
        dirty: true,
        feedback: null,
        error: null,
      }));
    },
    [updateSlotState]
  );

  const handleSave = useCallback(
    async (slot: SlotCardState) => {
      const trimmedTitle = slot.draftTitle.trim();
      const trimmedSubtitle = slot.draftSubtitle.trim();
      const trimmedVideoId = slot.draftVideoId.trim();
      updateSlotState(slot.type, slot.key, (current) => ({ ...current, saving: true, feedback: null, error: null }));

      try {
        const payload: Record<string, unknown> = {
          title: trimmedTitle || null,
          subtitle: trimmedSubtitle || null,
          videoId: trimmedVideoId || null,
        };

        let response: Response | null = null;
        if (slot.sectionId) {
          response = await fetch(`/api/admin/homepage/${slot.sectionId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload),
          });
        } else {
          response = await fetch('/api/admin/homepage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              key: slot.key,
              type: slot.type === 'hero' ? 'hero' : 'gallery',
              ...payload,
            }),
          });
        }

        const json = await response?.json().catch(() => null);
        if (!response || !response.ok || !json?.ok) {
          throw new Error(json?.error ?? 'Failed to save slot');
        }

        const section = json.section as
          | {
              id: string;
              title: string | null;
              subtitle: string | null;
              videoId: string | null;
            }
          | undefined;

        let videoPreview: SlotVideo | null = null;
        if (trimmedVideoId) {
          videoPreview = await fetchVideoPreview(trimmedVideoId);
        }

        updateSlotState(slot.type, slot.key, (current) => ({
          ...current,
          sectionId: section?.id ?? current.sectionId,
          title: section?.title ?? trimmedTitle,
          subtitle: section?.subtitle ?? (trimmedSubtitle || null),
          videoId: section?.videoId ?? (trimmedVideoId || null),
          draftTitle: section?.title ?? trimmedTitle,
          draftSubtitle: section?.subtitle ?? (trimmedSubtitle || ''),
          draftVideoId: section?.videoId ?? trimmedVideoId,
          video: videoPreview ?? null,
          dirty: false,
          saving: false,
          feedback: 'Saved',
          error: null,
        }));
      } catch (error) {
        updateSlotState(slot.type, slot.key, (current) => ({
          ...current,
          saving: false,
          feedback: null,
          error: error instanceof Error ? error.message : 'Failed to save slot',
        }));
      }
    },
    [updateSlotState]
  );

  return (
    <div className="space-y-10">
      {slotsByType.map(({ title, description, slots }) => (
        <section key={title} className="space-y-4">
          <header className="space-y-1">
            <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
            <p className="text-sm text-text-secondary">{description}</p>
          </header>
          <div className="grid gap-4 lg:grid-cols-2">
            {slots.map((slot) => {
              const video = slot.video;
              return (
                <article key={slot.key} className="space-y-4 rounded-card border border-border bg-white p-5 shadow-card">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold uppercase tracking-micro text-text-muted">
                        {slot.key}
                      </h3>
                      <p className="text-base font-semibold text-text-primary">{slot.title || 'Untitled slot'}</p>
                    </div>
                    {slot.feedback ? (
                      <span className="text-xs font-semibold text-emerald-600">{slot.feedback}</span>
                    ) : null}
                    {slot.error ? (
                      <span className="text-xs font-semibold text-rose-600">{slot.error}</span>
                    ) : null}
                  </div>
                  <div className="relative overflow-hidden rounded-card border border-hairline bg-black" style={{ aspectRatio: '16 / 9' }}>
                    {video?.videoUrl ? (
                      <video
                        className="absolute inset-0 h-full w-full object-cover"
                        src={video.videoUrl}
                        poster={video.thumbUrl}
                        muted
                        loop
                        playsInline
                        autoPlay
                      />
                    ) : video?.thumbUrl ? (
                      <Image src={video.thumbUrl} alt="Preview" fill className="object-cover" sizes="320px" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-white/70">
                        No preview
                      </div>
                    )}
                  </div>
                  <div className="grid gap-3">
                    <label className="space-y-1 text-sm text-text-secondary">
                      <span className="text-xs font-semibold uppercase tracking-micro text-text-muted">Display title</span>
                      <input
                        type="text"
                        value={slot.draftTitle}
                        onChange={(event) => handleFieldChange(slot, 'title', event.target.value)}
                        className="w-full rounded-input border border-border px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </label>
                    <label className="space-y-1 text-sm text-text-secondary">
                      <span className="text-xs font-semibold uppercase tracking-micro text-text-muted">
                        {slot.type === 'gallery' ? 'Description' : 'Subtitle (optional)'}
                      </span>
                      <input
                        type="text"
                        value={slot.draftSubtitle}
                        onChange={(event) => handleFieldChange(slot, 'subtitle', event.target.value)}
                        className="w-full rounded-input border border-border px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </label>
                    <label className="space-y-1 text-sm text-text-secondary">
                      <span className="text-xs font-semibold uppercase tracking-micro text-text-muted">Job ID</span>
                      <input
                        type="text"
                        value={slot.draftVideoId}
                        onChange={(event) => handleFieldChange(slot, 'videoId', event.target.value)}
                        className="w-full rounded-input border border-border px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        placeholder="job_xxx"
                      />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleSave(slot)}
                        disabled={!slot.dirty || slot.saving}
                        className={clsx(
                          'rounded-input px-4 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          !slot.dirty || slot.saving
                            ? 'cursor-not-allowed border border-border bg-muted text-text-muted'
                            : 'border border-accent bg-accent text-white hover:bg-accent/90'
                        )}
                      >
                        {slot.saving ? 'Saving…' : 'Save slot'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReset(slot)}
                        disabled={slot.saving}
                        className="rounded-input border border-border px-3 py-2 text-sm text-text-secondary transition hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        Reset
                      </button>
                      <button
                        type="button"
                        onClick={() => handleClearVideo(slot)}
                        disabled={slot.saving || !slot.draftVideoId}
                        className="rounded-input border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
                      >
                        Clear video
                      </button>
                    </div>
                    {video ? (
                      <p className="text-xs text-text-muted">
                        Current video: {video.id}
                        {video.engineLabel ? ` • ${video.engineLabel}` : ''}
                        {typeof video.durationSec === 'number' ? ` • ${video.durationSec}s` : ''}
                      </p>
                    ) : slot.videoId ? (
                      <p className="text-xs text-rose-600">Failed to load preview for {slot.videoId}</p>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
