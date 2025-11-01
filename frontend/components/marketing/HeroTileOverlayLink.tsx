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
        'pointer-events-auto absolute bottom-2 left-1/2 z-10 -translate-x-1/2 text-xs font-medium text-white/90 decoration-white/60 underline-offset-4 transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/40',
        className
      )}
    >
      {label}
    </Link>
  );
}
