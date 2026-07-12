import Link from 'next/link';
import { ObfuscatedEmailLink } from '@/components/marketing/ObfuscatedEmailLink';

export function TermsArticleEn({
  version,
  effective,
  subprocessorsHref,
}: {
  version: string;
  effective: string | null;
  subprocessorsHref: string;
}) {
  return (
    <article className="stack-gap-lg text-base leading-relaxed text-text-secondary">
      <p>
        These Terms govern your access to and use of the MaxVideoAI workspace (the “Service”), including AI-assisted video creation, wallet
        top-ups, job management, and receipts. By creating an account or using the Service you agree to these Terms, the Privacy Policy, and
        the Cookie Policy.
      </p>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">1. Eligibility &amp; age</h3>
        <p>
          You must be at least <strong>15 years old</strong> (or the age of digital consent in your country, whichever is higher) to use the Service. If you
          use the Service on behalf of a business or organisation, you confirm that you have authority to bind that entity.
        </p>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">2. Your account</h3>
        <p>
          Keep your credentials confidential and do not share them. You are responsible for all activity that happens under your account. We may
          suspend or terminate accounts that breach these Terms, misuse the Service, or break the law.
        </p>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">3. Pricing, payments &amp; wallet</h3>
        <ul className="ml-5 list-disc space-y-2">
          <li>
            <strong>Platform-only payments.</strong> Card payments are processed by Stripe to our own platform account. We do not facilitate split payouts.
          </li>
          <li>
            <strong>Wallet top-ups.</strong> You can add funds to your wallet. Balances and receipts show the currency displayed at checkout.
          </li>
          <li>
            <strong>Receipts.</strong> Receipts list the price paid (plus applicable taxes/discounts). We do not expose margins, platform fees, or take-rates.
          </li>
          <li>
            <strong>Taxes.</strong> Prices may be shown inclusive or exclusive of tax depending on your location. Applicable taxes are displayed at checkout and on receipts.
          </li>
          <li>
            <strong>Refunds.</strong> If we cannot deliver a job because of a technical failure on our side, we may refund the charge to the original payment method or credit your wallet, in line with consumer law.
          </li>
        </ul>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">4. Currency</h3>
        <p>
          Charges may be in EUR or USD depending on your location or saved preference. Wallet balances and receipts reflect the charged currency. If
          your payment method is in a different currency, your bank may apply FX or additional fees.
        </p>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">5. AI-assisted outputs</h3>
        <ul className="ml-5 list-disc space-y-2">
          <li>You are responsible for the prompts, inputs, and use of outputs. Do not submit illegal, infringing, or harmful content.</li>
          <li>Outputs are probabilistic, may contain artefacts, and can be inaccurate. Review and validate them before use.</li>
          <li>Do not use outputs to violate rights (privacy, publicity, IP) or applicable laws. Clearly disclose any synthetic media when required.</li>
        </ul>
      </section>

      <section id="generated-media-rights" className="stack-gap-sm scroll-mt-[calc(var(--header-height)+24px)]">
        <h3 className="text-lg font-semibold text-text-primary">6. User content &amp; generated media</h3>
        <p>
          You own your prompts, uploads, reference frames, captions, and other assets you provide to the Service. We may store, process, and display
          uploaded assets solely to deliver the requested text-to-video or image-to-video renders, route jobs, provide workspace features you enable
          (such as galleries or version history), and meet security obligations. We do not claim ownership of uploaded inputs.
        </p>
        <ul className="ml-5 list-disc space-y-2">
          <li>
            <strong>Commercial use.</strong> Users may use their generations commercially, subject to third-party rights, applicable laws, and any
            restrictions specific to the model or provider used.
          </li>
          <li>
            <strong>Generated media licence.</strong> For every output created with MaxVideoAI, you grant us a worldwide, non-exclusive, royalty-free,
            transferable, and sublicensable licence to host, reproduce, index, display, and otherwise use that media to (a) operate the Service, (b)
            improve routing, safeguards, and underlying models, (c) run security and abuse investigations, and (d) showcase Examples galleries,
            template pages, case studies, or other marketing placements.
          </li>
          <li>
            <strong>Privacy controls.</strong> New renders are private by default. Public publishing, site-wide indexing, and any Video SEO rollout are
            managed by MaxVideoAI through an internal review workflow. If you need a public render delisted, deindexed, or deleted, email{' '}
            <ObfuscatedEmailLink
              user="support"
              domain="maxvideoai.com"
              label="support@maxvideoai.com"
              placeholder="support [at] maxvideoai.com"
              unstyled
              className="font-medium"
            />{' '}
            and we will honour reasonable requests unless legal obligations prevent removal.
          </li>
          <li>
            <strong>Uploads vs. generated content.</strong> Uploaded logos, footage, and other inputs remain your property; we only use them to fulfil the
            requested generation or diagnose quality issues. Generated media remains yours subject to the licence above, and you are responsible for any
            third-party rights contained in your inputs or outputs.
          </li>
          <li>
            <strong>Our IP.</strong> MaxVideoAI retains ownership of the platform, interfaces, pipelines, model improvements, safety systems, and other
            technology used to render or transform content. These Terms do not transfer any of that IP to you.
          </li>
        </ul>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">7. Service IP</h3>
        <p>
          We and our licensors own the Service, including software, models, safety tooling, UI, documentation, and brand assets. Except for the limited
          rights granted in these Terms, no intellectual property rights in the Service transfer to you.
        </p>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">8. Acceptable use</h3>
        <ul className="ml-5 list-disc space-y-2">
          <li>No reverse engineering, unauthorised access, or interference with the Service.</li>
          <li>No submission of unlawful, defamatory, hateful, or infringing content.</li>
          <li>No use of outputs for biometric identification, surveillance, or deceptive practices without required permissions and disclosures.</li>
        </ul>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">9. Third-party services</h3>
        <p>
          We rely on trusted sub-processors to operate the Service, including Stripe (payments), hosting/CDN providers, object storage, databases, and AI
          inference partners. See the Privacy Policy and the{' '}
          <Link href={subprocessorsHref} className="text-brand underline hover:text-brandHover">
            sub-processor notice
          </Link>{' '}
          for details.
        </p>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">10. Availability &amp; changes</h3>
        <p>
          We aim for high availability but cannot guarantee uninterrupted service. Features may change or be discontinued with reasonable notice where
          feasible.
        </p>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">11. Warranties &amp; disclaimers</h3>
        <p>
          The Service is provided “as is” without warranties of merchantability, fitness for a particular purpose, or non-infringement. Outputs are
          generated by probabilistic systems and may be inaccurate. You use them at your own risk.
        </p>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">12. Liability cap</h3>
        <p>
          To the extent permitted by law, our aggregate liability for any claim is limited to the fees you paid to us in the 12 months before the event
          giving rise to the claim. This section does not limit liability that cannot be excluded by law.
        </p>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">13. Indemnity</h3>
        <p>You agree to indemnify and hold us harmless from claims arising from your content, your use of outputs, or any breach of these Terms.</p>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">14. Termination</h3>
        <p>
          You may stop using the Service at any time. We may suspend or terminate access for breach, risk to the Service, or legal compliance reasons.
          Sections regarding intellectual property, disclaimers, liability, and indemnity survive termination.
        </p>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">15. Governing law &amp; venue</h3>
        <p>
          These Terms are governed by French law. The courts of Paris have exclusive jurisdiction, subject to mandatory consumer protections in your
          country of residence.
        </p>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">16. Consumer rights &amp; withdrawals</h3>
        <p>
          If you are a consumer in the EU/EEA/UK, you may have statutory rights, including withdrawal or conformity guarantees. Nothing in these Terms
          limits those rights.
        </p>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">17. Changes &amp; re-consent</h3>
        <p>
          We may update these Terms. When material changes occur, we will notify you and may require you to accept the new version at your next login.
          The current version and effective date are shown above.
        </p>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">18. Contact</h3>
        <p>
          Questions about these Terms?{' '}
          <ObfuscatedEmailLink
            user="legal"
            domain="maxvideoai.com"
            label="legal@maxvideoai.com"
            placeholder="legal [at] maxvideoai.com"
          />
          .
        </p>
        <p className="text-sm text-text-muted">Last updated: {effective ?? version}</p>
      </section>
    </article>
  );
}
