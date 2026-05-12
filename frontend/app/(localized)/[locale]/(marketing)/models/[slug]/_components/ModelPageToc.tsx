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
      <nav className="relative z-20 flex justify-center" aria-label="Model page sections">
        <div className="max-w-full overflow-x-auto rounded-full border border-[#e1e7f0] bg-white/88 px-3 py-2 shadow-[0_18px_54px_rgba(15,23,42,0.08)] backdrop-blur dark:border-white/10 dark:bg-white/[0.06] dark:shadow-[0_24px_70px_rgba(0,0,0,0.30)]">
          <div className="flex min-w-max items-center gap-2">
            <span className="inline-flex min-h-[38px] items-center gap-2 rounded-full px-3 text-sm font-semibold text-[#41516c] dark:text-white/75">
              <UIIcon icon={LayoutList} size={17} strokeWidth={1.9} />
              {overviewLabel}
            </span>
            {items.map((item) => {
              const Icon = PILL_ICON_MAP[item.id as keyof typeof PILL_ICON_MAP] ?? Sparkles;
              return (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className="inline-flex min-h-[38px] items-center gap-2 rounded-full px-4 text-sm font-semibold text-[#41516c] transition hover:bg-[#f3f6fb] hover:text-[#071126] dark:text-white/60 dark:hover:bg-white/[0.08] dark:hover:text-white"
                >
                  <UIIcon icon={Icon} size={17} strokeWidth={1.85} />
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
