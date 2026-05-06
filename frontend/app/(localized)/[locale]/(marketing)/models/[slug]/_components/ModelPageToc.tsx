import { FULL_BLEED_SECTION } from '../_lib/model-page-specs';

type TocItem = {
  id: string;
  label: string;
};

type ModelPageTocProps = {
  items: TocItem[];
};

export function ModelPageToc({ items }: ModelPageTocProps) {
  if (!items.length) return null;

  return (
    <nav
      className={`${FULL_BLEED_SECTION} sticky top-[calc(var(--header-height)-8px)] z-30 border-b border-hairline bg-surface before:bg-surface`}
      aria-label="Model page sections"
    >
      <div className="mx-auto w-full max-w-6xl px-6 sm:px-8">
        <div className="flex flex-wrap justify-center gap-2 py-2">
          {items.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className="inline-flex items-center rounded-full border border-hairline bg-surface/90 px-3 py-1 text-xs font-semibold text-text-secondary transition hover:border-text-muted hover:text-text-primary"
            >
              {item.label}
            </a>
          ))}
        </div>
      </div>
    </nav>
  );
}
