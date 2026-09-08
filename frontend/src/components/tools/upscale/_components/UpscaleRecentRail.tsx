import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { GroupedJobCard, type GroupedJobAction } from '@/components/GroupedJobCard';
import { Card } from '@/components/ui/Card';
import type { GroupSummary } from '@/types/groups';
import { useI18n } from '@/lib/i18n/I18nProvider';

type UpscaleRecentRailCopy = {
  recentTitle: string;
};

export function UpscaleRecentRail({
  activeGroupId,
  copy,
  groups,
  onAction,
  onOpen,
  savingGroupId,
}: {
  activeGroupId: string | null;
  copy: UpscaleRecentRailCopy;
  groups: GroupSummary[];
  onAction: (group: GroupSummary, action: GroupedJobAction) => void;
  onOpen: (group: GroupSummary) => void;
  savingGroupId: string | null;
}) {
  const { locale } = useI18n();
  return (
    <Card className="order-4 rounded-[14px] border border-border bg-surface p-5 shadow-card xl:order-none">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-text-primary">{copy.recentTitle}</h2>
        </div>
        <Link href="/app/library" className="inline-flex items-center gap-1 text-xs font-semibold text-text-secondary hover:text-text-primary">
          {locale === 'fr' ? 'Bibliothèque' : locale === 'es' ? 'Biblioteca' : 'Library'}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
        {groups.slice(0, 8).map((group) => {
          const active = activeGroupId === group.id;
          return (
            <div
              key={group.id}
              className={`w-[258px] shrink-0 rounded-[14px] transition ${
                active ? 'ring-2 ring-brand ring-offset-2 ring-offset-bg' : ''
              }`}
            >
              <GroupedJobCard
                group={group}
                onOpen={onOpen}
                onAction={onAction}
                menuVariant="gallery-image"
                allowRemove={false}
                savingToLibrary={savingGroupId === group.id}
              />
            </div>
          );
        })}
        {!groups.length ? (
          <div className="w-full rounded-[12px] border border-dashed border-border bg-bg p-4 text-sm text-text-muted">
            {locale === 'fr' ? 'Aucun résultat.' : locale === 'es' ? 'Sin resultados.' : 'No results yet.'}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
