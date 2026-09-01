'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { authFetch } from '@/lib/authFetch';

type VideoSeoRolloutRemovalButtonProps = {
  videoId: string;
  title: string;
  seoStatus: string;
  compact?: boolean;
};

const REMOVABLE_STATUSES = new Set(['candidate', 'draft', 'needs_edits']);

export function VideoSeoRolloutRemovalButton({
  videoId,
  title,
  seoStatus,
  compact = false,
}: VideoSeoRolloutRemovalButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!REMOVABLE_STATUSES.has(seoStatus)) return null;

  async function handleRemove() {
    if (pending) return;
    const confirmed = window.confirm(
      `Retirer « ${title} » du rollout Video SEO ? La vidéo, sa visibilité et ses fichiers ne seront pas modifiés.`
    );
    if (!confirmed) return;

    setPending(true);
    setError(null);
    try {
      const response = await authFetch(`/api/admin/video-seo/${encodeURIComponent(videoId)}`, {
        method: 'DELETE',
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) {
        throw new Error(json?.error ?? 'Impossible de retirer cette candidature du rollout');
      }
      router.refresh();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Impossible de retirer cette candidature du rollout');
    } finally {
      setPending(false);
    }
  }

  if (compact) {
    return (
      <div className="absolute right-2 top-2 z-10 flex flex-col items-end gap-1">
        <button
          type="button"
          disabled={pending}
          onClick={handleRemove}
          aria-label={`Retirer la candidature ${title}`}
          className="inline-flex min-h-8 items-center justify-center rounded-md border border-white/30 bg-black/75 px-2.5 text-[11px] font-semibold text-white shadow-lg backdrop-blur-sm transition hover:border-white/50 hover:bg-black/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? 'Retrait…' : 'Retirer'}
        </button>
        {error ? (
          <p role="alert" className="max-w-[180px] rounded-md bg-error-bg px-2 py-1 text-[10px] font-medium leading-4 text-error shadow-lg">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-2 border-t border-hairline pt-3">
      <Button type="button" variant="outline" size="sm" disabled={pending} onClick={handleRemove}>
        {pending ? 'Retrait en cours…' : 'Retirer la candidature'}
      </Button>
      <p className="text-xs text-text-muted">
        Retire uniquement cette page des candidats Video SEO. La vidéo reste inchangée.
      </p>
      {error ? <p className="text-xs font-medium text-error">{error}</p> : null}
    </div>
  );
}
