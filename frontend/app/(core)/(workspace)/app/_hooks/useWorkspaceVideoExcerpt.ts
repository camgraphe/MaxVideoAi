'use client';

import { planH3RelightCopy } from '@/lib/h3-source-operations';
import { useCallback, useLayoutEffect, useRef } from 'react';
import type { EngineCaps, EngineInputField, Mode } from '@/types/engines';
import {
  getMediaExcerptLimits,
  validateVideoExcerptRange,
  type VideoExcerptRange,
} from '@/lib/video-excerpt';
import { requestVideoExcerpt, requestVideoExcerptSource } from '@/lib/client-video-excerpt';
import { settleReferenceAssetReservation, type ReferenceAsset } from '../_lib/workspace-assets';
import type { CommitInputAssetMutation, WorkspaceInputAssetState } from './useWorkspaceAssetState';
import { useWorkspaceAssetLifetime } from './useWorkspaceAssetLifetime';
import { useWorkspaceUploadOperation } from './useWorkspaceUploadOperation';

type Editor = {
  field: EngineInputField;
  index: number;
  original: ReferenceAsset;
  reservationId?: string;
  previewOperation?: ReturnType<ReturnType<typeof useWorkspaceUploadOperation>>;
  operation?: ReturnType<ReturnType<typeof useWorkspaceUploadOperation>>;
  current: () => boolean;
};

