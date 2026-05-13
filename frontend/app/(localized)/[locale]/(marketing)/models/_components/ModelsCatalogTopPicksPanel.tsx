import { ArrowRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { UIIcon } from '@/components/ui/UIIcon';
import type { ModelsCatalogTopPick } from '../_lib/models-catalog-decision-data';

type ModelsCatalogTopPicksPanelProps = {
  title: string;
  viewAllLabel: string;
  items: ModelsCatalogTopPick[];
};

const TOP_PICK_ICON_CLASSES = [
  'bg-violet-100 text-violet-700 dark:bg-violet-400/14 dark:text-violet-200',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/14 dark:text-emerald-200',
  'bg-sky-100 text-sky-700 dark:bg-sky-400/14 dark:text-sky-200',
  'bg-amber-100 text-amber-700 dark:bg-amber-400/14 dark:text-amber-200',
] as const;

export function ModelsCatalogTopPicksPanel({ title, viewAllLabel, items }: ModelsCatalogTopPicksPanelProps) {
  return (
    <aside className="min-w-0 rounded-[8px] border border-hairline bg-surface/94 p-4 shadow-[0_20px_62px_rgba(15,23,42,0.10)] backdrop-blur dark:bg-white/[0.06] sm:p-5">
      <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
      <div className="mt-4 space-y-1.5">
        {items.map((item, index) => (
          <Link
            key={item.id}
            href={item.href}
            prefetch={false}
            className="flex min-h-[62px] items-center gap-2.5 rounded-[8px] border border-hairline bg-bg/80 p-2.5 transition hover:border-text-muted hover:bg-surface-2"
          >
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] ${
                TOP_PICK_ICON_CLASSES[index % TOP_PICK_ICON_CLASSES.length]
              }`}
            >
              <UIIcon icon={item.icon} size={17} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold text-text-muted">{item.reason}</span>
              <span className="block truncate text-[13px] font-semibold leading-tight text-text-primary">{item.label}</span>
              <span className="block truncate text-xs text-text-secondary">{item.detail}</span>
            </span>
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-hairline bg-surface text-sm font-semibold text-text-primary">
              <span>
                {item.score != null ? item.score.toFixed(1) : '-'}
                <span className="text-[8px] font-medium text-text-muted">/10</span>
              </span>
            </span>
          </Link>
        ))}
      </div>
      <a
        href="#recommended"
        className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-text-secondary transition hover:text-text-primary"
      >
        {viewAllLabel}
        <ArrowRight className="h-3.5 w-3.5" aria-hidden />
      </a>
    </aside>
  );
}
