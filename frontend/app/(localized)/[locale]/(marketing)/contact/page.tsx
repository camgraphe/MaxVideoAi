import type { Metadata } from 'next';
import type { AppLocale } from '@/i18n/locales';
import { Link } from '@/i18n/navigation';
import { resolveDictionary } from '@/lib/i18n/server';
import { buildSlugMap } from '@/lib/i18nSlugs';
import { buildMetadataUrls } from '@/lib/metadataUrls';

const CONTACT_SLUG_MAP = buildSlugMap('contact');

export async function generateMetadata({ params }: { params: { locale: AppLocale } }): Promise<Metadata> {
  const metadataUrls = buildMetadataUrls(params.locale, CONTACT_SLUG_MAP);
  return {
    title: 'Contact — MaxVideo AI',
    description: 'Reach the MaxVideo AI team for support, partnerships, and enterprise onboarding.',
    keywords: ['AI video', 'text-to-video', 'price calculator', 'pay-as-you-go', 'model-agnostic'],
    alternates: {
      canonical: metadataUrls.canonical,
      languages: metadataUrls.languages,
    },
    openGraph: {
      title: 'Contact — MaxVideo AI',
      description: 'Get in touch with MaxVideo AI support or sales.',
      url: metadataUrls.canonical,
      siteName: 'MaxVideoAI',
      images: [
        {
          url: '/og/price-before.png',
          width: 1200,
          height: 630,
          alt: 'Contact MaxVideo AI.',
        },
      ],
      locale: metadataUrls.ogLocale,
      alternateLocale: metadataUrls.alternateOg,
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Contact — MaxVideo AI',
      description: 'Get in touch with MaxVideo AI support or sales.',
      images: ['/og/price-before.png'],
    },
  };
}

export default async function ContactPage() {
  const { dictionary } = await resolveDictionary();
  const content = dictionary.contact;

  return (
    <div className="mx-auto max-w-4xl px-4 pb-24 pt-16 sm:px-6 lg:px-8">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold text-text-primary sm:text-4xl">{content.hero.title}</h1>
        <p className="text-base text-text-secondary">{content.hero.subtitle}</p>
      </header>
      <section className="mt-8 rounded-card border border-hairline bg-white/90 p-6 text-sm text-text-secondary shadow-card sm:p-8">
        <p>
          Talk to us about anything from enterprise onboarding to editorial coverage. Messages that include context—team
          size, target models, deadline, or compliance requirements—reach the right specialist faster. Every request
          receives a human reply; we do not outsource support or sales.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-micro text-text-muted">Product help</h2>
            <p className="mt-2">
              For issues with renders, billing, or engine routing, include the job ID and we will review the trace
              directly in the workspace.
            </p>
          </div>
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-micro text-text-muted">Partnerships</h2>
            <p className="mt-2">
              Agencies and studios can request custom SLAs, shared wallets, or white-label docs through this form or by
              emailing <a href="mailto:partners@maxvideo.ai" className="font-semibold text-accent hover:text-accentSoft">partners@maxvideo.ai</a>.
            </p>
          </div>
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-micro text-text-muted">Press</h2>
            <p className="mt-2">
              Journalists can ask for interview slots, product demos, or comment on frontier models. Please include your
              publication and deadline.
            </p>
          </div>
        </div>
      </section>
      <section className="mt-12 rounded-card border border-hairline bg-white p-6 shadow-card">
        <form className="space-y-4" method="post" action="#" aria-label={content.hero.title}>
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-text-secondary">
              {content.form.name}
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              className="mt-2 w-full rounded-input border border-hairline bg-bg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-text-secondary">
              {content.form.email}
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="mt-2 w-full rounded-input border border-hairline bg-bg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            />
          </div>
          <div>
            <label htmlFor="topic" className="block text-sm font-medium text-text-secondary">
              {content.form.topic}
            </label>
            <select
              id="topic"
              name="topic"
              defaultValue=""
              className="mt-2 w-full rounded-input border border-hairline bg-bg px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              aria-label={content.form.topic}
            >
              <option value="" disabled>
                {content.form.selectPlaceholder}
              </option>
              {content.form.topics.map((topic) => (
                <option key={topic.value} value={topic.value}>
                  {topic.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="message" className="block text-sm font-medium text-text-secondary">
              {content.form.message}
            </label>
            <textarea
              id="message"
              name="message"
              rows={4}
              required
              className="mt-2 w-full rounded-input border border-hairline bg-bg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            />
          </div>
          <button
            type="submit"
            className="inline-flex items-center rounded-pill bg-accent px-5 py-2 text-sm font-semibold text-white shadow-card transition hover:bg-accentSoft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            {content.form.submit}
          </button>
        </form>
        <div className="mt-6 rounded-card border border-dashed border-hairline bg-bg px-4 py-3 text-sm text-text-secondary">
          {content.form.alt.split('{email}')[0]}
          <a href="mailto:support@maxvideo.ai" className="font-semibold text-accent hover:text-accentSoft">
            support@maxvideo.ai
          </a>
          {content.form.alt.split('{email}')[1] ?? ''}
        </div>
      </section>
      <section className="mt-12 rounded-card border border-hairline bg-white/90 p-6 shadow-card sm:p-8">
        <h2 className="text-lg font-semibold text-text-primary">Contact FAQ</h2>
        <dl className="mt-5 space-y-5 text-sm text-text-secondary">
          <div>
            <dt className="font-semibold text-text-primary">How fast will someone reply?</dt>
            <dd className="mt-2">
              We answer during European and US business hours. Most support tickets receive a human response in under 12
              hours, enterprise requests inside 24.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-text-primary">Do you offer live demos?</dt>
            <dd className="mt-2">
              Yes—include your preferred time zone and the models you want to see. We run demos inside the MaxVideoAI
              workspace so you can watch routing and pricing in real time.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-text-primary">Where can I check service status?</dt>
            <dd className="mt-2">
              Visit the{' '}
              <Link href="/status" className="font-semibold text-accent hover:text-accentSoft">
                status page
              </Link>{' '}
              for current engine latency and incident history before opening a ticket.
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
