import { buildMarketingServiceJsonLd } from '@/lib/seo/marketingServiceJsonLd';
import { buildToolBreadcrumbJsonLd, serializeJsonLd } from '@/components/tools/landing/tool-marketing-json-ld';
import type { AngleLandingContent } from './angle-landing-assets';
import { AngleLandingSections } from './AngleLandingSections';

export function AngleLandingView({ content }: { content: AngleLandingContent }) {
  const canonicalUrl = 'https://maxvideoai.com/tools/angle';
  const breadcrumbJsonLd = buildToolBreadcrumbJsonLd({
    breadcrumb: content.breadcrumb,
    canonicalUrl,
  });
  const serviceJsonLd = buildMarketingServiceJsonLd({
    name: content.meta.schemaName,
    description: content.meta.schemaDescription,
    serviceType: content.meta.schemaName,
    category: content.meta.schemaFeatures[0],
    url: canonicalUrl,
  });
  return (
    <div className="angle-page">
      <AngleLandingSections content={content} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(serviceJsonLd) }} />
    </div>
  );
}
