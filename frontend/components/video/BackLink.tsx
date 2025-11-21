'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

type BackLinkProps = {
  href: string;
  label: string;
  className?: string;
};

export function BackLink({ href, label, className }: BackLinkProps) {
  const router = useRouter();

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>) => {
      if (window.history.length > 1) {
        event.preventDefault();
        router.back();
      }
    },
    [router]
  );

  return (
    <Link href={href} onClick={handleClick} className={className} prefetch={false}>
      {label}
    </Link>
  );
}
