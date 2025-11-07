import type { Metadata } from 'next';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { MarketingNav } from '@/components/marketing/MarketingNav';

export const metadata: Metadata = {
  title: 'MaxVideo AI — The right engine for every shot',
  description: 'Quietly powerful AI video tools: pick the right engine, price before you generate, and run everything from one workspace.',
  openGraph: {
    title: 'MaxVideo AI — The right engine for every shot',
    description: 'Quietly powerful AI video tools: pay-as-you-go, price-before, always-current engines.',
    images: [
      {
        url: '/og/price-before.png',
        width: 1200,
        height: 630,
        alt: 'MaxVideo AI interface showing the Price-Before chip.',
      },
    ],
  },
};

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <MarketingNav />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
