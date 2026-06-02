"use client";

import clsx from 'clsx';
import { useState } from 'react';
import type { ModerationVideo } from '@/components/admin/moderation/moderation-types';
import { Button } from '@/components/ui/Button';
import { authFetch } from '@/lib/authFetch';

type ModerationVideoSeoCandidateButtonProps = {
  compact?: boolean;
  disabled?: boolean;
  enabled: boolean;
  onCandidateCreated: (videoId: string) => void;
  onError: (message: string | null) => void;
  video: ModerationVideo;
};

export function ModerationVideoSeoCandidateButton({
  compact = false,
  disabled = false,
  enabled,
  onCandidateCreated,
  onError,
  video,
}: ModerationVideoSeoCandidateButtonProps) {
  const [isSubmitting, setSubmitting] = useState(false);

  if (!enabled || !video.isPublishedOnSite || video.seoWatch) {
    return null;
  }

  const baseClass = compact
    ? 'h-8 rounded-md px-2.5 text-[11px] font-semibold uppercase tracking-micro'
    : 'rounded-input px-3 py-1 text-xs font-semibold uppercase tracking-micro';

  const handleClick = async () => {
    setSubmitting(true);
    onError(null);

    try {
      const response = await authFetch('/api/admin/video-seo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: video.id }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) {
        throw new Error(json?.error ?? `Failed to create Video SEO candidate (${response.status})`);
      }

      onCandidateCreated(video.id);
    } catch (error) {
      console.error('[moderation] video seo candidate failed', error);
      onError(error instanceof Error ? error.message : 'Failed to create Video SEO candidate');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className={clsx(baseClass, 'border-hairline bg-bg text-text-secondary hover:border-text-muted hover:text-text-primary')}
      onClick={() => void handleClick()}
      disabled={disabled || isSubmitting}
    >
      {isSubmitting ? 'Sending...' : 'Send to Video SEO'}
    </Button>
  );
}
