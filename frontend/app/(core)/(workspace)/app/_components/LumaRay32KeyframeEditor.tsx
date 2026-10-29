'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  Dispatch,
  DragEvent,
  MouseEvent,
  PointerEvent as ReactPointerEvent,
  SetStateAction,
} from 'react';
import type { AssetFieldConfig, AssetUploadMeta } from '@/components/Composer';
import type { EngineCaps, EngineInputField } from '@/types/engines';
import {
  DEFAULT_VISIBLE_KEYFRAME_COUNT,
  findBestNewFrameIndex,
  findFirstUnusedAssetSlot,
  formatIndexes,
  formatKeyframeSlots,
  getFrameIndexFromClientX,
  getPayloadIndexes,
  getUniqueFrameIndexForSlot,
  normalizeKeyframeSlots,
  parseKeyframeSlots,
  type KeyframeSlot,
} from '../_lib/luma-ray32-keyframes';
import type { ReferenceAsset } from '../_lib/workspace-assets';
import type { FormState } from '../_lib/workspace-form-state';
import { LumaRay32KeyframeTimeline } from './LumaRay32KeyframeTimeline';

const PROVIDER_KEYFRAME_SLOT_LIMIT = 64;
const COMPACT_TIMELINE_SLOT_WIDTH = 122;
const MIN_TIMELINE_WIDTH = 680;

export type LumaRay32KeyframeEditorProps = {
  engine: EngineCaps;
  form: FormState;
  setForm: Dispatch<SetStateAction<FormState | null>>;
  assetFields: AssetFieldConfig[];
  inputAssets: Record<string, (ReferenceAsset | null)[]>;
  onAssetAdd: (field: EngineInputField, file: File, slotIndex?: number, meta?: AssetUploadMeta) => void;
  onAssetRemove: (field: EngineInputField, index: number) => void;
  onOpenLibrary: (field: EngineInputField, slotIndex: number) => void;
  onNotice: (message: string) => void;
  disabledReason?: string | null;
  uiLocale?: string;
};

function getFieldEntry(assetFields: AssetFieldConfig[], fieldId: string): AssetFieldConfig | null {
  return assetFields.find((entry) => entry.field.id === fieldId) ?? null;
}

