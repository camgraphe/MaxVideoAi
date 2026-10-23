'use client';

import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { ComposerProps, ComposerAttachment } from '@/components/composer/composer-types';
import type { EngineInputField } from '@/types/engines';
import { getVideoExcerptLimits } from '@/lib/video-excerpt';
import { videoExcerptCopy } from '@/lib/video-excerpt-copy';
import type { VideoSourceWorkflow } from '@/lib/video-source-workflow';

const Selector = lazy(() =>
  import('./VideoExcerptSelector.client').then((module) => ({ default: module.VideoExcerptSelector }))
);
type Props = Pick<ComposerProps, 'engine' | 'onPrepareVideoExcerpt' | 'onVideoExcerptEditorChange'> & {
  field: EngineInputField;
  index: number;
  asset: ComposerAttachment;
  mode: VideoSourceWorkflow;
  locale: string;
};
/** The parent keys this control by source URL and model/mode, so replacement closes its session. */
export function VideoExcerptControl({
  engine,
  field,
  index,
  asset,
  mode,
  locale,
  onPrepareVideoExcerpt,
  onVideoExcerptEditorChange,
}: Props) {
  const [selection, setSelection] = useState<ComposerAttachment | null>(null);
  const [preview, setPreview] = useState<{ url: string; pending: boolean; error?: unknown }>({ url: '', pending: false });
  const copy = videoExcerptCopy(locale);
  const limits = getVideoExcerptLimits(engine, mode);
  const sessionCleanup = useRef<(() => void) | null>(null);
  useEffect(
    () => () => {
      sessionCleanup.current?.();
      sessionCleanup.current = null;
    },
    []
  );
  if (
    !limits ||
    limits.sourceFieldId !== field.id ||
    !onPrepareVideoExcerpt ||
    !asset.url ||
    !asset.durationSec ||
    !(asset.ref || asset.assetId)
  )
    return null;
  const close = () => {
    sessionCleanup.current?.();
    sessionCleanup.current = null;
    setSelection(null);
  };
  const original = selection?.excerptSource;
  return (
    <>
      <button
        type="button"
        className="app-reference-command video-excerpt-trigger"
        disabled={asset.status !== 'ready'}
        aria-disabled={Boolean(selection)}
        onClick={() => {
          if (selection) return;
          sessionCleanup.current = () => onVideoExcerptEditorChange?.(field, index, false);
          const session = sessionCleanup.current;
          setSelection(asset);
          const fallback = asset.excerptSource?.previewUrl ?? asset.previewUrl;
          const loading = onVideoExcerptEditorChange?.(field, index, true);
          setPreview({ url: loading ? '' : fallback, pending: Boolean(loading) });
          if (loading) void loading.then((url) => {
            if (sessionCleanup.current === session) setPreview({ url: url ?? fallback, pending: false });
          }, (error: unknown) => {
            if (sessionCleanup.current === session) setPreview({ url: '', pending: false, error });
          });
        }}
      >
        {copy.choose}
      </button>
      {selection ? (
        <Suspense
          fallback={
            <button type="button" onClick={close}>
              {copy.cancel}
            </button>
          }
        >
          <Selector
            previewUrl={preview.url}
            previewPending={preview.pending}
            previewError={preview.error}
            durationSec={original?.durationSec ?? selection.durationSec!}
            initialRange={selection.excerptRange}
            limits={limits}
            locale={locale}
            onCancel={close}
            onApply={async (range) => {
              await onPrepareVideoExcerpt(field, index, range);
              close();
            }}
          />
        </Suspense>
      ) : null}
    </>
  );
}
