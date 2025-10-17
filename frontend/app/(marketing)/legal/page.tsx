import type { Metadata } from 'next';
import Link from 'next/link';
import { resolveDictionary } from '@/lib/i18n/server';

export const metadata: Metadata = {
  title: 'Legal — MaxVideo AI',
  description: 'Central hub for MaxVideo AI terms and privacy policies.',
  openGraph: {
    title: 'Legal — MaxVideo AI',
    description: 'Access MaxVideo AI legal documents including terms of service and privacy policy.',
  },
  alternates: {
    canonical: 'https://maxvideoai.com/legal',
  },
};

export default function LegalPage() {
  const { dictionary } = resolveDictionary();
  const legal = [
    { href: '/legal/terms', label: dictionary.legal?.terms?.title ?? 'Terms of service' },
    { href: '/legal/privacy', label: dictionary.legal?.privacy?.title ?? 'Privacy policy' },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-16 sm:px-6 lg:px-8">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold text-text-primary sm:text-4xl">Legal</h1>
        <p className="text-base text-text-secondary">All policies governing the MaxVideo AI platform.</p>
      </header>
      <ul className="mt-10 space-y-4">
        {legal.map((item) => (
          <li key={item.href} className="rounded-card border border-hairline bg-white p-5 shadow-card">
            <Link href={item.href} className="text-lg font-semibold text-accent hover:text-accentSoft">
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
