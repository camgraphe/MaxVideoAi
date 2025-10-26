import Link from 'next/link';

export const dynamic = 'force-dynamic';

const SECTION_GROUPS: Array<{
  title: string;
  items: Array<{ title: string; description: string; href: string }>;
}> = [
  {
    title: 'Curation',
    items: [
      {
        title: 'Admin overview',
        description: 'Snapshots of recent activity and quick links to high-signal queues.',
        href: '/admin',
      },
      {
        title: 'Moderation queue',
        description: 'Review pending uploads, visibility flags, and indexation decisions.',
        href: '/admin/moderation',
      },
      {
        title: 'Playlists',
        description: 'Curate Starter and thematic collections surfaced in Gallery.',
        href: '/admin/playlists',
      },
      {
        title: 'Homepage programming',
        description: 'Schedule hero creatives and featured rails for the marketing homepage.',
        href: '/admin/home',
      },
    ],
  },
  {
    title: 'Operations',
    items: [
      {
        title: 'Users',
        description: 'Search, audit, and manage workspace members and permissions.',
        href: '/admin/users',
      },
      {
        title: 'Engines',
        description: 'Tune routing, pricing, and availability for model integrations.',
        href: '/admin/engines',
      },
      {
        title: 'Pricing rules',
        description: 'Manage margins, discounts, FX overrides, and membership tiers.',
        href: '/admin/pricing',
      },
      {
        title: 'Job audit',
        description: 'Verify recent renders for media availability, costs, and Fal sync.',
        href: '/admin/jobs',
      },
      {
        title: 'Transactions',
        description: 'Inspect charges and refunds, issue manual wallet credits.',
        href: '/admin/transactions',
      },
      {
        title: 'Payouts',
        description: 'Monitor vendor balances, view pending transfers, and trigger payouts.',
        href: '/admin/payouts',
      },
    ],
  },
  {
    title: 'Compliance',
    items: [
      {
        title: 'Legal center',
        description: 'Update terms, privacy, and cookie policies and trigger re-consent.',
        href: '/admin/legal',
      },
      {
        title: 'Consent exports',
        description: 'Download CSV proofs of user consents for regulatory reporting.',
        href: '/admin/consents.csv',
      },
    ],
  },
];

export default function AdminIndexPage() {
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold text-text-primary">Admin dashboard</h1>
        <p className="mt-2 text-sm text-text-secondary">
          Quick access to curation tools, operational controls, finance workflows, and compliance resources.
        </p>
      </header>
      {SECTION_GROUPS.map((group) => (
        <section key={group.title} className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-micro text-text-muted">{group.title}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {group.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-card border border-border bg-white p-6 shadow-card transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <h3 className="text-lg font-semibold text-text-primary">{item.title}</h3>
                <p className="mt-2 text-sm text-text-secondary">{item.description}</p>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
