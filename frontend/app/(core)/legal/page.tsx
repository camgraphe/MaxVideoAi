import Link from 'next/link';
import type { Metadata } from 'next';
import { getLegalDocuments } from '@/lib/legal';
import { SITE_BASE_URL } from '@/lib/metadataUrls';

const LEGAL_INDEX_URL = `${SITE_BASE_URL}/legal`;

export const metadata: Metadata = {
  title: 'Legal Center',
  description: 'Access the latest MaxVideoAI legal documents and compliance resources.',
  alternates: {
    canonical: LEGAL_INDEX_URL,
  },
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

      <section className="rounded-card border border-hairline bg-white/90 p-5 text-sm text-text-secondary shadow-card sm:p-6">
        <p>
          Every document here reflects the current production terms for MaxVideoAI. We update policies whenever routing
          infrastructure, data retention, or partner requirements change, and the most recent version id is referenced
          directly in the workspace. Use this hub to confirm contractual language, review subprocessors, or download
          artefacts for your compliance team.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-micro text-text-muted">Staying informed</h3>
            <p className="mt-2">
              Subscribe to the changelog for release-level updates and check the status page when you need live incident
              context. Legal updates are timestamped and summarized at the top of each article.
            </p>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-micro text-text-muted">Need agreements?</h3>
            <p className="mt-2">
              Enterprise customers can request signed DPAs, security questionnaires, or SOC documentation by emailing{' '}
              <a href="mailto:legal@maxvideo.ai" className="font-semibold text-accent hover:text-accentSoft">
                legal@maxvideo.ai
              </a>{' '}
              with their company details and required forms.
            </p>
          </div>
        </div>
      </section>

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
