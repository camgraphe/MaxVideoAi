import type { Metadata } from 'next';
import type { ReactNode } from 'react';
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
    description: "Contactez l’équipe MaxVideoAI pour le support, les partenariats ou les demandes entreprise.",
  },
  es: {
    title: 'Contacto — MaxVideoAI',
    description: 'Habla con el equipo de MaxVideoAI para soporte, alianzas o solicitudes para equipos.',
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
  const { dictionary } = await resolveDictionary({ locale });
  const content = dictionary.contact;
  const statusHref = buildLocalizedPath(locale, STATUS_SLUG_MAP[locale] ?? STATUS_SLUG_MAP.en);
  const isSubmitted = isFlagged(searchParams.submitted);
  const hasError = isFlagged(searchParams.error);
  const successText =
    (content.form as { success?: string }).success ?? 'Message sent. We will get back to you shortly.';
  const errorText =
    (content.form as { error?: string }).error ??
    'We could not send your message. Please try again or reach out via email.';
  const intro = content.intro as
    | {
        body?: string;
        cards?: {
          productHelp?: { title?: string; body?: string };
          partnerships?: { title?: string; body?: string };
          press?: { title?: string; body?: string };
        };
      }
    | undefined;
  const faq = content.faq as
    | {
        title?: string;
        items?: Array<{ question?: string; answer?: string }>;
      }
    | undefined;
  const statusCard = content.statusCard as
    | {
        title?: string;
        body?: string;
        cta?: string;
      }
    | undefined;

  const introCards = intro?.cards ?? {};
  const faqItems = faq?.items ?? [];

  function renderPlaceholderText(text?: string, email?: ReactNode) {
    if (typeof text !== 'string') return text;
    const token = text.includes('{link}') ? '{link}' : '{email}';
    const [before, after] = text.split(token);
    return (
      <>
        {before}
        {email}
        {after ?? ''}
      </>
    );
  }

  return (
    <div className="container-page max-w-4xl section">
      <div className="stack-gap-lg">
        <header className="stack-gap-sm">
          <h1 className="text-3xl font-semibold text-text-primary sm:text-5xl">{content.hero.title}</h1>
          <p className="text-base leading-relaxed text-text-secondary">{content.hero.subtitle}</p>
        </header>
        <section className="rounded-card border border-hairline bg-surface/90 p-6 text-sm text-text-secondary shadow-card sm:p-8">
          <p>{intro?.body}</p>
          <div className="mt-5 grid grid-gap-sm sm:grid-cols-3">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-micro text-text-muted">{introCards.productHelp?.title}</h2>
              <p className="mt-2">{introCards.productHelp?.body}</p>
            </div>
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-micro text-text-muted">{introCards.partnerships?.title}</h2>
              <p className="mt-2">
                {renderPlaceholderText(
                  introCards.partnerships?.body,
                  <ObfuscatedEmailLink user="partners" domain="maxvideo.ai" label="partners@maxvideo.ai" />
                )}
              </p>
            </div>
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-micro text-text-muted">{introCards.press?.title}</h2>
              <p className="mt-2">{introCards.press?.body}</p>
            </div>
          </div>
        </section>
        <section className="rounded-card border border-hairline bg-surface p-6 shadow-card">
          {isSubmitted ? (
            <div className="mb-4 rounded-input border border-[var(--success-border)] bg-[var(--success-bg)] px-4 py-3 text-sm text-[var(--success)]">
              {successText}
            </div>
          ) : null}
          {hasError ? (
            <div className="mb-4 rounded-input border border-[var(--error-border)] bg-[var(--error-bg)] px-4 py-3 text-sm text-[var(--error)]">
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
                className="mt-2 w-full rounded-input border border-hairline bg-bg px-3 py-2 text-sm text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
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
            <ObfuscatedEmailLink user="support" domain="maxvideoai.com" label="support@maxvideoai.com" />
            {content.form.alt.split('{email}')[1] ?? ''}
          </div>
        </section>
        <section className="rounded-card border border-hairline bg-surface/90 p-6 shadow-card sm:p-8">
          <h2 className="text-lg font-semibold text-text-primary">{faq?.title}</h2>
          <dl className="mt-5 stack-gap-lg text-sm text-text-secondary">
            {faqItems.map((item) => (
              <div key={item.question}>
                <dt className="font-semibold text-text-primary">{item.question}</dt>
                <dd className="mt-2">{renderPlaceholderText(item.answer, <Link href={statusHref} className="font-semibold text-brand hover:text-brandHover">{statusCard?.cta}</Link>)}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section className="rounded-card border border-hairline bg-surface/90 p-6 shadow-card">
          <h2 className="text-lg font-semibold text-text-primary">{statusCard?.title}</h2>
          <p className="mt-2 text-sm text-text-secondary">{statusCard?.body}</p>
          <TextLink href={statusHref} className="mt-4 gap-1 text-sm" linkComponent={Link}>
            {statusCard?.cta} <span aria-hidden>→</span>
          </TextLink>
        </section>
      </div>
    </div>
  );
}
