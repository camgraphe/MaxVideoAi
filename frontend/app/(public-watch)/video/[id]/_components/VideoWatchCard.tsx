import type { ReactNode } from 'react';

export function VideoWatchCard({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-card border border-hairline bg-surface shadow-card ${className}`}>
      {children}
    </section>
  );
}
