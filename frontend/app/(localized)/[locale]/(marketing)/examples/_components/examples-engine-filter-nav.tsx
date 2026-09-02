import clsx from 'clsx';
import Link from 'next/link';
import {
  getEngineAccentOutlineStyle,
  type EngineFilterOption,
} from '../_lib/examples-route-utils';

type ExamplesEngineFilterNavProps = {
  browseByModelLabel: string;
  engineFilterAllLabel: string;
  engineFilterOptions: EngineFilterOption[];
  getEngineFilterHref: (engineId: string | null) => string;
  selectedEngine: string | null;
};

export function ExamplesEngineFilterNav({
  browseByModelLabel,
  engineFilterAllLabel,
  engineFilterOptions,
  getEngineFilterHref,
  selectedEngine,
}: ExamplesEngineFilterNavProps) {
  if (!engineFilterOptions.length) {
    return null;
  }

  return (
    <div className="sticky top-16 z-[35] -mt-px border-b border-hairline bg-surface">
      <div className="container-page max-w-7xl">
        <nav
          aria-label={browseByModelLabel}
          className="flex flex-col gap-2 py-2 lg:flex-row lg:items-center lg:gap-4 lg:py-2"
        >
          <span className="shrink-0 pl-1 text-[11px] font-semibold uppercase tracking-micro text-text-muted">
            {browseByModelLabel}
          </span>

          <div className="min-w-0 flex-1 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex w-max min-w-full items-center gap-1 rounded-xl bg-surface-2/70 p-1">
              <Link
                href={getEngineFilterHref(null)}
                scroll={false}
                prefetch={false}
                className={clsx(
                  'order-0 flex h-9 shrink-0 items-center justify-center whitespace-nowrap rounded-lg px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-10 sm:text-sm',
                  selectedEngine
                    ? 'text-text-secondary hover:bg-surface hover:text-text-primary'
                    : 'bg-surface text-text-primary shadow-sm ring-1 ring-black/5'
                )}
              >
                {engineFilterAllLabel}
              </Link>
              {engineFilterOptions.map((engine) => {
                const isActive = selectedEngine === engine.id;
                return (
                  <Link
                    key={engine.id}
                    href={getEngineFilterHref(engine.id)}
                    scroll={false}
                    prefetch={false}
                    className={clsx(
                      'flex h-9 shrink-0 items-center justify-center whitespace-nowrap rounded-lg px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-10 sm:text-sm',
                      isActive
                        ? 'order-1 bg-surface text-text-primary shadow-sm ring-1 ring-black/5'
                        : 'order-2 text-text-secondary hover:bg-surface hover:text-text-primary'
                    )}
                    style={isActive ? getEngineAccentOutlineStyle(engine.brandId) : undefined}
                  >
                    {engine.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </nav>
      </div>
    </div>
  );
}
