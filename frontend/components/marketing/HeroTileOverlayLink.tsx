'use client';

import Link from 'next/link';
import clsx from 'clsx';

type HeroTileOverlayLinkProps = {
  href: string;
  label?: string;
  className?: string;
};

export function HeroTileOverlayLink({ href, label = 'Clone these settings', className }: HeroTileOverlayLinkProps) {
  return (
    <Link
      href={href}
      onClick={(event) => {
        event.stopPropagation();
      }}
      className={clsx(
        'pointer-events-auto absolute bottom-2 left-1/2 z-10 -translate-x-1/2 rounded-full bg-white px-3 py-1 text-xs font-medium text-black shadow ring-1 ring-black/10 transition hover:ring-black/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black/40',
        className
      )}
    >
      {label}
    </Link>
  );
}
