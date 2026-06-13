import { FAQSchema } from '@/components/seo/FAQSchema';
import { buildMarketingServiceJsonLd } from '@/lib/seo/marketingServiceJsonLd';
import {
  buildToolBreadcrumbJsonLd,
  buildToolHowToJsonLd,
  serializeJsonLd,
} from '@/components/tools/landing/tool-marketing-json-ld';
import { BackgroundRemovalLandingSections } from './BackgroundRemovalLandingSections';
import type { BackgroundRemovalLandingContent } from './background-removal-landing-assets';

export function BackgroundRemovalLandingView({ content }: { content: BackgroundRemovalLandingContent }) {
  const canonicalUrl = 'https://maxvideoai.com/tools/background-removal';
  const breadcrumbJsonLd = buildToolBreadcrumbJsonLd({
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
    <div className="background-removal-page">
      <BackgroundRemovalLandingSections content={content} />
      <FAQSchema questions={content.faq.map((entry) => ({ question: entry.q, answer: entry.a }))} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(serviceJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(howToJsonLd) }} />
    </div>
  );
}
