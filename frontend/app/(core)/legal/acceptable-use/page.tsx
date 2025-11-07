import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Acceptable Use Policy',
  description: 'Rules that govern how MaxVideoAI may be used, including restrictions on abusive or illegal content.',
};

export default function AcceptableUsePage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold text-text-primary">Acceptable Use Policy</h1>
        <p className="text-sm text-text-secondary">Effective date: 28 October 2025</p>
        <p className="text-sm text-text-secondary">
          Company: <span className="font-medium">MaxVideoAI</span> · Contact:{' '}
          <a href="mailto:legal@maxvideoai.com" className="text-accent underline">
            legal@maxvideoai.com
          </a>
        </p>
      </header>

      <article className="space-y-4 text-base leading-relaxed text-text-secondary">
        <p>
          This Acceptable Use Policy (“AUP”) explains how you may use the MaxVideoAI platform. It applies to all prompts,
          uploads, and outputs you generate or distribute through the Service. If you violate this AUP we may suspend or terminate
          your account and remove offending content.
        </p>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-text-primary">Never submit or distribute:</h2>
          <ul className="ml-5 list-disc space-y-1.5">
            <li>Illegal content of any kind, including child sexual abuse material or extremist propaganda.</li>
            <li>
              Non-consensual intimate imagery, sexualised or exploitative depictions of minors, or deepfakes intended to harm a
              person’s reputation or privacy.
            </li>
            <li>
              Hate speech, harassment, stalking, doxxing, or encouragement of self-harm, suicide, or violence against individuals or
              groups.
            </li>
            <li>Content that infringes intellectual property or publicity rights, including unlicensed logos and copyrighted media.</li>
            <li>Malware, phishing content, or attempts to gain unauthorised access to systems or data.</li>
            <li>Content that facilitates fraud, scams, spyware, unlawful surveillance, or other criminal activity.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-text-primary">Respect privacy and consent</h2>
          <p>
            Do not impersonate real people, misuse personal data, or publish private information without permission. If your output
            depicts someone else, obtain their explicit consent before sharing it publicly.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-text-primary">Platform safeguards</h2>
          <p>
            We may suspend prompts, jobs, or accounts to protect the service, comply with law, or investigate abuse. We may share
            relevant information with law enforcement when legally compelled or when serious harm is imminent.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-text-primary">Report abuse</h2>
          <p>
            If you believe content generated through MaxVideoAI breaches this policy or your rights, please notify us via the{' '}
            <Link href="/legal/takedown" className="text-accent underline">
              Notice &amp; Takedown form
            </Link>{' '}
            or email{' '}
            <a href="mailto:legal@maxvideoai.com" className="text-accent underline">
              legal@maxvideoai.com
            </a>
            . We review reports promptly and take appropriate action.
          </p>
        </section>
      </article>
    </div>
  );
}
