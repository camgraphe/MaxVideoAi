'use client';

import type { useSeedanceDraftLocalPreview } from '../_hooks/useSeedanceDraftLocalPreview';

type Props = { preview: ReturnType<typeof useSeedanceDraftLocalPreview> };

export function SeedanceDraftLocalPreviewMode({ preview }: Props) {
  if (!preview.available) return null;

  return (
    <label className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-3 text-xs font-medium sm:min-h-0 sm:h-9 ${
      preview.selected
        ? 'border-[var(--app-accent)] bg-[var(--app-accent-soft)] text-[var(--app-accent)]'
        : 'border-hairline bg-surface text-text-secondary hover:border-border-hover'
    }`} title="Préparez une première version en Draft 480p, puis choisissez de la finaliser en 1080p. Deux générations payantes distinctes.">
      <input
        type="checkbox"
        checked={preview.selected}
        onChange={preview.toggle}
        className="h-4 w-4 shrink-0 cursor-pointer accent-[var(--app-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      />
      <span className="whitespace-nowrap">Activer Draft · 480p → final 1080p</span>
    </label>
  );
}
