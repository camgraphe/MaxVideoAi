import type { ReactNode } from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function BillingLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
