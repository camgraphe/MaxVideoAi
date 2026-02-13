import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalVersionBadge } from '@/components/legal/LegalVersionBadge';
import { formatLegalDate, getLegalDocument } from '@/lib/legal';
import { ObfuscatedEmailLink } from '@/components/marketing/ObfuscatedEmailLink';
import { resolveLocale } from '@/lib/i18n/server';
import type { AppLocale } from '@/i18n/locales';
import { buildSeoMetadata } from '@/lib/seo/metadata';

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await resolveLocale()) as AppLocale;
  return buildSeoMetadata({
    locale,
    title: 'Cookie Policy',
    description: 'Overview of cookies and similar technologies used by MaxVideoAI.',
    hreflangGroup: 'legalCookies',
    englishPath: '/legal/cookies',
    availableLocales: ['en', 'fr', 'es'] as AppLocale[],
    ogType: 'article',
    imageAlt: 'Cookie Policy',
    robots: {
      index: false,
      follow: true,
    },
  });
}

export default async function CookiePolicyPage() {
  const document = await getLegalDocument('cookies');
  const version = document?.version ?? '2025-10-26';
  const effective = formatLegalDate(document?.publishedAt ?? `${version}T00:00:00Z`);

  return (
    <div className="stack-gap-lg">
      <header className="stack-gap-sm">
        <h2 className="text-xl font-semibold text-text-primary">Cookie Policy</h2>
        <p className="text-sm text-text-secondary">
          Version: {version} · Effective date: {effective ?? version}
        </p>
        <p className="text-sm text-text-secondary">
          Contact:{' '}
          <ObfuscatedEmailLink
            user="privacy"
            domain="maxvideoai.com"
            label="privacy@maxvideoai.com"
            placeholder="privacy [at] maxvideoai.com"
            unstyled
            className="font-medium underline underline-offset-2"
          />
        </p>
        <LegalVersionBadge docKey="cookies" doc={document} />
      </header>

      <article className="stack-gap-lg text-base leading-relaxed text-text-secondary">
        <p>
          This Cookie Policy explains how MaxVideoAI uses cookies, SDKs, and similar technologies when you visit maxvideoai.com or use the workspace.
          Some cookies are essential for the Service to function; others require your consent.
        </p>

        <section className="stack-gap-sm">
          <h3 className="text-lg font-semibold text-text-primary">1. What are cookies?</h3>
          <p>
            Cookies are small text files placed on your device. SDKs and pixels offer similar functionality. They help remember your preferences,
            secure your session, and measure how the Service is used.
          </p>
        </section>

        <section className="stack-gap-sm">
          <h3 className="text-lg font-semibold text-text-primary">2. How we use cookies</h3>
          <ul className="ml-5 list-disc space-y-2">
            <li><strong>Essential (required):</strong> authentication/session management, security, load balancing, fraud prevention, remembering consent.</li>
            <li><strong>Analytics (consent):</strong> measuring usage to improve features (page performance, funnel metrics, error rates).</li>
            <li><strong>Advertising (consent):</strong> measuring ad performance or personalising ads when enabled.</li>
          </ul>
          <p>
            We operate a consent management banner. Non-essential cookies are not set until you choose “Accept” or configure your preferences.
          </p>
        </section>

        <section className="stack-gap-sm">
          <h3 className="text-lg font-semibold text-text-primary">3. Google Consent Mode</h3>
          <p>
            When Google Analytics or Ads tags are active, we respect your choices through Google Consent Mode v2 signals
            (ad_storage, analytics_storage, ad_user_data, ad_personalization). Denying consent prevents those tags from collecting personal data.
          </p>
        </section>

        <section className="stack-gap-sm">
          <h3 className="text-lg font-semibold text-text-primary">4. Managing your choices</h3>
          <p>
            Use the cookie banner or{' '}
            <Link href="/legal/cookies-list" className="text-brand underline hover:text-brandHover">
              preference centre
            </Link>{' '}
            to review or change your selections at any time.
            You can also clear cookies in your browser settings, though doing so may impact functionality.
          </p>
        </section>

        <section className="stack-gap-sm">
          <h3 className="text-lg font-semibold text-text-primary">5. Cookies we use</h3>
          <p>
            We maintain a live inventory of cookies and SDKs, including provider, purpose, and duration, at{' '}
            <Link href="/legal/cookies-list" className="text-brand underline hover:text-brandHover">
              /legal/cookies-list
            </Link>
            .
          </p>
        </section>

        <section className="stack-gap-sm">
          <h3 className="text-lg font-semibold text-text-primary">6. Changes</h3>
          <p>
            We may update this Policy and our cookie inventory as the stack evolves. Significant changes will be communicated via the banner or an in-app notice.
          </p>
        </section>

        <section className="stack-gap-sm">
          <h3 className="text-lg font-semibold text-text-primary">7. Contact</h3>
          <p>
            Questions about cookies?{' '}
            <ObfuscatedEmailLink
              user="privacy"
              domain="maxvideoai.com"
              label="privacy@maxvideoai.com"
              placeholder="privacy [at] maxvideoai.com"
            />
            .
          </p>
          <p className="text-sm text-text-muted">Last updated: {effective ?? version}</p>
        </section>
      </article>
    </div>
  );
}
