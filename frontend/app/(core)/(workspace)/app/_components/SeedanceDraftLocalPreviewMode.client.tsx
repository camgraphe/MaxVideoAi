'use client';

import { useId } from 'react';
import type { SeedanceDraftControls } from '@/lib/seedance-workflow-contract';
import { getSeedanceDraftCopy } from '../_lib/seedance-draft-copy';

type Props = { preview: SeedanceDraftControls; locale?: string; unavailableReason?: string };

export function SeedanceDraftLocalPreviewMode({ preview, locale = 'fr', unavailableReason }: Props) {
  const descriptionId = useId();
  if (!preview.available) return null;
  const copy = getSeedanceDraftCopy(locale);

  return (
    <label className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-3 text-xs font-medium sm:min-h-0 sm:h-9 ${
      preview.selected
        ? 'border-[var(--app-accent)] bg-[var(--app-accent-soft)] text-[var(--app-accent)]'
        : 'border-hairline bg-surface text-text-secondary hover:border-border-hover'
    }`} title={unavailableReason ? `${unavailableReason} ${copy.tooltip}` : copy.tooltip}>
      <input
        type="checkbox"
        checked={preview.selected}
        disabled={preview.pending || Boolean(unavailableReason)}
        aria-label={copy.enable}
        aria-describedby={unavailableReason ? descriptionId : undefined}
        onChange={preview.toggle}
        className="h-4 w-4 shrink-0 cursor-pointer accent-[var(--app-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      />
      <span className="whitespace-nowrap">{copy.enable}</span>
      {unavailableReason ? <span id={descriptionId} className="sr-only">{unavailableReason}</span> : null}
    </label>
  );
}
