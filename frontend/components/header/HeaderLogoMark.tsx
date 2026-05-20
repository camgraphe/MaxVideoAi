'use client';

import Image from 'next/image';
import Link from 'next/link';

export function HeaderLogoMark() {
  return (
    <Link href="/" className="flex items-center gap-2">
      <Image
        src="/assets/branding/logo-mark.svg"
        alt=""
        aria-hidden="true"
        width={32}
        height={32}
        className="shrink-0"
        priority
      />
      <span className="sr-only text-sm font-semibold tracking-normal text-text-primary sm:not-sr-only sm:inline sm:text-lg">MaxVideoAI</span>
    </Link>
  );
}
