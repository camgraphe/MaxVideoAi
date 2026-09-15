import { resolveLocale } from '@/lib/i18n/server';
import { localizePathFromEnglish } from '@/lib/i18n/paths';
import { ToolJourneyNav } from '@/components/tools/landing/ToolJourneyNav';
import { FAQSchema } from '@/components/seo/FAQSchema';
import { buildMarketingServiceJsonLd } from '@/lib/seo/marketingServiceJsonLd';
import {
  buildToolBreadcrumbJsonLd,
  buildToolHowToJsonLd,
  serializeJsonLd,
} from '@/components/tools/landing/tool-marketing-json-ld';
import { BackgroundRemovalLandingSections } from './BackgroundRemovalLandingSections';
import type { BackgroundRemovalLandingContent } from './background-removal-landing-assets';

export async function BackgroundRemovalLandingView({ content }: { content: BackgroundRemovalLandingContent }) {
  const locale = await resolveLocale();
  const canonicalUrl = `https://maxvideoai.com${localizePathFromEnglish(locale, '/tools/background-removal')}`;
  const breadcrumbJsonLd = buildToolBreadcrumbJsonLd({
    locale,
    breadcrumb: content.breadcrumb,
    canonicalUrl,
  });
  const serviceJsonLd = buildMarketingServiceJsonLd({
    name: content.meta.schemaName,
    description: content.meta.schemaDescription,
    serviceType: content.meta.schemaName,
    category: content.modelGuide.rows[0]?.bestFor,
    url: canonicalUrl,
  });
  const howToJsonLd = buildToolHowToJsonLd({
    canonicalUrl,
    name: content.meta.howToTitle,
    description: content.meta.howToDescription,
    steps: content.workflow.steps,
  });

  return (
    <div className="background-removal-page tool-detail-page"><ToolJourneyNav active="background-removal" />
      <BackgroundRemovalLandingSections content={content} />
      <FAQSchema questions={content.faq.map((entry) => ({ question: entry.q, answer: entry.a }))} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(serviceJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(howToJsonLd) }} />
    </div>
  );
}
