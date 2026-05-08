'use client';

import clsx from 'clsx';
import Image from 'next/image';
import type { GroupSummary } from '@/types/groups';
import { ProcessingOverlay } from '@/components/groups/ProcessingOverlay';
import { isPlaceholderMediaUrl } from '@/lib/media';
import { GROUPED_JOB_THUMB_SIZES, GroupPreviewMedia } from './GroupedJobCardMedia';

interface GroupedJobCardPreviewGridProps {
  group: GroupSummary;
  hovered: boolean;
  isPreviewWarm: boolean;
  isSinglePreview: boolean;
  previewCount: number;
  previewGridClass: string;
  previews: GroupSummary['previews'];
}

export function GroupedJobCardPreviewGrid({
  group,
  hovered,
  isPreviewWarm,
  isSinglePreview,
  previewCount,
  previewGridClass,
  previews,
}: GroupedJobCardPreviewGridProps) {
  return (
    <div
      className={clsx(
        'absolute inset-0 grid bg-placeholder',
        previewGridClass,
        isSinglePreview ? 'p-0' : 'gap-1 p-1'
      )}
    >
      {Array.from({ length: previewCount }).map((_, index) => {
        const preview = previews[index];
        const member = preview ? group.members.find((entry) => entry.id === preview.id) : undefined;
        const memberStatus = member?.status ?? 'completed';
        const memberAudioUrl = member?.audioUrl ?? member?.job?.audioUrl ?? null;
        const previewThumb = preview?.thumbUrl && !isPlaceholderMediaUrl(preview.thumbUrl) ? preview.thumbUrl : null;
        const previewHasMedia = Boolean(preview?.previewVideoUrl || preview?.videoUrl || previewThumb || memberAudioUrl);
        const isCompleted =
          memberStatus === 'completed' || (previewHasMedia && memberStatus !== 'pending' && memberStatus !== 'failed');
        const previewKey = preview?.id ? `${preview.id}-${index}` : `preview-${index}`;

        return (
          <div
            key={previewKey}
            className={clsx(
              'relative flex items-center justify-center overflow-hidden bg-[var(--surface-2)]',
              isSinglePreview ? 'rounded-none' : 'rounded-card'
            )}
          >
            <div className="absolute inset-0">
              {isCompleted ? (
                <GroupPreviewMedia
                  preview={preview}
                  audioUrl={memberAudioUrl}
                  audioLabel={preview?.previewVideoUrl || preview?.videoUrl ? null : 'Audio'}
                  shouldPlay={hovered}
                  shouldWarm={isPreviewWarm || hovered}
                />
              ) : previewThumb ? (
                <Image
                  src={previewThumb}
                  alt=""
                  fill
                  className="pointer-events-none object-contain"
                  sizes={GROUPED_JOB_THUMB_SIZES}
                />
              ) : null}
            </div>
            <div className="pointer-events-none block" style={{ width: '100%', aspectRatio: '16 / 9' }} aria-hidden />
            {!isCompleted && member ? (
              <ProcessingOverlay
                className="absolute inset-0"
                state={memberStatus === 'failed' ? 'error' : 'pending'}
                message={member.message}
                tone="light"
                tileIndex={index + 1}
                tileCount={previewCount}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
