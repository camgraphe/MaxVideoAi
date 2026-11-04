import type { ReactNode } from 'react';
import {
  BadgeDollarSign,
  CreditCard,
  ChevronDown,
  Eye,
  Film,
  Layers3,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import type { PaygIconId } from '../_content/types';

export const PAYG_CONTAINER_CLASS_NAME = 'container-page max-w-[1220px]';

const ICONS: Record<PaygIconId, LucideIcon> = {
  model: Layers3,
  engine: SlidersHorizontal,
  preview: Eye,
  video: Film,
  refund: RotateCcw,
  duration: Film,
  resolution: Sparkles,
  audio: BadgeDollarSign,
  credits: CreditCard,
};

export function PayAsYouGoSemanticIcon({
  id,
  className,
  strokeWidth = 1.9,
}: {
  id: PaygIconId;
  className?: string;
  strokeWidth?: number;
}) {
  const Icon = ICONS[id];
  return <Icon className={className} strokeWidth={strokeWidth} />;
}

export function PayAsYouGoSectionHeader({
  eyebrow,
  title,
  intro,
  align = 'left',
}: {
  eyebrow?: string;
  title: string;
  intro?: string;
  align?: 'left' | 'center';
}) {
  return (
    <div className={align === 'center' ? 'mx-auto max-w-3xl text-center' : 'max-w-3xl'}>
      {eyebrow ? <p className="text-xs font-semibold uppercase tracking-micro text-brand">{eyebrow}</p> : null}
      <h2 className="mt-3 text-2xl font-semibold tracking-normal text-text-primary sm:text-3xl">{title}</h2>
      {intro ? <p className="mt-3 text-sm leading-6 text-text-secondary sm:text-base">{intro}</p> : null}
    </div>
  );
}

export function PayAsYouGoCatalog({ id, label, count, children }: {
  id: 'models' | 'prices'; label: string; count: number; children: ReactNode;
}) {
  return (
    <details data-payg-catalog={id} className="group/catalog mt-5 border-y border-hairline">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 font-semibold text-text-primary hover:text-brand focus-visible:outline-offset-2 [&::-webkit-details-marker]:hidden">
        <span>{label} <span className="ml-1 text-sm font-normal text-text-muted">({count})</span></span>
        <ChevronDown aria-hidden className="h-5 w-5 shrink-0 group-open/catalog:rotate-180" />
      </summary>
      <div className="pb-5 pt-2">{children}</div>
    </details>
  );
}
