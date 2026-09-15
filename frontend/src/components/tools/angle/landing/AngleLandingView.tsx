import { resolveLocale } from '@/lib/i18n/server';
import { localizePathFromEnglish } from '@/lib/i18n/paths';
import { ToolJourneyNav } from '@/components/tools/landing/ToolJourneyNav';
import { buildMarketingServiceJsonLd } from '@/lib/seo/marketingServiceJsonLd';
import { buildToolBreadcrumbJsonLd, serializeJsonLd } from '@/components/tools/landing/tool-marketing-json-ld';
import type { AngleLandingContent } from './angle-landing-assets';
import { AngleLandingSections } from './AngleLandingSections';

export async function AngleLandingView({ content }: { content: AngleLandingContent }) {
  const locale = await resolveLocale();
  const canonicalUrl = `https://maxvideoai.com${localizePathFromEnglish(locale, '/tools/angle')}`;
  const breadcrumbJsonLd = buildToolBreadcrumbJsonLd({
    locale,
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
      <div className="tool-detail-page tool-angle-page"><ToolJourneyNav active="angle" /><AngleLandingSections content={content} /></div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(serviceJsonLd) }} />
    </div>
  );
}
