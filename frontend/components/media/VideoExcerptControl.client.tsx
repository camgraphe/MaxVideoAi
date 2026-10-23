'use client';

import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
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
/** The parent keys the surviving trigger by model/mode/slot; the dialog is also fenced by URL. */
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
  const copy = videoExcerptCopy(locale);
  const limits = getVideoExcerptLimits(engine, mode);
  // Retire selection even when a source changes away and later returns to the same URL.
  useLayoutEffect(() => setSelection(null), [asset.url]);
  if (
    !limits ||
    limits.sourceFieldId !== field.id ||
    !onPrepareVideoExcerpt ||
    !asset.url ||
    !asset.durationSec ||
    !(asset.ref || asset.assetId)
  )
    return null;
  const selected = selection?.url === asset.url ? selection : null;
  return (
    <>
      <button
        type="button"
        className="app-reference-command video-excerpt-trigger"
        disabled={asset.status !== 'ready'}
        aria-disabled={Boolean(selected)}
        onClick={() => {
          if (!selected) setSelection(asset);
        }}
      >
        {copy.choose}
      </button>
      {selected ? (
        <VideoExcerptSession
          key={asset.url}
          engine={engine}
          field={field}
          index={index}
          asset={selected}
          mode={mode}
          locale={locale}
          onPrepareVideoExcerpt={onPrepareVideoExcerpt}
          onVideoExcerptEditorChange={onVideoExcerptEditorChange}
          onClose={() => setSelection(null)}
        />
      ) : null}
    </>
  );
}

/** Remounting this owner retires preview, preparation callbacks and modal cleanup together. */
function VideoExcerptSession({
  engine, field, index, asset, mode, locale, onPrepareVideoExcerpt, onVideoExcerptEditorChange, onClose,
}: Props & { onClose: () => void }) {
  const [preview, setPreview] = useState<{ url: string; pending: boolean; error?: unknown }>({
    url: onVideoExcerptEditorChange ? '' : asset.excerptSource?.previewUrl ?? asset.previewUrl,
    pending: Boolean(onVideoExcerptEditorChange),
  });
  const active = useRef<object | null>(null);
  const copy = videoExcerptCopy(locale);
  const limits = getVideoExcerptLimits(engine, mode)!;
  useEffect(() => {
    const session = {};
    active.current = session;
    const fallback = asset.excerptSource?.previewUrl ?? asset.previewUrl;
    const loading = onVideoExcerptEditorChange?.(field, index, true);
    if (loading) void loading.then((url) => {
      if (active.current === session) setPreview({ url: url ?? fallback, pending: false });
    }, (error: unknown) => {
      if (active.current === session) setPreview({ url: '', pending: false, error });
    });
    else setPreview({ url: fallback, pending: false });
    return () => {
      active.current = null;
      onVideoExcerptEditorChange?.(field, index, false);
    };
    // Capture the initiating source and callbacks for exactly this keyed session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Suspense fallback={<button type="button" onClick={onClose}>{copy.cancel}</button>}>
      <Selector
        previewUrl={preview.url}
        previewPending={preview.pending}
        previewError={preview.error}
        durationSec={asset.excerptSource?.durationSec ?? asset.durationSec!}
        initialRange={asset.excerptRange}
        limits={limits}
        locale={locale}
        onCancel={onClose}
        onApply={async (range) => {
          const session = active.current;
          await onPrepareVideoExcerpt!(field, index, range);
          if (session && active.current === session) onClose();
        }}
      />
    </Suspense>
  );
}
