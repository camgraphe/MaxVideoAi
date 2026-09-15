import Image from 'next/image';
import { BookOpen, Camera, Clapperboard, ImageIcon, Maximize, Megaphone, Plug, ScanFace, Scissors, SlidersHorizontal, Volume2, Zap } from 'lucide-react';

const NAV_ICONS = { cinema: Clapperboard, image: ImageIcon, speed: Zap, ads: Megaphone, guides: SlidersHorizontal, character: ScanFace, angle: Camera, upscale: Maximize, cutout: Scissors, audio: Volume2, connect: Plug, docs: BookOpen };
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
  const Icon = entry.icon ? NAV_ICONS[entry.icon] : null;
  return (
    <span className="marketing-entry-content inline-flex min-w-0 items-center gap-2">
      {entry.logo ? <Image src={entry.logo} alt="" width={28} height={28} className="marketing-entry-logo" /> : null}
      {Icon ? <span className="marketing-entry-picto inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-text-secondary" aria-hidden="true"><Icon size={18} strokeWidth={1.5} /></span> : null}
      {entry.comparisonBrands ? <span className="marketing-entry-pair" aria-hidden="true">{entry.comparisonBrands.map((brand, index) => <span key={`${brand.id}-${index}`}><EngineIcon engine={{ ...brand, label: '' }} size={23} framed={false} /></span>)}</span> : null}
      {(showModelLogo || entry.brandId) && !entry.logo && !entry.comparisonBrands && !Icon ? (
        <EngineIcon
          engine={{ id: entry.key, label, brandId: entry.brandId }}
          label={label}
          size={28}
          rounded="xl"
          framed={false}
          className="shrink-0"
        />
      ) : null}
      <span>{label}</span>
      {badgeLabel ? (
        <span className="marketing-new-badge inline-flex shrink-0 rounded border border-hairline px-1.5 py-0.5 text-[9px] font-medium text-text-secondary">
          {badgeLabel}
        </span>
      ) : null}
    </span>
  );
}
