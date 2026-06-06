'use client';

/* eslint-disable @next/next/no-img-element */

import { Lock, Music2, Play, Scissors, SkipBack, SkipForward, Volume2, WandSparkles } from 'lucide-react';
import type { DragEvent, KeyboardEvent, MouseEvent } from 'react';
import styles from '../maxvideoai-editor.module.css';
import type { WorkspaceTimelineItem, WorkspaceTimelineTrack } from '../_lib/workspace-types';

const TRACKS: Array<{ id: WorkspaceTimelineTrack; label: string; icon: React.ReactNode }> = [
  { id: 'video', label: 'Video', icon: <Play size={14} /> },
  { id: 'music', label: 'Music', icon: <Music2 size={14} /> },
  { id: 'voiceover', label: 'Voice Over', icon: <Volume2 size={14} /> },
  { id: 'sfx', label: 'SFX', icon: <WandSparkles size={14} /> },
];

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.max(0, Math.round(seconds % 60));
  return `${minutes}:${remaining.toString().padStart(2, '0')}`;
}

function TimelineClip({
  item,
  index,
  isSelected,
  total,
  onCut,
  onMove,
  onReorder,
  onSelect,
}: {
  item: WorkspaceTimelineItem;
  index: number;
  isSelected: boolean;
  total: number;
  onCut: (itemId: string) => void;
  onMove: (itemId: string, direction: -1 | 1) => void;
  onReorder: (itemId: string, targetItemId: string) => void;
  onSelect: (itemId: string) => void;
}) {
  const width = Math.max(138, item.durationSec * 34);
  const handleActionClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
  };
  return (
    <div
      className={`${styles.timelineClip} ${isSelected ? styles.timelineClipSelected : ''}`}
      style={{ width }}
      draggable
      role="button"
      tabIndex={0}
      onClick={() => onSelect(item.id)}
      onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect(item.id);
        }
      }}
      onDragStart={(event: DragEvent<HTMLDivElement>) => {
        event.dataTransfer.setData('application/x-maxvideoai-timeline-item', item.id);
        event.dataTransfer.effectAllowed = 'move';
      }}
      onDragOver={(event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
      }}
      onDrop={(event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        const draggedItemId = event.dataTransfer.getData('application/x-maxvideoai-timeline-item');
        if (draggedItemId) onReorder(draggedItemId, item.id);
      }}
    >
      {item.thumbnailUrl ? <img src={item.thumbnailUrl} alt="" /> : null}
      <div>
        <strong>{item.title}</strong>
        <span>{formatDuration(item.durationSec)}</span>
      </div>
      <div className={styles.clipActions}>
        <button type="button" onClick={(event) => { handleActionClick(event); onMove(item.id, -1); }} disabled={index === 0} aria-label="Move clip left">
          <SkipBack size={12} />
        </button>
        <button type="button" onClick={(event) => { handleActionClick(event); onMove(item.id, 1); }} disabled={index === total - 1} aria-label="Move clip right">
          <SkipForward size={12} />
        </button>
        <button type="button" onClick={(event) => { handleActionClick(event); onCut(item.id); }} disabled={item.durationSec <= 1} aria-label="Cut clip">
          <Scissors size={12} />
        </button>
      </div>
    </div>
  );
}

type WorkspaceTimelineProps = {
  items: WorkspaceTimelineItem[];
  selectedItemId: string | null;
  onCutItem: (itemId: string) => void;
  onMoveItem: (itemId: string, direction: -1 | 1) => void;
  onReorderItem: (itemId: string, targetItemId: string) => void;
  onSelectItem: (itemId: string) => void;
};

export function WorkspaceTimeline({
  items,
  selectedItemId,
  onCutItem,
  onMoveItem,
  onReorderItem,
  onSelectItem,
}: WorkspaceTimelineProps) {
  const totalDuration = items.filter((item) => item.track === 'video').reduce((duration, item) => duration + item.durationSec, 0);
  const selectedItem = items.find((item) => item.id === selectedItemId) ?? null;
  return (
    <section className={styles.timelinePanel} aria-label="Video timeline">
      <div className={styles.timelineTopbar}>
        <div>
          <p>Montage timeline</p>
          <span>{selectedItem ? `Selected ${selectedItem.title}` : `Project duration ${formatDuration(totalDuration || 28)}`}</span>
        </div>
        <div className={styles.timelineTransport}>
          <button type="button" aria-label="Previous">
            <SkipBack size={15} />
          </button>
          <button type="button" aria-label="Play">
            <Play size={15} />
          </button>
          <button type="button" aria-label="Next">
            <SkipForward size={15} />
          </button>
          <button
            type="button"
            className={styles.timelineToolButton}
            disabled={!selectedItem || selectedItem.durationSec <= 1}
            onClick={() => selectedItem && onCutItem(selectedItem.id)}
            aria-label="Cut selected clip"
          >
            <Scissors size={15} />
          </button>
        </div>
      </div>
      <div className={styles.timelineRuler}>
        {Array.from({ length: 9 }, (_, index) => (
          <span key={index}>{formatDuration(index * 4)}</span>
        ))}
      </div>
      <div className={styles.timelineTracks}>
        {TRACKS.map((track) => {
          const trackItems = items.filter((item) => item.track === track.id);
          return (
            <div key={track.id} className={styles.timelineTrack}>
              <div className={styles.trackLabel}>
                {track.icon}
                <span>{track.label}</span>
                <Lock size={12} />
              </div>
              <div className={styles.trackLane}>
                {trackItems.length ? (
                  trackItems.map((item, index) => (
                    <TimelineClip
                      key={item.id}
                      item={item}
                      index={index}
                      isSelected={item.id === selectedItemId}
                      total={trackItems.length}
                      onCut={onCutItem}
                      onMove={onMoveItem}
                      onReorder={onReorderItem}
                      onSelect={onSelectItem}
                    />
                  ))
                ) : (
                  <span className={styles.trackEmpty}>Drop generated outputs here</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
