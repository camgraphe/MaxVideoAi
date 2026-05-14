import { CircleHelp, Compass, DollarSign, Film, LayoutList, Lightbulb, SlidersHorizontal, Sparkles } from 'lucide-react';

import { UIIcon } from '@/components/ui/UIIcon';

import { FULL_BLEED_SECTION } from '../_lib/model-page-specs';

type TocItem = {
  id: string;
  label: string;
};

type ModelPageTocProps = {
  items: TocItem[];
  variant?: 'default' | 'pill';
  overviewLabel?: string;
};

const PILL_ICON_MAP = {
  specs: SlidersHorizontal,
  'text-to-video': Film,
  'text-to-image': Film,
  'image-to-video': Sparkles,
  'image-to-image': Sparkles,
  'decision-pricing': DollarSign,
  tips: Lightbulb,
  compare: Compass,
  faq: CircleHelp,
  safety: CircleHelp,
} as const;

export function ModelPageToc({ items, variant = 'default', overviewLabel = 'On this page' }: ModelPageTocProps) {
  if (!items.length) return null;

  if (variant === 'pill') {
    return (
      <nav
        className={`${FULL_BLEED_SECTION} sticky top-16 z-30 border-b border-hairline bg-white before:bg-white dark:border-white/10 dark:bg-[#071126] dark:before:bg-[#071126]`}
        aria-label="Model page sections"
      >
        <div className="mx-auto w-full max-w-[1400px] px-3 sm:px-5 lg:px-6">
          <div className="flex flex-wrap items-center justify-center gap-x-1 gap-y-1 py-1.5 sm:gap-2 sm:py-2 lg:flex-nowrap">
            <span className="inline-flex min-h-[30px] items-center gap-1.5 px-1.5 text-xs font-semibold text-[#41516c] dark:text-white/75 sm:min-h-[36px] sm:gap-2 sm:px-3 sm:text-sm">
              <UIIcon icon={LayoutList} size={15} strokeWidth={1.9} />
              {overviewLabel}
            </span>
            {items.map((item) => {
              const Icon = PILL_ICON_MAP[item.id as keyof typeof PILL_ICON_MAP] ?? Sparkles;
              return (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className="inline-flex min-h-[30px] items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-[#41516c] transition hover:bg-[#f3f6fb] hover:text-[#071126] dark:text-white/60 dark:hover:bg-white/[0.08] dark:hover:text-white sm:min-h-[36px] sm:gap-2 sm:px-3 sm:text-sm"
                >
                  <UIIcon icon={Icon} size={15} strokeWidth={1.85} />
                  {item.label}
                </a>
              );
            })}
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav
      className={`${FULL_BLEED_SECTION} sticky top-16 z-30 border-b border-hairline bg-surface before:bg-surface`}
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
