import { FAQSchema } from '@/components/seo/FAQSchema';
import { buildMarketingServiceJsonLd } from '@/lib/seo/marketingServiceJsonLd';
import {
  buildToolBreadcrumbJsonLd,
  buildToolHowToJsonLd,
  serializeJsonLd,
} from '@/components/tools/landing/tool-marketing-json-ld';
import type { CharacterBuilderLandingContent } from './character-builder-landing-assets';
import { CharacterBuilderLandingSections } from './CharacterBuilderLandingSections';

export function CharacterBuilderLandingView({ content }: { content: CharacterBuilderLandingContent }) {
  const canonicalUrl = 'https://maxvideoai.com/tools/character-builder';
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

  const howToJsonLd = buildToolHowToJsonLd({
    canonicalUrl,
    name: content.meta.howToTitle,
    description: content.meta.howToDescription,
    steps: content.howItWorks.steps,
  });

  return (
    <div className="character-builder-page">
      <CharacterBuilderLandingSections content={content} />
      <FAQSchema questions={[...content.faq.items]} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(serviceJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(howToJsonLd) }} />
    </div>
  );
}
