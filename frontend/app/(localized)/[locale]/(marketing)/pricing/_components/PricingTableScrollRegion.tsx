import type { ReactNode } from 'react';

type PricingTableScrollRegionProps = {
  children: ReactNode;
  className?: string;
  id?: string;
  labelledBy: string;
};

export function PricingTableScrollRegion({
  children,
  className = '',
  id,
  labelledBy,
}: PricingTableScrollRegionProps) {
  return (
    <div
      id={id}
      role="region"
      aria-labelledby={labelledBy}
      tabIndex={0}
      className={`${className} overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg`}
    >
      {children}
    </div>
  );
}
