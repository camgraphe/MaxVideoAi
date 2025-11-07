import type { Metadata } from 'next';
import { resolveDictionary } from '@/lib/i18n/server';

export const metadata: Metadata = {
  title: 'Status — MaxVideo AI',
  description: 'Live status for engines, queue health, and incidents.',
  keywords: ['AI video', 'text-to-video', 'price calculator', 'pay-as-you-go', 'model-agnostic'],
  openGraph: {
    title: 'Status — MaxVideo AI',
    description: 'Live and historical uptime for engines and queue processing.',
    images: [
      {
        url: '/og/price-before.png',
        width: 1200,
        height: 630,
        alt: 'Status indicators.',
      },
    ],
  },
  alternates: {
    canonical: 'https://maxvideoai.com/status',
    languages: {
      en: 'https://maxvideoai.com/status',
      fr: 'https://maxvideoai.com/status?lang=fr',
    },
  },
};

const STATUS_BADGE_CLASSES: Record<string, string> = {
  Operational: 'bg-emerald-100 text-emerald-700',
  Dégradé: 'bg-amber-100 text-amber-700',
  Degraded: 'bg-amber-100 text-amber-700',
};

export default async function StatusPage() {
  const { dictionary } = await resolveDictionary();
  const content = dictionary.status;

  return (
    <div className="mx-auto max-w-4xl px-4 pb-24 pt-16 sm:px-6 lg:px-8">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold text-text-primary sm:text-4xl">{content.hero.title}</h1>
        <p className="text-base text-text-secondary">{content.hero.subtitle}</p>
      </header>
      <section className="mt-8 rounded-card border border-hairline bg-white/90 p-6 text-sm text-text-secondary shadow-card sm:p-8">
        <p>
          Status checks refresh continuously from the same telemetry we use to route renders. When an engine moves from
          “Operational” to “Degraded”, MaxVideoAI automatically shifts traffic to the fastest available region and posts
          an incident below. If an outage requires customer action we flag it in the incident notes and reference the
          job IDs that may need a retry or credit refund.
        </p>
        <p className="mt-4">
          Before contacting support, confirm whether the engine you are using shows a disruption and review the incident
          history. You can also subscribe to the RSS feed or email digest to receive alerts the moment we downgrade an
          engine. For urgent escalations, include the job ID and engine name so we can trace the queue instantly.
        </p>
        <div className="mt-5 rounded-card border border-dashed border-hairline bg-bg/70 p-4">
          <h2 className="text-xs font-semibold uppercase tracking-micro text-text-muted">Quick references</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            <li>
              <span className="font-semibold text-text-primary">Render queue latency</span> — typically updates every 60 seconds.
            </li>
            <li>
              <span className="font-semibold text-text-primary">Incident log</span> — entries include start/end time, root cause,
              and mitigation steps.
            </li>
            <li>
              <span className="font-semibold text-text-primary">Support</span> — email{' '}
              <a href="mailto:support@maxvideo.ai" className="font-semibold text-accent hover:text-accentSoft">
                support@maxvideo.ai
              </a>{' '}
              with incident code + job ID for a priority response.
            </li>
          </ul>
        </div>
      </section>
      <section className="mt-12 space-y-4">
        {content.systems.map((system) => (
          <article key={system.name} className="flex items-start justify-between gap-4 rounded-card border border-hairline bg-white p-4 shadow-card">
            <div>
              <h2 className="text-sm font-semibold text-text-primary">{system.name}</h2>
              <p className="text-xs text-text-secondary">{system.detail}</p>
            </div>
            <span
              className={`rounded-pill px-3 py-1 text-xs font-semibold uppercase tracking-micro ${
                STATUS_BADGE_CLASSES[system.status] ?? 'bg-emerald-100 text-emerald-700'
              }`}
            >
              {system.status}
            </span>
          </article>
        ))}
      </section>
      <section className="mt-12 rounded-card border border-hairline bg-white p-6 shadow-card">
        <h2 className="text-lg font-semibold text-text-primary">Incidents</h2>
        {content.incidents.map((incident) => (
          <article key={incident.date} className="mt-4 border-t border-hairline pt-4 first:border-none first:pt-0">
            <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{incident.date}</p>
            <h3 className="text-sm font-semibold text-text-primary">{incident.title}</h3>
            <p className="mt-1 text-sm text-text-secondary">{incident.summary}</p>
            <span className="mt-2 inline-flex rounded-pill bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-micro text-emerald-700">
              {incident.status}
            </span>
          </article>
        ))}
      </section>
    </div>
  );
}
