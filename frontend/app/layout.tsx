import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MaxVideoAI — Generate',
  description: 'Capability-driven generate page powered by the MaxVideoAI mock API.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
