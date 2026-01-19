import type { Metadata } from 'next';
import type { AppLocale } from '@/i18n/locales';
import { localePathnames } from '@/i18n/locales';
import { Link } from '@/i18n/navigation';
import { resolveDictionary } from '@/lib/i18n/server';
import { buildSlugMap } from '@/lib/i18nSlugs';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import { ObfuscatedEmailLink } from '@/components/marketing/ObfuscatedEmailLink';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { TextLink } from '@/components/ui/TextLink';

const CONTACT_SLUG_MAP = buildSlugMap('contact');
const STATUS_SLUG_MAP = buildSlugMap('status');
const CONTACT_META: Record<AppLocale, { title: string; description: string }> = {
  en: {
    title: 'Contact MaxVideoAI — Support & Partnerships',
    description: 'Reach the MaxVideoAI team for support, partnerships, and enterprise onboarding.',
  },
  fr: {
    title: 'Contact — MaxVideoAI',
    description: "Contactez l’équipe MaxVideoAI pour le support, les partenariats ou l’onboarding entreprise.",
  },
  es: {
    title: 'Contacto — MaxVideoAI',
    description: 'Habla con el equipo de MaxVideoAI para soporte, alianzas o incorporación empresarial.',
  },
};

function buildLocalizedPath(locale: AppLocale, slug?: string) {
  const prefix = localePathnames[locale] ? `/${localePathnames[locale]}` : '';
  const normalized = slug ? `/${slug.replace(/^\/+/, '')}` : '';
  return (prefix + normalized || '/').replace(/\/{2,}/g, '/');
}

export async function generateMetadata({ params }: { params: { locale: AppLocale } }): Promise<Metadata> {
  const locale = params.locale;
  const metaCopy = CONTACT_META[locale] ?? CONTACT_META.en;
  return buildSeoMetadata({
    locale,
    title: metaCopy.title,
    description: metaCopy.description,
    hreflangGroup: 'contact',
    slugMap: CONTACT_SLUG_MAP,
    keywords: ['AI video', 'text-to-video', 'price calculator', 'pay-as-you-go', 'model-agnostic'],
    imageAlt: 'Contact MaxVideo AI.',
  });
}

function isFlagged(value: string | string[] | undefined, target = '1') {
  if (!value) return false;
  if (Array.isArray(value)) return value.some((entry) => entry === target);
  return value === target;
}

export default async function ContactPage({
  params,
  searchParams,
}: {
  params: { locale: AppLocale };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const locale = params.locale;
  const { dictionary } = await resolveDictionary();
  const content = dictionary.contact;
  const statusHref = buildLocalizedPath(locale, STATUS_SLUG_MAP[locale] ?? STATUS_SLUG_MAP.en);
  const isSubmitted = isFlagged(searchParams.submitted);
  const hasError = isFlagged(searchParams.error);
  const successText =
    (content.form as { success?: string }).success ?? 'Message sent. We will get back to you shortly.';
  const errorText =
    (content.form as { error?: string }).error ??
    'We could not send your message. Please try again or reach out via email.';

  return (
    <div className="container-page max-w-4xl section">
      <header className="stack-gap-sm">
        <h1 className="text-3xl font-semibold text-text-primary sm:text-5xl">{content.hero.title}</h1>
        <p className="text-base leading-relaxed text-text-secondary">{content.hero.subtitle}</p>
      </header>
      <section className="mt-8 rounded-card border border-hairline bg-white/90 p-6 text-sm text-text-secondary shadow-card sm:p-8">
        <p>
          Talk to us about anything from enterprise onboarding to editorial coverage. Messages that include context—team
          size, target models, deadline, or compliance requirements—reach the right specialist faster. Every request
          receives a human reply; we do not outsource support or sales.
        </p>
        <div className="mt-5 grid grid-gap-sm sm:grid-cols-3">
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
              emailing{' '}
              <ObfuscatedEmailLink user="partners" domain="maxvideo.ai" label="partners@maxvideo.ai" />
              .
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
        {isSubmitted ? (
          <div className="mb-4 rounded-input border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            {successText}
          </div>
        ) : null}
        {hasError ? (
          <div className="mb-4 rounded-input border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {errorText}
          </div>
        ) : null}
        <form className="stack-gap" method="post" action="/api/contact" aria-label={content.hero.title}>
          <input type="hidden" name="locale" value={locale} />
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-text-secondary">
              {content.form.name}
            </label>
            <Input
              id="name"
              name="name"
              type="text"
              required
              className="mt-2"
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-text-secondary">
              {content.form.email}
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              className="mt-2"
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
              className="mt-2 w-full rounded-input border border-hairline bg-bg px-3 py-2 text-sm text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-white"
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
            <Textarea
              id="message"
              name="message"
              rows={4}
              required
              className="mt-2"
            />
          </div>
          <Button type="submit" className="shadow-card">
            {content.form.submit}
          </Button>
        </form>
        <div className="mt-6 rounded-card border border-dashed border-hairline bg-bg px-4 py-3 text-sm text-text-secondary">
          {content.form.alt.split('{email}')[0]}
          <ObfuscatedEmailLink user="support" domain="maxvideo.ai" label="support@maxvideo.ai" />
          {content.form.alt.split('{email}')[1] ?? ''}
        </div>
      </section>
      <section className="mt-12 rounded-card border border-hairline bg-white/90 p-6 shadow-card sm:p-8">
        <h2 className="text-lg font-semibold text-text-primary">Contact FAQ</h2>
        <dl className="mt-5 stack-gap-lg text-sm text-text-secondary">
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
              <Link href={statusHref} className="font-semibold text-brand hover:text-brandHover">
                status page
              </Link>{' '}
              for current engine latency and incident history before opening a ticket.
            </dd>
          </div>
        </dl>
      </section>
      <section className="mt-12 rounded-card border border-hairline bg-white/90 p-6 shadow-card">
        <h2 className="text-lg font-semibold text-text-primary">Check live engine status</h2>
        <p className="mt-2 text-sm text-text-secondary">
          Before opening a ticket, confirm whether an engine is already degraded. Status updates list latency, incident notes,
          and mitigation steps so you can decide whether to retry or switch models.
        </p>
        <TextLink href={statusHref} className="mt-4 gap-1 text-sm" linkComponent={Link}>
          View status page <span aria-hidden>→</span>
        </TextLink>
      </section>
    </div>
  );
}