/** A selector session and its request own one exact source, model/mode and account generation. */
export function useWorkspaceVideoExcerpt({
  accountScope,
  engine,
  mode,
  inputAssets,
  commitInputAssetMutation,
}: {
  accountScope?: string | null;
  engine?: EngineCaps | null;
  mode: Mode;
  inputAssets: WorkspaceInputAssetState;
  commitInputAssetMutation: CommitInputAssetMutation;
}) {
  const valid = useWorkspaceAssetLifetime(accountScope);
  const beginUpload = useWorkspaceUploadOperation(accountScope, valid);
  const editor = useRef<Editor | null>(null);
  const retainedPreviews = useRef(new Set<string>());
  useLayoutEffect(() => {
    const retained = retainedPreviews.current;
    return () => {
      retained.forEach((url) => URL.revokeObjectURL(url));
      retained.clear();
    };
  }, [valid]);
  useLayoutEffect(() => {
    const inUse = new Set(
      Object.values(inputAssets).flatMap((entries) =>
        entries.flatMap((asset) => (asset ? [asset.previewUrl, asset.excerptSource?.previewUrl] : []))
      )
    );
    retainedPreviews.current.forEach((url) => {
      if (!inUse.has(url)) {
        URL.revokeObjectURL(url);
        retainedPreviews.current.delete(url);
      }
    });
  }, [inputAssets]);
  const videoOperation = engine?.activeVideoOperation;
  const compatibleCopy = videoOperation === 'flux-fast-edit' || videoOperation === 'h3-relight';
  const context = `${engine?.id ?? ''}:${mode}:${videoOperation ?? ''}`;
  const generation = useRef({ context, valid });
  if (generation.current.context !== context || generation.current.valid !== valid)
    generation.current = { context, valid };
  const epoch = generation.current;

  const restore = useCallback(
    (session: Editor, keepEditing = false, replacement = session.original) => {
      session.previewOperation?.cancel();
      session.previewOperation?.finish();
      session.operation?.cancel();
      session.operation?.finish();
      const original = { ...replacement, ...(keepEditing ? { excerptEditing: true } : {}) };
      commitInputAssetMutation((previous) => {
        if (previous[session.field.id]?.[session.index]?.url !== session.original.url)
          return { state: previous };
        return settleReferenceAssetReservation(
          previous,
          session.field,
          session.reservationId ?? session.original.id,
          original
        );
      });
    },
    [commitInputAssetMutation]
  );
  const cancel = useCallback(() => {
    const session = editor.current;
    editor.current = null;
    if (session) restore(session);
  }, [restore]);

  useLayoutEffect(() => () => cancel(), [cancel, epoch]);
  useLayoutEffect(() => {
    const session = editor.current;
    if (!session) return;
    const asset = inputAssets[session.field.id]?.[session.index];
    if (
      !session.current() ||
      asset?.id !== (session.reservationId ?? session.original.id) ||
      asset?.url !== session.original.url
    )
      cancel();
  }, [cancel, inputAssets, epoch]);

  const handleVideoExcerptEditorChange = useCallback(
    async (field: EngineInputField, index: number, open: boolean) => {
      if (!open) {
        const active = editor.current;
        if (generation.current === epoch && active?.field.id === field.id && active.index === index) cancel();
        return;
      }
      cancel();
      if (!valid() || generation.current !== epoch || !engine) return;
      const limits = getMediaExcerptLimits(engine, mode, field.id);
      if (limits?.sourceFieldId !== field.id) return;
      commitInputAssetMutation((previous) => {
        const source = previous[field.id]?.[index];
        if (
          !source ||
          (source.kind !== 'video' && source.kind !== 'audio') ||
          source.kind !== field.type ||
          source.status !== 'ready' ||
          !source.url ||
          !source.durationSec ||
          !(source.ref || source.assetId)
        )
          return { state: previous };
        editor.current = {
          field,
          index,
          original: source,
          current: () => valid() && generation.current === epoch,
        };
        const entries = [...previous[field.id]];
        entries[index] = { ...source, excerptEditing: true };
        return { state: { ...previous, [field.id]: entries } };
      });
      const session = editor.current;
      if (!session) return;
      const source = session.original;
      const original = source.excerptSource ?? {
        ref: source.ref ?? { type: 'asset' as const, assetId: source.assetId!, kind: source.kind as 'video' | 'audio' },
        previewUrl: source.previewUrl,
      };
      // Local uploads already hold the complete original. Gallery previews may be shorter;
      // remote originals always resolve through owned access, including expired signed URLs.
      if (original.previewUrl.startsWith('blob:')) return original.previewUrl;
      const operation = beginUpload();
      session.previewOperation = operation;
      try {
        const url = await requestVideoExcerptSource(original.ref, operation.request);
        if (editor.current !== session || !session.current()) throw new DOMException('Cancelled', 'AbortError');
        return url;
      } finally { operation.finish(); }
    },
    [beginUpload, cancel, commitInputAssetMutation, engine, epoch, mode, valid]
  );

  const handlePrepareVideoExcerpt = useCallback(
    async (field: EngineInputField, index: number, range: VideoExcerptRange) => {
      const session = editor.current;
      if (
        !session ||
        !session.current() ||
        session.field.id !== field.id ||
        session.index !== index ||
        !engine
      )
        throw new Error('Select the source again.');
      if (session.operation) throw new Error('Preparation already in progress.');
      const limits = getMediaExcerptLimits(engine, mode, field.id);
      if (!limits || limits.sourceFieldId !== field.id)
        throw new Error('This source workflow is unavailable.');
      const source = session.original;
      const original = source.excerptSource ?? {
        id: source.id,
        assetId: source.assetId,
        ref: source.ref ?? { type: 'asset' as const, assetId: source.assetId!, kind: source.kind as 'video' | 'audio' },
        url: source.url!,
        previewUrl: source.previewUrl,
        durationSec: source.durationSec!,
        name: source.name,
        type: source.type,
        size: source.size,
        width: source.width,
        height: source.height,
      };
      validateVideoExcerptRange(range, original.durationSec, limits);
      // Restoring a legal full original is a source change, not another encode.
      if (!compatibleCopy && source.excerptSource && range.startSec === 0 && range.endSec === original.durationSec) {
        editor.current = null;
        restore(session, false, {
          ...source,
          ...original,
          excerptSource: undefined,
          excerptRange: undefined,
          excerptEditing: undefined,
          status: 'ready',
          error: undefined,
        });
        return;
      }
      // An unchanged selection creates no new media, including exact fractional full ranges.
      const unchanged = source.excerptRange
        ? range.startSec === source.excerptRange.startSec && range.endSec === source.excerptRange.endSec
        : range.startSec === 0 && range.endSec === original.durationSec;
      if (unchanged && !compatibleCopy) {
        cancel();
        return;
      }
      const operation = beginUpload();
      session.operation = operation;
      session.reservationId = `excerpt_${crypto.randomUUID()}`;
      const reserved = commitInputAssetMutation((previous) => {
        const active = previous[field.id]?.[index];
        if (active?.id !== source.id || active?.url !== source.url)
          return { state: previous, accepted: false };
        const entries = [...previous[field.id]];
        entries[index] = { ...active, id: session.reservationId!, status: 'uploading', excerptEditing: true };
        return { state: { ...previous, [field.id]: entries }, accepted: true };
      });
      if (!reserved.accepted) {
        cancel();
        throw new Error('Select the source again.');
      }
      try {
        const result = await requestVideoExcerpt(
          { source: original.ref, engineId: engine.id, mode, fieldId: field.id, range,
            ...(videoOperation ? {operation: videoOperation} : {}),
            ...(videoOperation === 'h3-relight' ? {acceptedCopyDurationSec:planH3RelightCopy(range.endSec-range.startSec).durationSec} : {}) },
          operation.request
        );
        if (editor.current !== session || !session.current()) return;
        const asset = result.asset;
        const replacement: ReferenceAsset = {
          ...source,
          id: asset.id,
          assetId: asset.assetId ?? asset.id,
          ref: asset.ref,
          url: asset.url,
          previewUrl: asset.previewUrl ?? asset.url,
          durationSec: asset.durationSec,
          size: asset.size ?? source.size,
          type: asset.mime ?? (source.kind === 'audio' ? 'audio/wav' : 'video/mp4'),
          width: asset.width,
          height: asset.height,
          name: asset.name ?? source.name,
          status: 'ready',
          error: undefined,
          excerptEditing: undefined,
          excerptSource: original,
          excerptRange: { ...range },
        };
        if (original.previewUrl.startsWith('blob:')) retainedPreviews.current.add(original.previewUrl);
        commitInputAssetMutation((previous) =>
          settleReferenceAssetReservation(previous, field, session.reservationId!, replacement)
        );
        editor.current = null;
      } catch (error) {
        if (editor.current !== session || !session.current()) return;
        restore(session, true);
        session.operation = undefined;
        session.reservationId = undefined;
        throw error;
      } finally {
        operation.finish();
      }
    },
    [beginUpload, cancel, commitInputAssetMutation, engine, mode, restore, compatibleCopy, videoOperation]
  );
  return { handleVideoExcerptEditorChange, handlePrepareVideoExcerpt };
}
