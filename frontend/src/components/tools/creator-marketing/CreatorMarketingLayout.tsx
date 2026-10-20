import type { ReactNode } from 'react';
import localFont from 'next/font/local';
import './creator-marketing.css';

const creatorFont = localFont({
  src: '../../../../app/(core)/_fonts/GeistLatin.woff2',
  variable: '--font-creator', display: 'swap', weight: '100 900', preload: true,
});

export function CreatorMarketingLayout({ children }: { children: ReactNode }) {
  return <div className={`creator-marketing-surface ${creatorFont.variable}`}>{children}</div>;
}
