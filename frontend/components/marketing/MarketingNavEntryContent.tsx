import { EngineIcon } from '@/components/ui/EngineIcon';
import type { MarketingNavItem } from '@/config/navigation';

export function MarketingNavEntryContent({
  entry,
  label,
  badgeLabel,
  showModelLogo,
}: {
  entry: MarketingNavItem;
  label: string;
  badgeLabel?: string;
  showModelLogo: boolean;
}) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      {showModelLogo ? (
        <EngineIcon
          engine={{ id: entry.key, label }}
          label={label}
          size={20}
          rounded="full"
          className="shrink-0"
        />
      ) : null}
      <span>{label}</span>
      {badgeLabel ? (
        <span className="inline-flex rounded-full bg-brand px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-micro text-white">
          {badgeLabel}
        </span>
      ) : null}
    </span>
  );
}
