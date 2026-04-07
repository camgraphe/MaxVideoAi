'use client';

import { useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import clsx from 'clsx';
import { Button } from '@/components/ui/Button';
import { authFetch } from '@/lib/authFetch';

type VideoThumbnailEditorProps = {
  videoId: string;
  title: string;
  engineLabel?: string | null;
  initialThumbUrl?: string | null;
  videoUrl?: string | null;
  className?: string;
  onThumbnailUpdated?: (thumbUrl: string) => void;
};

function formatTime(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '0.0s';
  return `${value.toFixed(1)}s`;
}

export function VideoThumbnailEditor({
  videoId,
  title,
  engineLabel,
  initialThumbUrl,
  videoUrl,
  className,
  onThumbnailUpdated,
}: VideoThumbnailEditorProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [thumbUrl, setThumbUrl] = useState(initialThumbUrl ?? null);
  const [currentTime, setCurrentTime] = useState(0);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const roundedTime = useMemo(() => Math.max(0, Number(currentTime.toFixed(2))), [currentTime]);

  async function handleCaptureCurrentFrame() {
    if (!videoUrl || !videoRef.current) return;
    setSaving(true);
    setFeedback(null);
    setError(null);
    try {
      const response = await authFetch(`/api/admin/videos/${encodeURIComponent(videoId)}/thumbnail`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seekSec: roundedTime }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok || typeof json.thumbUrl !== 'string') {
        throw new Error(json?.error ?? 'Failed to update thumbnail');
      }
      setThumbUrl(json.thumbUrl);
      onThumbnailUpdated?.(json.thumbUrl);
      setFeedback(`Thumbnail updated from ${formatTime(roundedTime)}`);
    } catch (captureError) {
      console.error('[video-thumbnail-editor] failed', captureError);
      setError(captureError instanceof Error ? captureError.message : 'Failed to update thumbnail');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={clsx('w-full max-w-sm space-y-3', className)}>
      {videoUrl ? (
        <div className="overflow-hidden rounded-card border border-hairline bg-black shadow-card">
          <video
            ref={videoRef}
            className="aspect-video w-full object-cover"
            src={videoUrl}
            poster={thumbUrl ?? undefined}
            controls
            playsInline
            preload="metadata"
            onTimeUpdate={(event) => {
              const nextTime = event.currentTarget.currentTime;
              if (Number.isFinite(nextTime)) {
                setCurrentTime(nextTime);
              }
            }}
          />
        </div>
      ) : (
        <div className="flex h-28 items-center justify-center rounded-card border border-dashed border-warning-border/60 bg-warning-bg/20 px-3 text-center text-xs text-warning">
          Missing video asset
        </div>
      )}

      <div className="rounded-card border border-surface-on-media-25 bg-surface px-3 py-3">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-text-muted">Thumbnail</p>
        <div className="mt-2 flex items-start gap-3">
          {thumbUrl ? (
            <Image
              src={thumbUrl}
              alt={title}
              width={96}
              height={54}
              className="rounded-card object-cover"
              style={{ width: 'auto', height: '54px' }}
              unoptimized
            />
          ) : (
            <div className="flex h-[54px] w-24 items-center justify-center rounded-card border border-dashed border-warning-border/60 bg-warning-bg/20 px-2 text-center text-[11px] text-warning">
              Missing
            </div>
          )}
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-xs text-text-secondary">
              Current frame: <span className="font-semibold text-text-primary">{formatTime(roundedTime)}</span>
            </p>
            <Button
              type="button"
              size="sm"
              className="w-full"
              disabled={!videoUrl || saving}
              onClick={handleCaptureCurrentFrame}
            >
              {saving ? 'Updating...' : 'Use current frame'}
            </Button>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-text-muted">
          Scrub the player, pause on the frame you want, then save it as the watch-page thumbnail.
        </p>
        {engineLabel ? <p className="mt-1 text-[11px] text-text-muted">{engineLabel}</p> : null}
        {feedback ? <p className="mt-2 text-xs font-semibold text-success">{feedback}</p> : null}
        {error ? <p className="mt-2 text-xs font-semibold text-error">{error}</p> : null}
      </div>
    </div>
  );
}
