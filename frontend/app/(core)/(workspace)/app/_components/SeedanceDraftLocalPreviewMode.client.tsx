'use client';

import type { SeedanceDraftControls } from '@/lib/seedance-workflow-contract';
import { getSeedanceDraftCopy } from '../_lib/seedance-draft-copy';

type Props = { preview: SeedanceDraftControls; locale?: string };

export function SeedanceDraftLocalPreviewMode({ preview, locale = 'fr' }: Props) {
  if (!preview.available) return null;
  const copy = getSeedanceDraftCopy(locale);

  return (
    <label className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-3 text-xs font-medium sm:min-h-0 sm:h-9 ${
      preview.selected
        ? 'border-[var(--app-accent)] bg-[var(--app-accent-soft)] text-[var(--app-accent)]'
        : 'border-hairline bg-surface text-text-secondary hover:border-border-hover'
    }`} title={copy.tooltip}>
      <input
        type="checkbox"
        checked={preview.selected}
        onChange={preview.toggle}
        className="h-4 w-4 shrink-0 cursor-pointer accent-[var(--app-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      />
      <span className="whitespace-nowrap">{copy.enable}</span>
    </label>
  );
}
