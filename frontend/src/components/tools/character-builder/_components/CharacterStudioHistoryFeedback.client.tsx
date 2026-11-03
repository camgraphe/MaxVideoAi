'use client';

import { Loader2, RefreshCw } from 'lucide-react';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { getCharacterStudioCopy } from '../_lib/character-studio-copy';

/** Feed availability is separate from the lifecycle of an image generation. */
export function CharacterStudioHistoryFeedback({
  loading = false,
  error = false,
  onRetry,
}: {
  loading?: boolean;
  error?: boolean;
  onRetry: () => void;
}) {
  const { locale } = useI18n();
  const copy = getCharacterStudioCopy(locale);
  if (error) {
    return (
      <div role="alert" className="rounded-xl border border-border bg-bg/40 p-5">
        <p className="text-sm font-medium">{copy.historyUnavailable}</p>
        <p className="mt-2 text-sm text-text-secondary">{copy.historyUnavailableBody}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm hover:bg-surface-hover"
        >
          <RefreshCw size={14} />
          {copy.retry}
        </button>
      </div>
    );
  }
  if (loading) {
    return (
      <p role="status" className="flex items-center gap-2 p-5 text-sm text-text-secondary">
        <Loader2 size={16} className="animate-spin" />
        {copy.historyLoading}
      </p>
    );
  }
  return (
    <div className="rounded-xl border border-dashed border-border bg-bg/40 p-5">
      <p className="text-sm font-medium">{copy.empty}</p>
      <p className="mt-2 text-sm text-text-secondary">{copy.emptyBody}</p>
    </div>
  );
}
