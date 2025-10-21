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
        title: 'Moderation queue',
        description: 'Review pending uploads and decide visibility/indexation.',
        href: '/admin/moderation',
      },
      {
        title: 'Playlists',
        description: 'Curate Starter and thematic collections surfaced in Gallery.',
        href: '/admin/playlists',
      },
      {
        title: 'Homepage programming',
        description: 'Pick hero highlight and featured rails for the marketing homepage.',
        href: '/admin/home',
      },
    ],
  },
  {
    title: 'Operations',
    items: [
      {
        title: 'Users',
        description: 'Search, audit, and manage workspace members.',
        href: '/admin/users',
      },
      {
        title: 'Engines',
        description: 'Tune routing, pricing, and availability for model integrations.',
        href: '/admin/engines',
      },
      {
        title: 'Pricing rules',
        description: 'Configure margins, discounts, and membership tiers.',
        href: '/admin/pricing',
      },
      {
        title: 'Payouts',
        description: 'Monitor vendor balances and manual payouts.',
        href: '/admin/payouts',
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
          Quick access to curation tools, operational controls, and configuration panels.
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
