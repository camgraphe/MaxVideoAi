import { Link } from '@/i18n/navigation';
import { formatTemplate } from '@/components/marketing/models-gallery-utils';
import type { ModelGalleryCard, ModelsGalleryCompareBarCopy, ModelsGalleryCompareHref } from './models-gallery-types';

type ModelsGalleryCompareBarProps = {
  compareBar: ModelsGalleryCompareBarCopy;
  compareHref: ModelsGalleryCompareHref | null;
  selectedCards: ModelGalleryCard[];
  onClear: () => void;
};

export function ModelsGalleryCompareBar({
  compareBar,
  compareHref,
  selectedCards,
  onClear,
}: ModelsGalleryCompareBarProps) {
  return (
    <div className="fixed inset-x-4 bottom-6 z-40 mx-auto max-w-4xl rounded-2xl border border-white/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(255,255,255,0.78))] px-4 py-3 shadow-[0_18px_40px_rgba(15,23,42,0.22),0_6px_16px_rgba(15,23,42,0.16)] backdrop-blur dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(2,6,23,0.9))]">
      <span className="pointer-events-none absolute inset-x-0 top-0 h-6 bg-[linear-gradient(180deg,rgba(255,255,255,0.7),transparent)] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.08),transparent)]" />
      <div className="relative flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="font-semibold text-text-primary">
          {selectedCards.length === 2
            ? formatTemplate(compareBar.selectedTemplate, {
                left: selectedCards[0]?.label ?? '',
                right: selectedCards[1]?.label ?? '',
              })
            : compareBar.selectTwo}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onClear}
            className="rounded-full border border-hairline px-3 py-1 text-xs font-semibold text-text-secondary transition hover:border-text-muted hover:text-text-primary"
          >
            {compareBar.clear}
          </button>
          {compareHref ? (
            <Link
              href={compareHref}
              prefetch={false}
              className="rounded-full bg-text-primary px-4 py-1 text-xs font-semibold text-bg transition hover:opacity-90"
            >
              {compareBar.compare}
            </Link>
          ) : (
            <span className="rounded-full border border-hairline px-4 py-1 text-xs font-semibold text-text-muted">
              {compareBar.compare}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
