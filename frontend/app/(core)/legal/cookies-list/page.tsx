import type { Metadata } from 'next';
import { ObfuscatedEmailLink } from '@/components/marketing/ObfuscatedEmailLink';

type CookieRow = {
  name: string;
  provider: string;
  purpose: string;
  duration: string;
  category: 'essential' | 'analytics' | 'advertising';
  notes?: string;
};

const COOKIES: CookieRow[] = [
  {
    name: 'sb-access-token',
    provider: 'Supabase',
    purpose: 'Authentication session token for logged-in users (required).',
    duration: '1 week (refreshes on activity)',
    category: 'essential',
  },
  {
    name: 'sb-refresh-token',
    provider: 'Supabase',
    purpose: 'Refresh token enabling silent session renewal (required).',
    duration: 'Rolling 4 weeks',
    category: 'essential',
  },
  {
    name: 'mv-consent',
    provider: 'MaxVideoAI',
    purpose: 'Stores cookie banner preferences (timestamp, categories).',
    duration: '13 months',
    category: 'essential',
  },
];

const CATEGORY_LABEL: Record<CookieRow['category'], string> = {
  essential: 'Essential',
  analytics: 'Analytics',
  advertising: 'Advertising',
};

export const metadata: Metadata = {
  title: 'Cookie list',
  description: 'Inventory of cookies and SDKs used by MaxVideoAI.',
};

export default function CookiesListPage() {
  const grouped = COOKIES.reduce<Record<CookieRow['category'], CookieRow[]>>(
    (acc, row) => {
      acc[row.category] ??= [];
      acc[row.category].push(row);
      return acc;
    },
    { essential: [], analytics: [], advertising: [] }
  );

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h2 className="text-xl font-semibold text-text-primary">Cookie &amp; SDK inventory</h2>
        <p className="text-sm text-text-secondary">
          We track the cookies and SDKs used on maxvideoai.com. Non-essential technologies are only activated after consent.
        </p>
        <p className="text-sm text-text-secondary">Last updated: 26 October 2025</p>
      </header>

      <article className="space-y-10 text-base leading-relaxed text-text-secondary">
        {(Object.keys(grouped) as CookieRow['category'][]).map((category) => (
          <section key={category} className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-text-primary">{CATEGORY_LABEL[category]} cookies</h3>
              {grouped[category].length === 0 ? (
                <p className="text-sm text-text-muted">
                  None currently in use. We will update this table before activating technologies in this category.
                </p>
              ) : (
                <p className="text-sm text-text-secondary">
                  {category === 'essential'
                    ? 'Required for the Service to function. They cannot be disabled in the consent manager.'
                    : 'Activated only after you grant consent in the cookie banner or preference centre.'}
                </p>
              )}
            </div>
            {grouped[category].length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border text-sm">
                  <thead className="bg-bg-secondary text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">
                    <tr>
                      <th scope="col" className="px-4 py-3">Name</th>
                      <th scope="col" className="px-4 py-3">Provider</th>
                      <th scope="col" className="px-4 py-3">Purpose</th>
                      <th scope="col" className="px-4 py-3">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-white">
                    {grouped[category].map((row) => (
                      <tr key={row.name}>
                        <td className="px-4 py-4 font-medium text-text-primary">{row.name}</td>
                        <td className="px-4 py-4 text-text-secondary">{row.provider}</td>
                        <td className="px-4 py-4 text-text-secondary">
                          {row.purpose}
                          {row.notes ? <span className="block text-xs text-text-muted">{row.notes}</span> : null}
                        </td>
                        <td className="px-4 py-4 text-text-secondary">{row.duration}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>
        ))} 

        <p className="text-sm text-text-secondary">
          Have questions or found an inconsistency? Contact{' '}
          <ObfuscatedEmailLink
            user="privacy"
            domain="maxvideoai.com"
            label="privacy@maxvideoai.com"
            placeholder="privacy [at] maxvideoai.com"
          />
          .
        </p>
      </article>
    </div>
  );
}
