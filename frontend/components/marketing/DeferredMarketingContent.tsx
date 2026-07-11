import type { ReactNode } from 'react';

export function DeferredMarketingContent({ children }: { children: ReactNode }) {
  return <div className="[content-visibility:auto] [contain-intrinsic-size:auto_1200px]">{children}</div>;
}
