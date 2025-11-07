import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalVersionBadge } from '@/components/legal/LegalVersionBadge';
import { formatLegalDate, getLegalDocument } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How MaxVideoAI collects, uses, stores, and protects personal data.',
};

export default async function PrivacyPage() {
  const document = await getLegalDocument('privacy');
  const version = document?.version ?? '2025-10-26';
  const effective = formatLegalDate(document?.publishedAt ?? `${version}T00:00:00Z`);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h2 className="text-xl font-semibold text-text-primary">Privacy Policy</h2>
        <p className="text-sm text-text-secondary">
          Version: {version} · Effective date: {effective ?? version}
        </p>
        <p className="text-sm text-text-secondary">
          Controller: MaxVideoAI (sole proprietorship in formation, France). Registered office: see{' '}
          <Link href="/legal/mentions" className="text-accent underline">
            legal mentions
          </Link>
          .
        </p>
        <p className="text-sm text-text-secondary">
          Contact: privacy@maxvideoai.com · legal@maxvideoai.com
        </p>
        <LegalVersionBadge docKey="privacy" doc={document} />
      </header>

      <article className="space-y-6 text-base leading-relaxed text-text-secondary">
        <p>
          This Privacy Policy explains how MaxVideoAI (“we”, “us”) collects, uses, discloses, and protects personal data when you visit
          maxvideoai.com, create an account, purchase top-ups, or generate AI outputs.
        </p>

        <section className="space-y-3">
          <h3 className="text-lg font-semibold text-text-primary">1. Scope</h3>
          <p>
            The Policy covers the processing of personal data across the MaxVideoAI workspace, including account management, billing, analytics,
            content generation, and support interactions.
          </p>
        </section>

        <section className="space-y-3">
          <h3 className="text-lg font-semibold text-text-primary">2. Categories of data we process</h3>
          <ul className="ml-5 list-disc space-y-2">
            <li><strong>Account &amp; identity:</strong> name, email, password hash, country/region, language.</li>
            <li><strong>Transactional:</strong> wallet operations, top-ups, receipts (amount, currency, tax, timestamps), job IDs.</li>
            <li><strong>Payments:</strong> processed by Stripe; we store Stripe identifiers and minimal payment metadata, never full card numbers.</li>
            <li><strong>Usage &amp; telemetry:</strong> device information, IP, user-agent, approximate location, feature flags, error diagnostics, logs.</li>
            <li><strong>Content:</strong> prompts, inputs, generated outputs, and file uploads needed to provide the Service.</li>
            <li><strong>Consents &amp; preferences:</strong> legal document versions accepted, cookie choices, marketing opt-in, preferred currency.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h3 className="text-lg font-semibold text-text-primary">3. Purposes &amp; legal bases (GDPR)</h3>
          <ul className="ml-5 list-disc space-y-2">
            <li><strong>Provide the Service:</strong> account management, wallet, video jobs, support — legal basis: contract.</li>
            <li><strong>Payments &amp; fraud prevention:</strong> processing payments, fraud monitoring — legal bases: contract, legitimate interests, legal obligation.</li>
            <li><strong>Analytics &amp; product improvement:</strong> measuring usage to improve features — legal bases: consent for non-essential cookies; otherwise legitimate interests with safeguards.</li>
            <li><strong>Marketing emails:</strong> sending product updates when you opt in — legal basis: consent (revocable anytime).</li>
            <li><strong>Legal compliance &amp; security:</strong> record keeping, audit trails, incident response — legal bases: legal obligation and legitimate interests.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h3 className="text-lg font-semibold text-text-primary">4. Retention</h3>
          <ul className="ml-5 list-disc space-y-2">
            <li><strong>Account data:</strong> kept for as long as you have an account, plus limited backup retention.</li>
            <li><strong>Receipts &amp; financial records:</strong> stored per statutory accounting periods.</li>
            <li><strong>Logs &amp; telemetry:</strong> retained for short rolling windows unless needed for security or abuse investigations.</li>
            <li>We anonymise or delete data when it is no longer required for the purposes above.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h3 className="text-lg font-semibold text-text-primary">5. Sharing &amp; sub-processors</h3>
          <p>
            We use trusted providers to operate the Service. Typical sub-processors include:
          </p>
          <ul className="ml-5 list-disc space-y-2">
            <li>Stripe (payments)</li>
            <li>Hosting/CDN (e.g., Vercel)</li>
            <li>Object storage (e.g., AWS S3)</li>
            <li>Database &amp; auth (Neon, Supabase)</li>
            <li>AI inference providers (e.g., Fal.ai)</li>
            <li>Email &amp; support tooling (transactional email, helpdesk)</li>
          </ul>
          <p>
            We maintain data-processing agreements with each provider. A current list is available at{' '}
            <Link href="/legal/subprocessors" className="text-accent underline">
              /legal/subprocessors
            </Link>
            .
          </p>
        </section>

        <section className="space-y-3">
          <h3 className="text-lg font-semibold text-text-primary">6. International transfers</h3>
          <p>
            When personal data leaves the EEA/UK, we rely on appropriate safeguards such as Standard Contractual Clauses and implement supplementary measures where required.
          </p>
        </section>

        <section className="space-y-3">
          <h3 className="text-lg font-semibold text-text-primary">7. Security</h3>
          <p>
            We apply technical and organisational measures including encryption in transit, access controls, least-privilege principles, monitoring, and incident response processes.
            No method is entirely secure, so we encourage strong passwords and two-factor authentication when available.
          </p>
        </section>

        <section className="space-y-3">
          <h3 className="text-lg font-semibold text-text-primary">8. Cookies &amp; similar technologies</h3>
          <p>
            We use essential cookies to run the site and, with your consent, analytics or advertising cookies. Consent can be withdrawn at any time via the cookie banner or settings.
            See the{' '}
            <Link href="/legal/cookies" className="text-accent underline">
              Cookie Policy
            </Link>{' '}
            for details.
          </p>
        </section>

        <section className="space-y-3">
          <h3 className="text-lg font-semibold text-text-primary">9. Your rights (EU/EEA/UK)</h3>
          <p>
            Subject to conditions and applicable law, you may request access, rectification, erasure, restriction, objection, and data portability. You may also withdraw consent at any time.
            To exercise rights, email <a href="mailto:privacy@maxvideoai.com" className="text-accent underline">privacy@maxvideoai.com</a>.
            You can lodge a complaint with your local data protection authority; in France, contact the CNIL.
          </p>
        </section>

        <section className="space-y-3">
          <h3 className="text-lg font-semibold text-text-primary">10. Children</h3>
          <p>
            The Service is not directed to children under 15/16. If you believe a child provided data without appropriate consent, contact us so we can delete the data.
          </p>
        </section>

        <section className="space-y-3">
          <h3 className="text-lg font-semibold text-text-primary">11. Changes</h3>
          <p>
            We may update this Policy. Material changes will be announced in-app or by email and may require renewed consent. The version and effective date appear above.
          </p>
        </section>

        <section className="space-y-3">
          <h3 className="text-lg font-semibold text-text-primary">12. Contact</h3>
          <p>
            Questions about privacy? Email <a href="mailto:privacy@maxvideoai.com" className="text-accent underline">privacy@maxvideoai.com</a>.
          </p>
          <p className="text-sm text-text-muted">Last updated: {effective ?? version}</p>
        </section>
      </article>
    </div>
  );
}
