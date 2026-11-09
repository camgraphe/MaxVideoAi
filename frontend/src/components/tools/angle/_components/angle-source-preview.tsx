'use client';
import { useRef, useState } from 'react';
import { useLibraryDisplayAccess } from '@/hooks/useLibraryMediaAccess';
import { parseImageDisplay } from '@/lib/image-display';
import type { UploadedImage } from '../_lib/angle-workspace-types';
import type { AngleCopy } from '../_lib/angle-workspace-copy';

/** Display lease only; Angle generation continues to receive image.url unchanged. */
export function AngleSourcePreview({ image, copy }: { image: UploadedImage; copy: AngleCopy }) {
  const media = useLibraryDisplayAccess(image);
  const [failed, setFailed] = useState(false);
  const display = parseImageDisplay(image.imageDisplay, image.url, image.previewUrl);
  const privateSource = Boolean(image.readAccessRef || image.readAccessOwnerId);
  const source = image.previewUrl?.startsWith('blob:') ? image.previewUrl : privateSource
    ? (display ? media.access.previewAccessUrl : undefined) ?? media.access.accessUrl ?? media.access.thumbnailAccessUrl
    : display?.url ?? image.previewUrl ?? image.url;
  const currentSource = useRef(source);
  currentSource.current = media.retired ? undefined : source;
  if (media.retired) return null;
  return <>
    {source && !failed ? (
      // Private grants must not pass through the public Next Image optimizer.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={source} alt={copy.sourceAlt} className="h-56 w-full object-contain" referrerPolicy="no-referrer"
        onError={() => {
          const captured = source;
          void media.refresh().then(recovered => {
            if (!recovered && currentSource.current === captured) setFailed(true);
          });
        }} />
    ) : !media.pending ? <p role="alert">{copy.sourcePreviewUnavailable}</p> : null}
    {(failed || (!source && !media.pending)) && privateSource ? (
      <button type="button" disabled={media.pending} onClick={() => {
        media.beginAttempt();
        void media.refresh().then(recovered => { if (recovered) setFailed(false); });
      }}>{copy.retrySourcePreview}</button>
    ) : null}
  </>;
}
