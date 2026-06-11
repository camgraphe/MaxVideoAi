'use client';
/* eslint-disable @next/next/no-img-element */

import clsx from 'clsx';
import type {
  DragEvent,
  MouseEvent,
  MutableRefObject,
  PointerEvent as ReactPointerEvent,
} from 'react';
import { ImagePlus, Library, Lock, X } from 'lucide-react';
import { formatFramecode, getTimelineLeft, type KeyframeSlot } from '../_lib/luma-ray32-keyframes';
import type { ReferenceAsset } from '../_lib/workspace-assets';

type LumaRay32KeyframeTimelineProps = {
  canAddKeyframe: boolean;
  canRemoveKeyframe: boolean;
  filledKeyframeCount: number;
  fps: number;
  keyframeAssets: (ReferenceAsset | null)[];
  keyframeSlotRefs: MutableRefObject<Record<number, HTMLDivElement | null>>;
  keyframeSlots: KeyframeSlot[];
  keyframesTimelineDisabledReason: string | null;
  keyframesUploadDisabledReason: string | null;
  maxFrameIndex: number;
  maxKeyframeSlots: number;
  selectedSlot: KeyframeSlot | null;
  timelineRef: MutableRefObject<HTMLDivElement | null>;
  timelineWidth?: number;
  onAddKeyframe: () => void;
  onDrop: (event: DragEvent<HTMLButtonElement>, slot: KeyframeSlot) => void;
  onKeyframeMouseDown: (event: MouseEvent<HTMLButtonElement>, slot: KeyframeSlot, slotIndex: number) => void;
  onKeyframePointerDown: (event: ReactPointerEvent<HTMLButtonElement>, slot: KeyframeSlot, slotIndex: number) => void;
  onKeyframePointerMove: (event: ReactPointerEvent<HTMLButtonElement>, slot: KeyframeSlot) => void;
  onKeyframePointerUp: (event: ReactPointerEvent<HTMLButtonElement>, slot: KeyframeSlot) => void;
  onOpenLibrary: (slot: KeyframeSlot) => void;
  onRemoveKeyframe: (slotIndex: number) => void;
  onSelectSlot: (slotIndex: number) => void;
  onTimelineClick: (event: MouseEvent<HTMLDivElement>) => void;
  onUploadDisabled: (message: string) => void;
};

