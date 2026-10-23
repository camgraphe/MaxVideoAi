'use client';

import { useCallback, useLayoutEffect, useRef } from 'react';
import type { EngineCaps, EngineInputField, Mode } from '@/types/engines';
import {
  getVideoExcerptLimits,
  validateVideoExcerptRange,
  type VideoExcerptRange,
} from '@/lib/video-excerpt';
import { isVideoSourceWorkflow } from '@/lib/video-source-workflow';
import { requestVideoExcerpt } from '@/lib/client-video-excerpt';
import { settleReferenceAssetReservation, type ReferenceAsset } from '../_lib/workspace-assets';
import type { CommitInputAssetMutation, WorkspaceInputAssetState } from './useWorkspaceAssetState';
import { useWorkspaceAssetLifetime } from './useWorkspaceAssetLifetime';
import { useWorkspaceUploadOperation } from './useWorkspaceUploadOperation';

type Editor = {
  field: EngineInputField;
  index: number;
  original: ReferenceAsset;
  reservationId?: string;
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
  const context = `${engine?.id ?? ''}:${mode}`;
  const generation = useRef({ context, valid });
  if (generation.current.context !== context || generation.current.valid !== valid)
    generation.current = { context, valid };
  const epoch = generation.current;

  const restore = useCallback(
    (session: Editor, keepEditing = false) => {
      session.operation?.cancel();
      session.operation?.finish();
      const original = { ...session.original, ...(keepEditing ? { excerptEditing: true } : {}) };
      commitInputAssetMutation((previous) =>
        settleReferenceAssetReservation(
          previous,
          session.field,
          session.reservationId ?? session.original.id,
          original
        )
      );
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
    (field: EngineInputField, index: number, open: boolean) => {
      if (!open) {
        const active = editor.current;
        if (generation.current === epoch && active?.field.id === field.id && active.index === index) cancel();
        return;
      }
      cancel();
      if (!valid() || generation.current !== epoch || !engine || !isVideoSourceWorkflow(mode)) return;
      const limits = getVideoExcerptLimits(engine, mode);
      if (limits?.sourceFieldId !== field.id) return;
      commitInputAssetMutation((previous) => {
        const source = previous[field.id]?.[index];
        if (
          !source ||
          source.kind !== 'video' ||
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
    },
    [cancel, commitInputAssetMutation, engine, epoch, mode, valid]
  );

  const handlePrepareVideoExcerpt = useCallback(
    async (field: EngineInputField, index: number, range: VideoExcerptRange) => {
      const session = editor.current;
      if (
        !session ||
        !session.current() ||
        session.field.id !== field.id ||
        session.index !== index ||
        !engine ||
        !isVideoSourceWorkflow(mode)
      )
        throw new Error('Select the source again.');
      if (session.operation) throw new Error('Preparation already in progress.');
      const limits = getVideoExcerptLimits(engine, mode);
      if (!limits || limits.sourceFieldId !== field.id)
        throw new Error('This source workflow is unavailable.');
      const source = session.original;
      const original = source.excerptSource ?? {
        ref: source.ref ?? { type: 'asset' as const, assetId: source.assetId!, kind: 'video' as const },
        url: source.url!,
        previewUrl: source.previewUrl,
        durationSec: source.durationSec!,
      };
      validateVideoExcerptRange(range, original.durationSec, limits);
      // An unchanged selection creates no new media, including exact fractional full ranges.
      const unchanged = source.excerptRange
        ? range.startSec === source.excerptRange.startSec && range.endSec === source.excerptRange.endSec
        : range.startSec === 0 && range.endSec === original.durationSec;
      if (unchanged) {
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
          { source: original.ref, engineId: engine.id, mode, range },
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
          type: asset.mime ?? 'video/mp4',
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
    [beginUpload, cancel, commitInputAssetMutation, engine, mode, restore]
  );
  return { handleVideoExcerptEditorChange, handlePrepareVideoExcerpt };
}
