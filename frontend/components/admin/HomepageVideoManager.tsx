"use client";

import { useCallback, useState } from 'react';
import Image from 'next/image';
import clsx from 'clsx';
import { Button } from '@/components/ui/Button';
import { authFetch } from '@/lib/authFetch';

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
  const res = await authFetch(`/api/videos/${encodeURIComponent(videoId)}`, {
    cache: 'no-store',
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

export function HomepageVideoManager({ initialHero }: HomepageVideoManagerProps) {
  const [heroSlots, setHeroSlots] = useState(() => initialHero.map(prepareSlotState));

  const updateSlotState = useCallback(
    (key: string, updater: (slot: SlotCardState) => SlotCardState) => {
      setHeroSlots((current) => current.map((slot) => (slot.key === key ? updater(slot) : slot)));
    },
    []
  );

  const handleFieldChange = useCallback(
    (slot: SlotCardState, field: 'title' | 'subtitle' | 'videoId', value: string) => {
      updateSlotState(slot.key, (current) => ({
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
      updateSlotState(slot.key, (current) => ({
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
      updateSlotState(slot.key, (current) => ({
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
      updateSlotState(slot.key, (current) => ({ ...current, saving: true, feedback: null, error: null }));

      try {
        const payload: Record<string, unknown> = {
          title: trimmedTitle || null,
          subtitle: trimmedSubtitle || null,
          videoId: trimmedVideoId || null,
        };

        let response: Response | null = null;
        if (slot.sectionId) {
          response = await authFetch(`/api/admin/homepage/${slot.sectionId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
        } else {
          response = await authFetch('/api/admin/homepage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              key: slot.key,
              type: 'hero',
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

        updateSlotState(slot.key, (current) => ({
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
        updateSlotState(slot.key, (current) => ({
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
      <section className="space-y-4">
        <header className="space-y-1">
          <h2 className="text-lg font-semibold text-text-primary">Hero spotlight videos</h2>
          <p className="text-sm text-text-secondary">Configure the four hero tiles displayed above the fold.</p>
        </header>
        <div className="grid gap-4 lg:grid-cols-2">
          {heroSlots.map((slot) => {
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
                    <span className="text-xs font-semibold uppercase tracking-micro text-text-muted">Subtitle (optional)</span>
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
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleSave(slot)}
                      disabled={!slot.dirty || slot.saving}
                      className={clsx(
                        'px-4 py-2 text-sm font-semibold',
                        !slot.dirty || slot.saving
                          ? 'cursor-not-allowed border border-border bg-muted text-text-muted'
                          : 'border border-brand bg-brand text-on-brand hover:bg-brandHover'
                      )}
                    >
                      {slot.saving ? 'Saving…' : 'Save slot'}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleReset(slot)}
                      disabled={slot.saving}
                      className="border-border px-3 py-2 text-sm text-text-secondary hover:border-text-muted hover:text-text-primary"
                    >
                      Reset
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleClearVideo(slot)}
                      disabled={slot.saving || !slot.draftVideoId}
                      className="border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-100 hover:text-rose-600"
                    >
                      Clear video
                    </Button>
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
    </div>
  );
}