export function LumaRay32KeyframeTimeline({
  canAddKeyframe,
  canRemoveKeyframe,
  filledKeyframeCount,
  fps,
  keyframeAssets,
  keyframeSlotRefs,
  keyframeSlots,
  keyframesTimelineDisabledReason,
  keyframesUploadDisabledReason,
  maxFrameIndex,
  maxKeyframeSlots,
  selectedSlot,
  timelineRef,
  timelineWidth,
  onAddKeyframe,
  onDrop,
  onKeyframeMouseDown,
  onKeyframePointerDown,
  onKeyframePointerMove,
  onKeyframePointerUp,
  onOpenLibrary,
  onRemoveKeyframe,
  onSelectSlot,
  onTimelineClick,
  onUploadDisabled,
}: LumaRay32KeyframeTimelineProps) {
  return (
    <div className="rounded-[24px] bg-surface/80 p-4 dark:bg-black/10">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-micro text-text-muted">Modify keyframes</span>
          <span className="rounded-full bg-surface-3 px-2 py-1 text-[10px] font-semibold text-text-muted dark:bg-white/[0.06]">
            {filledKeyframeCount}/{keyframeSlots.length}
          </span>
          <span className="rounded-full bg-surface-3 px-2 py-1 text-[10px] font-semibold text-text-muted dark:bg-white/[0.06]">
            {maxKeyframeSlots} max
          </span>
        </div>
        <button
          type="button"
          className="inline-flex h-8 items-center rounded-full border border-border bg-surface px-3 text-[11px] font-semibold text-text-primary transition hover:border-text-primary/40 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/[0.08] dark:bg-white/[0.06]"
          onClick={onAddKeyframe}
          disabled={!canAddKeyframe || Boolean(keyframesTimelineDisabledReason)}
        >
          Add keyframe
        </button>
      </div>

      <div
        className={clsx(
          'overflow-x-auto overflow-y-hidden rounded-[24px] bg-surface-3/80 p-3 overscroll-x-contain dark:bg-white/[0.035]',
          keyframesTimelineDisabledReason ? 'opacity-60' : ''
        )}
      >
        <div
          ref={timelineRef}
          className="relative min-h-[250px] rounded-[22px] bg-surface-2 px-8 py-8 dark:bg-black/10"
          style={{ minWidth: timelineWidth }}
        >
          <div
            className="absolute left-8 right-8 top-[38px] h-10 rounded-full bg-border/45 shadow-inner dark:bg-white/[0.08]"
            onClick={keyframesTimelineDisabledReason ? undefined : onTimelineClick}
            role="presentation"
          />
          <div className="absolute left-8 right-8 top-[26px] h-px border-t border-dotted border-text-muted/35" />
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
            <span
              key={ratio}
              className="absolute top-[24px] h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-text-muted/35"
              style={{ left: `${10 + ratio * 80}%` }}
            />
          ))}

          <span className="absolute left-8 top-[86px] text-[11px] font-medium text-text-muted">
            {formatFramecode(0, fps)}
          </span>
          <span className="absolute right-8 top-[86px] text-[11px] font-medium text-text-muted">
            {formatFramecode(maxFrameIndex, fps)}
          </span>

          {selectedSlot ? (
            <div
              className="pointer-events-none absolute bottom-5 top-2 z-20 w-px bg-text-primary/35"
              style={{ left: getTimelineLeft(selectedSlot.frameIndex, maxFrameIndex) }}
            >
              <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1 rounded-full bg-surface px-2 py-0.5 text-[11px] font-semibold text-text-primary shadow-sm dark:bg-black/70">
                {formatFramecode(selectedSlot.frameIndex, fps)}
              </span>
            </div>
          ) : null}

          {keyframeSlots.map((slot, index) => {
            const left = getTimelineLeft(slot.frameIndex, maxFrameIndex);
            const active = slot.assetSlot === selectedSlot?.assetSlot;
            const slotAsset = keyframeAssets[slot.assetSlot] ?? null;
            const locked = Boolean(keyframesUploadDisabledReason) && !slotAsset;
            return (
              <div
                ref={(element) => {
                  keyframeSlotRefs.current[slot.assetSlot] = element;
                }}
                key={`timeline-slot-${slot.assetSlot}`}
                className="absolute top-[34px] z-30 flex w-[100px] -translate-x-1/2 flex-col items-center"
                style={{ left }}
              >
                <button
                  type="button"
                  className={clsx(
                    'relative z-10 flex h-7 w-7 touch-none cursor-grab items-center justify-center overflow-hidden rounded-[8px] border text-[10px] font-semibold shadow-sm transition active:cursor-grabbing',
                    active
                      ? 'border-text-primary bg-text-primary text-surface'
                      : slotAsset
                        ? 'border-white/80 bg-surface text-text-primary'
                        : 'border-border bg-surface text-text-muted hover:border-text-primary/40 hover:text-text-primary'
                  )}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelectSlot(index);
                  }}
                  onPointerDown={(event) => onKeyframePointerDown(event, slot, index)}
                  onPointerMove={(event) => onKeyframePointerMove(event, slot)}
                  onPointerUp={(event) => onKeyframePointerUp(event, slot)}
                  onPointerCancel={(event) => onKeyframePointerUp(event, slot)}
                  onMouseDown={(event) => onKeyframeMouseDown(event, slot, index)}
                  aria-label={`Select keyframe ${index + 1}`}
                  title="Drag to adjust timing"
                >
                  {slotAsset?.kind === 'image' ? (
                    <img src={slotAsset.previewUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    index + 1
                  )}
                </button>
                <span className="h-[42px] w-px bg-border dark:bg-white/12" />
                <button
                  type="button"
                  className={clsx(
                    'group relative flex h-[86px] w-[82px] items-center justify-center overflow-hidden rounded-[14px] border text-text-muted shadow-sm transition',
                    active
                      ? 'border-text-primary/55 bg-surface'
                      : 'border-border/70 bg-surface/85 hover:border-text-primary/35 hover:text-text-primary dark:border-white/[0.08] dark:bg-white/[0.045]',
                    locked && 'cursor-not-allowed opacity-75'
                  )}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelectSlot(index);
                    if (keyframesUploadDisabledReason) {
                      onUploadDisabled(keyframesUploadDisabledReason);
                      return;
                    }
                    onOpenLibrary(slot);
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => onDrop(event, slot)}
                  aria-label={`Open library or upload keyframe ${index + 1}`}
                  title={keyframesUploadDisabledReason ?? `Open library or upload keyframe at ${formatFramecode(slot.frameIndex, fps)}`}
                >
                  {slotAsset?.kind === 'image' ? (
                    <img src={slotAsset.previewUrl} alt={slotAsset.name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface text-text-muted transition group-hover:border-text-primary/30 group-hover:text-text-primary dark:border-white/12 dark:bg-white/[0.05]">
                      {locked ? <Lock className="h-4 w-4" aria-hidden /> : <ImagePlus className="h-5 w-5" aria-hidden />}
                    </span>
                  )}
                  {slotAsset?.status === 'uploading' ? (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/55 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-white">
                      Uploading
                    </span>
                  ) : null}
                  {slotAsset?.status === 'error' ? (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/65 px-2 text-center text-[10px] font-semibold text-white">
                      Upload failed
                    </span>
                  ) : null}
                </button>
                <div className="mt-2 flex items-center justify-center gap-1.5">
                  <button
                    type="button"
                    className="rounded-full bg-surface px-2 py-1 text-[10px] font-semibold text-text-muted transition hover:text-text-primary dark:bg-white/[0.06]"
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelectSlot(index);
                    }}
                  >
                    f{slot.frameIndex}
                  </button>
                  <button
                    type="button"
                    className="rounded-full bg-surface p-1.5 text-text-muted transition hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white/[0.06]"
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpenLibrary(slot);
                    }}
                    disabled={Boolean(keyframesUploadDisabledReason)}
                    aria-label={`Open library for keyframe ${index + 1}`}
                  >
                    <Library className="h-3.5 w-3.5" aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="rounded-full bg-surface p-1.5 text-text-muted transition hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white/[0.06]"
                    onClick={(event) => {
                      event.stopPropagation();
                      onRemoveKeyframe(index);
                    }}
                    disabled={!canRemoveKeyframe || Boolean(keyframesTimelineDisabledReason)}
                    aria-label={`Remove keyframe ${index + 1}`}
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