export function LumaRay32KeyframeEditor({
  engine,
  form,
  setForm,
  assetFields,
  inputAssets,
  onAssetAdd,
  onAssetRemove,
  onOpenLibrary,
  onNotice,
  disabledReason,
  uiLocale = 'en',
}: LumaRay32KeyframeEditorProps) {
  const isFluxMax = engine.id.startsWith('flux-3');
  const slotIndexesFieldId = isFluxMax ? 'keyframe_slot_indexes' : 'edit_keyframe_slot_indexes';
  const indexesFieldId = isFluxMax ? 'keyframe_indexes' : 'edit_keyframe_indexes';
  const imageFieldId = isFluxMax ? 'reference_image_urls' : 'edit_keyframe_urls';
  const keyframesLabel = uiLocale === 'fr' ? 'Images clés' : uiLocale === 'es' ? 'Fotogramas clave' : 'Keyframes';
  const [selectedSlotIndex, setSelectedSlotIndex] = useState(0);
  const [draggingAssetSlot, setDraggingAssetSlot] = useState<number | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const keyframeSlotRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const sourceVideoEntry = useMemo(() => getFieldEntry(assetFields, 'video_url'), [assetFields]);
  const guideFrameEntry = useMemo(() => getFieldEntry(assetFields, 'start_image_url'), [assetFields]);
  const keyframeEntry = useMemo(() => getFieldEntry(assetFields, imageFieldId), [assetFields, imageFieldId]);
  const selectedSourceDuration = sourceVideoEntry
    ? inputAssets[sourceVideoEntry.field.id]?.find(asset => asset?.kind === 'video' && asset.status === 'ready')?.durationSec
    : undefined;
  const sourceDuration = typeof selectedSourceDuration === 'number' && Number.isFinite(selectedSourceDuration)
    && selectedSourceDuration > 0 && selectedSourceDuration <= 18 ? selectedSourceDuration : undefined;
  const durationSec = isFluxMax ? Math.max(5, Math.min(20, Number(form.durationOption ?? form.durationSec) || 5))
    : sourceDuration ?? (form.durationOption === '10s' || form.durationOption === 10 || form.durationSec === 10 ? 10 : 5);
  const fps = isFluxMax ? 24 : Number.isFinite(form.fps) ? Math.max(1, Math.trunc(form.fps)) : 24;
  const maxFrameIndex = Math.max(1, Math.floor(durationSec * fps) - (isFluxMax ? 0 : 1));
  const maxKeyframeSlots = Math.min(
    isFluxMax ? 10 : PROVIDER_KEYFRAME_SLOT_LIMIT,
    maxFrameIndex + 1,
    Math.max(1, keyframeEntry?.field.maxCount ?? PROVIDER_KEYFRAME_SLOT_LIMIT)
  );
  const guideFrameAssets = useMemo(
    () => (guideFrameEntry ? inputAssets[guideFrameEntry.field.id] ?? [] : []),
    [guideFrameEntry, inputAssets]
  );
  const keyframeAssets = useMemo(
    () => (keyframeEntry ? inputAssets[keyframeEntry.field.id] ?? [] : []),
    [inputAssets, keyframeEntry]
  );
  const hasGuideFrame = guideFrameAssets.some(Boolean);
  const rawSlotIndexes =
    form.extraInputValues[slotIndexesFieldId] ?? form.extraInputValues[indexesFieldId];
  const keyframeSlots = useMemo(
    () => parseKeyframeSlots(rawSlotIndexes, keyframeAssets, maxKeyframeSlots, maxFrameIndex),
    [keyframeAssets, maxFrameIndex, maxKeyframeSlots, rawSlotIndexes]
  );
  const selectedSlot = keyframeSlots[Math.min(selectedSlotIndex, Math.max(0, keyframeSlots.length - 1))] ?? null;
  const canAddKeyframe = keyframeSlots.length < maxKeyframeSlots;
  const canRemoveKeyframe = keyframeSlots.length > 0;
  const timelineNeedsScroll = keyframeSlots.length > DEFAULT_VISIBLE_KEYFRAME_COUNT;
  const timelineWidth = timelineNeedsScroll
    ? Math.max(MIN_TIMELINE_WIDTH, keyframeSlots.length * COMPACT_TIMELINE_SLOT_WIDTH)
    : undefined;
  const keyframesTimelineDisabledReason = hasGuideFrame ? 'Remove the guide frame to use multiple keyframes.' : null;
  const keyframesUploadDisabledReason = keyframesTimelineDisabledReason ?? disabledReason;

  const writeExtraValues = useCallback(
    (updater: (current: Record<string, unknown>) => Record<string, unknown>) => {
      setForm((current) => {
        if (!current) return current;
        return { ...current, extraInputValues: updater(current.extraInputValues) };
      });
    },
    [setForm]
  );

  const syncKeyframeValues = useCallback(
    (nextSlots: KeyframeSlot[], assets: (ReferenceAsset | null)[]) => {
      const normalizedSlots = normalizeKeyframeSlots(nextSlots, maxKeyframeSlots, maxFrameIndex);
      const payloadIndexes = getPayloadIndexes(normalizedSlots, assets);
      writeExtraValues((current) => {
        const next: Record<string, unknown> = {
          ...current,
          [slotIndexesFieldId]: formatKeyframeSlots(normalizedSlots),
        };
        if (payloadIndexes.length) {
          next[indexesFieldId] = formatIndexes(payloadIndexes);
        } else {
          delete next[indexesFieldId];
        }
        return next;
      });
    },
    [maxFrameIndex, maxKeyframeSlots, writeExtraValues, indexesFieldId, slotIndexesFieldId]
  );

  useEffect(() => {
    if (!keyframeEntry) return;
    const payloadIndexes = getPayloadIndexes(keyframeSlots, keyframeAssets);
    const nextPayloadValue = payloadIndexes.length ? formatIndexes(payloadIndexes) : undefined;
    const nextSlotValue = formatKeyframeSlots(keyframeSlots);
    const currentPayloadValue = form.extraInputValues[indexesFieldId];
    const currentSlotValue = form.extraInputValues[slotIndexesFieldId];
    if (currentPayloadValue === nextPayloadValue && currentSlotValue === nextSlotValue) return;
    writeExtraValues((current) => {
      const next: Record<string, unknown> = { ...current, [slotIndexesFieldId]: nextSlotValue };
      if (nextPayloadValue) {
        next[indexesFieldId] = nextPayloadValue;
      } else {
        delete next[indexesFieldId];
      }
      return next;
    });
  }, [form.extraInputValues, keyframeAssets, keyframeEntry, keyframeSlots, writeExtraValues, indexesFieldId, slotIndexesFieldId]);

  useEffect(() => {
    if (selectedSlotIndex < keyframeSlots.length) return;
    setSelectedSlotIndex(Math.max(0, keyframeSlots.length - 1));
  }, [keyframeSlots.length, selectedSlotIndex]);

  useEffect(() => {
    if (!timelineNeedsScroll || !selectedSlot) return;
    keyframeSlotRefs.current[selectedSlot.assetSlot]?.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
    });
  }, [selectedSlot, timelineNeedsScroll]);

  const handleTimelineClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (!selectedSlot) return;
      const rect = timelineRef.current?.getBoundingClientRect();
      if (!rect) return;
      const frameIndex = getUniqueFrameIndexForSlot(
        keyframeSlots,
        selectedSlot.assetSlot,
        getFrameIndexFromClientX(event.clientX, rect, maxFrameIndex),
        maxFrameIndex
      );
      if (frameIndex == null) return;
      const nextSlots = keyframeSlots.map((slot) =>
        slot.assetSlot === selectedSlot.assetSlot ? { ...slot, frameIndex } : slot
      );
      syncKeyframeValues(nextSlots, keyframeAssets);
    },
    [keyframeAssets, keyframeSlots, maxFrameIndex, selectedSlot, syncKeyframeValues]
  );

  const updateKeyframeFrameFromPointer = useCallback(
    (assetSlot: number, clientX: number) => {
      const rect = timelineRef.current?.getBoundingClientRect();
      if (!rect) return;
      const frameIndex = getUniqueFrameIndexForSlot(
        keyframeSlots,
        assetSlot,
        getFrameIndexFromClientX(clientX, rect, maxFrameIndex),
        maxFrameIndex
      );
      if (frameIndex == null) return;
      const nextSlots = keyframeSlots.map((slot) =>
        slot.assetSlot === assetSlot ? { ...slot, frameIndex } : slot
      );
      syncKeyframeValues(nextSlots, keyframeAssets);
    },
    [keyframeAssets, keyframeSlots, maxFrameIndex, syncKeyframeValues]
  );

  const handleKeyframePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>, slot: KeyframeSlot, slotIndex: number) => {
      if (keyframesTimelineDisabledReason) return;
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      setSelectedSlotIndex(slotIndex);
      setDraggingAssetSlot(slot.assetSlot);
      updateKeyframeFrameFromPointer(slot.assetSlot, event.clientX);
    },
    [keyframesTimelineDisabledReason, updateKeyframeFrameFromPointer]
  );

  const handleKeyframeMouseDown = useCallback(
    (event: MouseEvent<HTMLButtonElement>, slot: KeyframeSlot, slotIndex: number) => {
      if (keyframesTimelineDisabledReason) return;
      event.preventDefault();
      event.stopPropagation();
      setSelectedSlotIndex(slotIndex);
      setDraggingAssetSlot(slot.assetSlot);
      updateKeyframeFrameFromPointer(slot.assetSlot, event.clientX);
    },
    [keyframesTimelineDisabledReason, updateKeyframeFrameFromPointer]
  );

  const handleKeyframePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>, slot: KeyframeSlot) => {
      if (draggingAssetSlot !== slot.assetSlot) return;
      event.preventDefault();
      event.stopPropagation();
      updateKeyframeFrameFromPointer(slot.assetSlot, event.clientX);
    },
    [draggingAssetSlot, updateKeyframeFrameFromPointer]
  );

  const handleKeyframePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>, slot: KeyframeSlot) => {
      if (draggingAssetSlot !== slot.assetSlot) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      setDraggingAssetSlot(null);
    },
    [draggingAssetSlot]
  );

  useEffect(() => {
    if (draggingAssetSlot === null) return undefined;
    const handleMove = (event: globalThis.PointerEvent | globalThis.MouseEvent) => {
      event.preventDefault();
      updateKeyframeFrameFromPointer(draggingAssetSlot, event.clientX);
    };
    const handleEnd = () => {
      setDraggingAssetSlot(null);
    };
    window.addEventListener('pointermove', handleMove, { passive: false });
    window.addEventListener('pointerup', handleEnd);
    window.addEventListener('pointercancel', handleEnd);
    window.addEventListener('mousemove', handleMove, { passive: false });
    window.addEventListener('mouseup', handleEnd);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleEnd);
      window.removeEventListener('pointercancel', handleEnd);
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
    };
  }, [draggingAssetSlot, updateKeyframeFrameFromPointer]);

  const handleAddKeyframe = useCallback(() => {
    const assetSlot = findFirstUnusedAssetSlot(keyframeSlots, maxKeyframeSlots);
    if (assetSlot == null) return;
    const nextSlots = [
      ...keyframeSlots,
      {
        assetSlot,
        frameIndex: findBestNewFrameIndex(keyframeSlots, maxFrameIndex),
      },
    ];
    syncKeyframeValues(nextSlots, keyframeAssets);
    setSelectedSlotIndex(nextSlots.length - 1);
  }, [keyframeAssets, keyframeSlots, maxFrameIndex, maxKeyframeSlots, syncKeyframeValues]);

  const handleRemoveKeyframe = useCallback(
    (slotIndex: number) => {
      if (!canRemoveKeyframe) return;
      const slot = keyframeSlots[slotIndex];
      if (!slot || !keyframeEntry) return;
      const nextSlots = keyframeSlots.filter((_, index) => index !== slotIndex);
      const nextAssets = keyframeAssets.map((asset, assetSlot) => (assetSlot === slot.assetSlot ? null : asset));
      if (keyframeAssets[slot.assetSlot]) {
        onAssetRemove(keyframeEntry.field, slot.assetSlot);
      }
      syncKeyframeValues(nextSlots, nextAssets);
      setSelectedSlotIndex(Math.max(0, Math.min(slotIndex, nextSlots.length - 1)));
    },
    [canRemoveKeyframe, keyframeAssets, keyframeEntry, keyframeSlots, onAssetRemove, syncKeyframeValues]
  );

  const handleKeyframeFile = useCallback(
    (slot: KeyframeSlot, file: File | null | undefined) => {
      if (!file || !keyframeEntry) return;
      if (keyframesUploadDisabledReason) {
        onNotice(keyframesUploadDisabledReason);
        return;
      }
      if (!file.type.startsWith('image/')) {
        onNotice('Drop an image file for this keyframe.');
        return;
      }
      onAssetAdd(keyframeEntry.field, file, slot.assetSlot);
    },
    [keyframeEntry, keyframesUploadDisabledReason, onAssetAdd, onNotice]
  );

  const handleKeyframeDrop = useCallback(
    (event: DragEvent<HTMLButtonElement>, slot: KeyframeSlot) => {
      event.preventDefault();
      event.stopPropagation();
      handleKeyframeFile(slot, event.dataTransfer.files?.[0] ?? null);
    },
    [handleKeyframeFile]
  );

  const handleOpenKeyframeLibrary = useCallback(
    (slot: KeyframeSlot) => {
      if (!keyframeEntry) return;
      if (keyframesUploadDisabledReason) {
        onNotice(keyframesUploadDisabledReason);
        return;
      }
      onOpenLibrary(keyframeEntry.field, slot.assetSlot);
    },
    [keyframeEntry, keyframesUploadDisabledReason, onNotice, onOpenLibrary]
  );

  if ((!isFluxMax && !sourceVideoEntry) || !keyframeEntry) return null;

  const filledKeyframeCount = keyframeSlots.filter((slot) => Boolean(keyframeAssets[slot.assetSlot])).length;

  return (
    <section data-testid="video-keyframe-editor" data-engine-id={engine.id} className="space-y-4 rounded-[24px] border border-border/60 bg-surface-2/70 p-4 dark:border-white/[0.08] dark:bg-white/[0.035]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-text-primary">{isFluxMax ? `${engine.label} · ${keyframesLabel}` : 'Ray 3.2 Modify'}</p>
          <p className="text-xs text-text-muted">{isFluxMax ? `${durationSec}s @ ${fps}fps`
            : sourceDuration != null ? `${uiLocale === 'fr' ? 'Vidéo source' : uiLocale === 'es' ? 'Vídeo original' : 'Source video'} · ${sourceDuration}s`
            : uiLocale === 'fr' ? 'Importez une vidéo pour régler les images clés' : uiLocale === 'es' ? 'Importa un vídeo para ajustar los fotogramas clave' : 'Import a video to set keyframes'}</p>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-micro text-text-muted">
          <span>{filledKeyframeCount}/{keyframeSlots.length} {isFluxMax ? keyframesLabel : 'modified'}</span>
          <span className="h-1 w-1 rounded-full bg-text-muted/45" />
          <span>{maxKeyframeSlots} max</span>
          <span className="h-1 w-1 rounded-full bg-text-muted/45" />
          <span>f0-f{maxFrameIndex}</span>
        </div>
      </div>

      <LumaRay32KeyframeTimeline
        uiLocale={isFluxMax ? uiLocale : undefined}
        title={isFluxMax ? keyframesLabel : undefined}
        canAddKeyframe={canAddKeyframe}
        canRemoveKeyframe={canRemoveKeyframe}
        filledKeyframeCount={filledKeyframeCount}
        fps={fps}
        keyframeAssets={keyframeAssets}
        keyframeSlotRefs={keyframeSlotRefs}
        keyframeSlots={keyframeSlots}
        keyframesTimelineDisabledReason={keyframesTimelineDisabledReason}
        keyframesUploadDisabledReason={keyframesUploadDisabledReason ?? null}
        maxFrameIndex={maxFrameIndex}
        maxKeyframeSlots={maxKeyframeSlots}
        selectedSlot={selectedSlot}
        timelineRef={timelineRef}
        timelineWidth={timelineWidth}
        onAddKeyframe={handleAddKeyframe}
        onDrop={handleKeyframeDrop}
        onKeyframeMouseDown={handleKeyframeMouseDown}
        onKeyframePointerDown={handleKeyframePointerDown}
        onKeyframePointerMove={handleKeyframePointerMove}
        onKeyframePointerUp={handleKeyframePointerUp}
        onOpenLibrary={handleOpenKeyframeLibrary}
        onRemoveKeyframe={handleRemoveKeyframe}
        onSelectSlot={setSelectedSlotIndex}
        onTimelineClick={handleTimelineClick}
        onUploadDisabled={onNotice}
      />
    </section>
  );
}
