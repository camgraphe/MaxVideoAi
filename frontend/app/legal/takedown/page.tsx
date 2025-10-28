import type { Metadata } from 'next';
import { TakedownForm } from './TakedownForm';

export const metadata: Metadata = {
  title: 'Notice & Takedown',
  description: 'Report abusive or unlawful content generated through MaxVideoAI.',
};

export default function TakedownPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold text-text-primary">Notice &amp; Takedown</h1>
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
          If content generated through MaxVideoAI infringes your rights or violates the law, use this form to request a review. We
          will acknowledge receipt, investigate promptly, and take appropriate action (including removal or account suspension when
          justified).
        </p>
        <p>
          For urgent reports (personal safety or law-enforcement matters), email{' '}
          <a href="mailto:legal@maxvideoai.com" className="text-accent underline">
            legal@maxvideoai.com
          </a>{' '}
          with “URGENT” in the subject line.
        </p>
      </article>

      <TakedownForm />
    </div>
  );
}
