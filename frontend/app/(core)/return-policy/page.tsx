import type { Metadata } from 'next';
import Link from 'next/link';
import { ObfuscatedEmailLink } from '@/components/marketing/ObfuscatedEmailLink';
import { buildSeoMetadata } from '@/lib/seo/metadata';

export function generateMetadata(): Metadata {
  return buildSeoMetadata({
    locale: 'en',
    title: 'Refund & Return Policy | MaxVideoAI',
    description: 'Refund and return policy for MaxVideoAI digital AI video generation credits and services.',
    englishPath: '/return-policy',
    availableLocales: ['en'],
    canonicalOverride: 'https://maxvideoai.com/return-policy',
    ogType: 'article',
    imageAlt: 'MaxVideoAI refund and return policy.',
    titleBranding: 'none',
  });
}

function SupportEmailLink() {
  return (
    <ObfuscatedEmailLink
      user="support"
      domain="maxvideoai.com"
      label="support@maxvideoai.com"
      placeholder="support [at] maxvideoai.com"
      className="font-medium"
    />
  );
}

export default function ReturnPolicyPage() {
  return (
    <main className="bg-bg py-10 sm:py-16">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-5 sm:px-8">
        <header className="flex items-baseline justify-between gap-4">
          <h2 className="text-2xl font-semibold text-text-primary">Legal</h2>
          <Link
            href="/"
            className="text-sm font-medium text-brand transition hover:text-brandHover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            Back to homepage
          </Link>
        </header>

        <section className="stack-gap-xl rounded-card border border-border bg-surface p-6 shadow-card sm:p-10">
          <header className="stack-gap-sm">
            <h1 className="text-xl font-semibold text-text-primary">Refund &amp; Return Policy</h1>
            <p className="text-sm text-text-secondary">Last updated: June 2, 2026</p>
          </header>

          <article className="stack-gap-lg text-base leading-relaxed text-text-secondary">
            <section className="stack-gap-sm">
              <h3 className="text-lg font-semibold text-text-primary">1. Overview</h3>
              <p>
                MaxVideoAI provides digital AI video generation services, wallet credits, and related software access. We do not sell or
                ship physical products. Because our services are digital, there is no physical return process and no product exchange
                process.
              </p>
            </section>

            <section className="stack-gap-sm">
              <h3 className="text-lg font-semibold text-text-primary">2. Failed or defective generations</h3>
              <p>
                If a generation job fails because of a technical issue on MaxVideoAI&apos;s side, we may automatically refund the related
                charge to the user&apos;s wallet or, where appropriate, refund the original payment method.
              </p>
              <p>A failed or defective generation may include:</p>
              <ul className="ml-5 list-disc space-y-2">
                <li>a job that cannot be completed due to a platform or provider error;</li>
                <li>credits charged for a generation that never starts or never completes;</li>
                <li>a confirmed technical failure preventing delivery of the requested digital output.</li>
              </ul>
              <p>
                Refunds are not normally issued for subjective dissatisfaction with an AI-generated result, prompt choices, uploaded inputs,
                or expected creative variations, unless required by applicable law.
              </p>
            </section>

            <section className="stack-gap-sm">
              <h3 className="text-lg font-semibold text-text-primary">3. Successful digital generations</h3>
              <p>
                Once credits have been used and a generation has been successfully delivered, the purchase is generally non-returnable and
                non-refundable because the service has already been performed and digital resources have been consumed.
              </p>
              <p>This does not affect any mandatory consumer rights that may apply in the user&apos;s country of residence.</p>
            </section>

            <section className="stack-gap-sm">
              <h3 className="text-lg font-semibold text-text-primary">4. Wallet credits and unused balances</h3>
              <p>
                Unused wallet credits may be reviewed for refund on request, subject to payment processor limitations, fraud checks,
                promotional credit exclusions, and applicable law.
              </p>
              <p>Promotional, bonus, or free credits have no cash value and are not refundable.</p>
            </section>

            <section className="stack-gap-sm">
              <h3 className="text-lg font-semibold text-text-primary">5. Right of withdrawal for EU/EEA/UK consumers</h3>
              <p>If you are a consumer in the EU, EEA, or UK, you may have a statutory right of withdrawal for distance purchases.</p>
              <p>
                However, where digital content or a digital service begins immediately with your prior express consent and your
                acknowledgement that you may lose your right of withdrawal once performance begins, that right may not apply to credits or
                generation jobs that have already been used, started, or delivered.
              </p>
              <p>Nothing in this policy limits any mandatory consumer protection rights that apply to you.</p>
            </section>

            <section className="stack-gap-sm">
              <h3 className="text-lg font-semibold text-text-primary">6. Exchanges</h3>
              <p>We do not offer exchanges, because MaxVideoAI provides digital services and not physical products.</p>
            </section>

            <section className="stack-gap-sm">
              <h3 className="text-lg font-semibold text-text-primary">7. How to request a refund review</h3>
              <p>
                To request a refund review, contact us at <SupportEmailLink /> with:
              </p>
              <ul className="ml-5 list-disc space-y-2">
                <li>the email address linked to your MaxVideoAI account;</li>
                <li>the transaction ID or receipt, if available;</li>
                <li>the generation/job ID, if applicable;</li>
                <li>a short explanation of the issue.</li>
              </ul>
              <p>We may request additional information to verify the issue.</p>
            </section>

            <section className="stack-gap-sm">
              <h3 className="text-lg font-semibold text-text-primary">8. Refund processing time</h3>
              <p>Approved wallet credit refunds are usually applied as soon as the failed job is confirmed.</p>
              <p>
                Approved payment refunds are processed through our payment provider. The time for funds to appear on your card, bank account,
                or payment method depends on your payment provider and bank.
              </p>
            </section>

            <section className="stack-gap-sm">
              <h3 className="text-lg font-semibold text-text-primary">9. Contact</h3>
              <p>
                For refund or return policy questions, contact: <SupportEmailLink />.
              </p>
            </section>
          </article>
        </section>
      </div>
    </main>
  );
}
