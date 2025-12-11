import type { Metadata } from 'next';
import { ReconsentPrompt } from '@/components/legal/ReconsentPrompt';
import { ObfuscatedEmailLink } from '@/components/marketing/ObfuscatedEmailLink';
import { resolveLocale } from '@/lib/i18n/server';
import type { AppLocale } from '@/i18n/locales';
import { buildSeoMetadata } from '@/lib/seo/metadata';

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await resolveLocale()) as AppLocale;
  return buildSeoMetadata({
    locale,
    title: 'Legal re-consent',
    description: 'Review and accept the updated MaxVideoAI legal documents.',
    hreflangGroup: 'legalReconsent',
    englishPath: '/legal/reconsent',
    availableLocales: ['en', 'fr', 'es'] as AppLocale[],
    ogType: 'article',
    imageAlt: 'Legal re-consent',
  });
}

export default function LegalReconsentPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-xl font-semibold text-text-primary">Review updates</h2>
        <p className="text-sm text-text-secondary">
          If you are signed in, the latest legal documents will appear below for acceptance. Otherwise, sign in to continue.
        </p>
      </header>
      <div className="rounded-card border border-border bg-bg-secondary/40 p-6">
        <ReconsentPrompt />
        <p className="text-sm text-text-muted">
          Need help? Contact{' '}
          <ObfuscatedEmailLink
            user="legal"
            domain="maxvideoai.com"
            label="legal@maxvideoai.com"
            placeholder="legal [at] maxvideoai.com"
          />
          .
        </p>
      </div>
    </div>
  );
}
