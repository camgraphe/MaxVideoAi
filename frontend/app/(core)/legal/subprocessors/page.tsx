import type { Metadata } from 'next';

type Subprocessor = {
  provider: string;
  service: string;
  location: string;
  data: string;
  notes?: string;
};

const SUBPROCESSORS: Subprocessor[] = [
  {
    provider: 'Stripe Payments Europe, Ltd.',
    service: 'Payment processing, fraud screening',
    location: 'EU (Ireland) / Global',
    data: 'Billing metadata, partial card details (tokenised), wallet transactions',
  },
  {
    provider: 'Neon (Neon, Inc.)',
    service: 'Primary application database',
    location: 'EU (Frankfurt)',
    data: 'Workspace data, receipts, consent ledger, job metadata',
  },
  {
    provider: 'Supabase',
    service: 'Authentication and user session management',
    location: 'EU (Paris)',
    data: 'Account credentials, email, auth logs',
  },
  {
    provider: 'Vercel Inc.',
    service: 'Hosting, CDN, serverless platform',
    location: 'Global (USA/EU edges)',
    data: 'Application content, logs, IP addresses (edge routing)',
  },
  {
    provider: 'Amazon Web Services (AWS S3)',
    service: 'Object storage for uploads and exports',
    location: 'EU (Paris) / EU (Frankfurt)',
    data: 'User-uploaded assets, DSAR exports, generated media',
  },
  {
    provider: 'Fal.ai',
    service: 'AI video inference APIs',
    location: 'USA / EU regions',
    data: 'Prompts, reference assets, inference outputs, job identifiers',
  },
  {
    provider: 'Resend, Inc.',
    service: 'Transactional email delivery',
    location: 'USA / EU',
    data: 'Email addresses, template variables, delivery metadata',
  },
];

export const metadata: Metadata = {
  title: 'Sub-processors',
  description: 'Third-party providers used by MaxVideoAI to deliver the Service.',
};

export default function SubprocessorsPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h2 className="text-xl font-semibold text-text-primary">Sub-processors</h2>
        <p className="text-sm text-text-secondary">
          We engage the following third parties to help deliver the Service. We maintain appropriate data-processing agreements and conduct regular reviews.
        </p>
        <p className="text-sm text-text-secondary">Last updated: 26 October 2025</p>
      </header>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-bg-secondary text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">
            <tr>
              <th scope="col" className="px-4 py-3">Provider</th>
              <th scope="col" className="px-4 py-3">Service</th>
              <th scope="col" className="px-4 py-3">Primary location</th>
              <th scope="col" className="px-4 py-3">Data processed</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-white">
            {SUBPROCESSORS.map((entry) => (
              <tr key={entry.provider}>
                <td className="px-4 py-4 font-medium text-text-primary">{entry.provider}</td>
                <td className="px-4 py-4 text-text-secondary">{entry.service}</td>
                <td className="px-4 py-4 text-text-secondary">{entry.location}</td>
                <td className="px-4 py-4 text-text-secondary">
                  {entry.data}
                  {entry.notes ? <span className="block text-xs text-text-muted">{entry.notes}</span> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-sm text-text-secondary">
        Need more information or a signed copy of our Data Processing Agreement? Contact{' '}
        <a href="mailto:privacy@maxvideoai.com" className="text-accent underline">privacy@maxvideoai.com</a>.
      </p>
    </div>
  );
}
