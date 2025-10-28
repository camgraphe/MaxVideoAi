import Link from 'next/link';
import type { Metadata } from 'next';
import { getLegalDocuments } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Legal Center',
  description: 'Access the latest MaxVideoAI legal documents and compliance resources.',
};

const LINKS: Array<{ href: string; label: string; docKey?: 'terms' | 'privacy' | 'cookies' }> = [
  { href: '/legal/terms', label: 'Terms of Service', docKey: 'terms' },
  { href: '/legal/privacy', label: 'Privacy Policy', docKey: 'privacy' },
  { href: '/legal/cookies', label: 'Cookie Policy', docKey: 'cookies' },
  { href: '/legal/acceptable-use', label: 'Acceptable Use Policy' },
  { href: '/legal/takedown', label: 'Notice & Takedown' },
  { href: '/legal/mentions', label: 'Mentions légales' },
  { href: '/legal/subprocessors', label: 'Sub-processors' },
];

export default async function LegalIndexPage() {
  const documents = await getLegalDocuments(['terms', 'privacy', 'cookies']);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-xl font-semibold text-text-primary">Legal center</h2>
        <p className="text-sm text-text-secondary">
          The definitive source for our legal agreements, privacy commitments, and compliance resources.
        </p>
      </header>

      <ul className="space-y-4">
        {LINKS.map((entry) => {
          const meta = entry.docKey ? documents[entry.docKey] : null;
          return (
            <li key={entry.href} className="rounded-card border border-border bg-white p-5 shadow-card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link
                    href={entry.href}
                    className="text-lg font-semibold text-accent transition hover:text-accentSoft"
                  >
                    {entry.label}
                  </Link>
                  {meta?.version ? (
                    <p className="mt-1 text-xs uppercase tracking-wide text-text-muted">Version {meta.version}</p>
                  ) : null}
                </div>
                <span aria-hidden className="text-text-muted">→</span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
