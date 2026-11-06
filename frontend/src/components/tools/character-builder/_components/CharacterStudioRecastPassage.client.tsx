'use client';

import { lazy, Suspense } from 'react';
import { Scissors, X } from 'lucide-react';
import { RECAST_MAX_SOURCE_SECONDS } from '@/lib/character-studio-recast-timing';
import type { StudioCopy } from '../_lib/character-studio-copy';
import type { RecastTrack, RecastTrackControl } from './useRecastTrack';

const Selector = lazy(() =>
  import('@/components/media/VideoExcerptSelector.client').then((module) => ({
    default: module.VideoExcerptSelector,
  })),
);

/** Media fragments cue the native player; enforce the same bounds on replay or a manual seek. */
export function RecastPassagePlayer({
  kind,
  track,
  label,
  className,
}: {
  kind: 'video' | 'audio';
  track: RecastTrack;
  label: string;
  className: string;
}) {
  const range = track.range;
  if (!range) return null;
  const trimmed = range.startSec > 0 || range.endSec < track.originalSeconds!;
  const Media = kind;
  const src = trimmed ? track.url + '#t=' + range.startSec + ',' + range.endSec : track.url;
  const constrain = (node: HTMLMediaElement) => {
    if (!trimmed) return;
    if (node.currentTime < range.startSec) node.currentTime = range.startSec;
    else if (node.currentTime >= range.endSec) {
      node.pause();
      node.currentTime = range.endSec;
    }
  };
  return (
    <Media
      key={src}
      src={src}
      playsInline
      controls
      preload="none"
      aria-label={label}
      className={className}
      onPlay={(event) => {
        const node = event.currentTarget;
        if (trimmed && (node.currentTime < range.startSec || node.currentTime >= range.endSec - 0.001))
          node.currentTime = range.startSec;
      }}
      onSeeked={(event) => constrain(event.currentTarget)}
      onTimeUpdate={(event) => constrain(event.currentTarget)}
    />
  );
}

export function CharacterStudioRecastPassage({
  kind,
  control,
  copy,
  label,
}: {
  kind: 'video' | 'audio';
  control: RecastTrackControl;
  copy: StudioCopy;
  label: string;
}) {
  const { track, setEditing } = control;
  if (!track) return null;
  const duration = track.originalSeconds;
  const range = track.range;
  const format = new Intl.NumberFormat(copy.recastLocale, { maximumFractionDigits: 3 });
  return (
    <div className="min-w-0 space-y-2 rounded-xl border border-border bg-bg p-2">
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-xs font-medium" title={track.name}>
          {track.name}
        </span>
        <button
          type="button"
          onClick={control.remove}
          className="rounded-md p-2"
          aria-label={copy.remove + ' · ' + label}
        >
          <X size={16} />
        </button>
      </div>
      {range && (
        <RecastPassagePlayer
          kind={kind}
          track={track}
          label={label}
          className={kind === 'video' ? 'max-h-40 w-full rounded-lg bg-black' : 'w-full'}
        />
      )}
      <p className="text-xs text-text-secondary" role="status">
        {duration === undefined
          ? copy.readDuration
          : range
            ? copy.passageSummary
                .replace('{start}', format.format(range.startSec))
                .replace('{end}', format.format(range.endSec))
                .replace('{total}', format.format(duration))
            : copy.passageNeeded}
      </p>
      {duration !== undefined && (
        <button
          type="button"
          onClick={(event) => {
            event.currentTarget.focus();
            setEditing(true);
          }}
          className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-xs font-medium hover:border-brand"
        >
          <Scissors size={14} />
          {copy.choosePassage}
        </button>
      )}
    </div>
  );
}

export function RecastPassageDialog({
  kind,
  control,
  copy,
}: {
  kind: 'video' | 'audio';
  control: RecastTrackControl;
  copy: StudioCopy;
}) {
  const { track } = control;
  if (!track?.originalSeconds || !control.editing) return null;
  const duration = track.originalSeconds;
  return (
    <Suspense fallback={<p role="status">{copy.readDuration}</p>}>
      <Selector
        key={track.url}
        mediaKind={kind}
        locale={copy.recastLocale}
        previewUrl={track.url}
        durationSec={duration}
        initialRange={track.range ?? { startSec: 0, endSec: Math.min(duration, RECAST_MAX_SOURCE_SECONDS) }}
        limits={{
          sourceFieldId: kind,
          minDurationSec: null,
          maxDurationSec: RECAST_MAX_SOURCE_SECONDS,
          maxSizeMB: kind === 'video' ? 100 : 15,
          durationPolicy: 'requested',
        }}
        onCancel={() => control.setEditing(false)}
        onApply={async (selected) => control.apply(track.url, selected)}
      />
    </Suspense>
  );
}
