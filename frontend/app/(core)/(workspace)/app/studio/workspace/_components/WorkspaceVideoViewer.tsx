'use client';

/* eslint-disable @next/next/no-img-element */

import { Film, Play } from 'lucide-react';
import styles from '../maxvideoai-editor.module.css';
import type { WorkspaceTimelineItem } from '../_lib/workspace-types';

type WorkspaceVideoViewerProps = {
  items: WorkspaceTimelineItem[];
  selectedItemId: string | null;
  onSelectItem: (itemId: string) => void;
};

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.max(0, Math.round(seconds % 60));
  return `${minutes}:${remaining.toString().padStart(2, '0')}`;
}

function isPlayableVideoUrl(url?: string | null): boolean {
  if (!url) return false;
  if (url.startsWith('blob:') || url.startsWith('data:video/')) return true;
  return /\.(mp4|webm|mov|m4v)(?:[?#].*)?$/i.test(url);
}

export function WorkspaceVideoViewer({ items, selectedItemId, onSelectItem }: WorkspaceVideoViewerProps) {
  const videoItems = items.filter((item) => item.track === 'video');
  const selectedItem = videoItems.find((item) => item.id === selectedItemId) ?? videoItems[0] ?? null;
  const playableUrl = isPlayableVideoUrl(selectedItem?.mediaUrl) ? selectedItem?.mediaUrl ?? null : null;
  const totalDuration = videoItems.reduce((duration, item) => duration + item.durationSec, 0);

  return (
    <section className={styles.videoViewerShell} aria-label="Montage video viewer">
      <div className={styles.viewerStage}>
        {playableUrl ? (
          <video
            key={selectedItem?.id}
            className={styles.viewerVideo}
            controls
            playsInline
            preload="metadata"
            poster={selectedItem?.thumbnailUrl ?? undefined}
            src={playableUrl}
          />
        ) : (
          <div className={styles.viewerEmpty}>
            <Film size={34} />
            <p>No playable clip selected</p>
            <span>Send a generated video to the timeline, then select it for preview.</span>
          </div>
        )}
      </div>

      <div className={styles.viewerFooter}>
        <div>
          <p>{selectedItem?.title ?? 'Montage viewer'}</p>
          <span>
            {videoItems.length} clips · {formatDuration(totalDuration)}
          </span>
        </div>
        <div className={styles.viewerStrip}>
          {videoItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`${styles.viewerStripClip} ${item.id === selectedItem?.id ? styles.viewerStripClipActive : ''}`}
              onClick={() => onSelectItem(item.id)}
            >
              {item.thumbnailUrl ? <img src={item.thumbnailUrl} alt="" /> : <Play size={14} />}
              <span>{formatDuration(item.startSec)}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
