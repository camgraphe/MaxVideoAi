'use client';

import { type ReactNode, useEffect, useState } from 'react';
import clsx from 'clsx';

type ResponsiveDetailsProps = {
  summary: ReactNode;
  className?: string;
  summaryClassName?: string;
  openOnDesktop?: boolean;
  children: ReactNode;
};

export function ResponsiveDetails({
  summary,
  className,
  summaryClassName,
  openOnDesktop = false,
  children,
}: ResponsiveDetailsProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!openOnDesktop) return;
    const isDesktop = window.matchMedia('(min-width: 1024px)').matches;
    setOpen(isDesktop);
  }, [openOnDesktop]);

  return (
    <details
      open={open}
      onToggle={(event) => setOpen((event.currentTarget as HTMLDetailsElement).open)}
      className={clsx(className)}
    >
      <summary className={clsx(summaryClassName)}>{summary}</summary>
      {children}
    </details>
  );
}
