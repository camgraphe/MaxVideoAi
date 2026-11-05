import { getCharacterStudioMarketingVideos } from '@/server/character-studio/marketing-demos';
import styles from './CharacterStudioLanding.module.css';
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
import type { CharacterBuilderLandingContent } from './character-builder-landing-assets';
import { CharacterBuilderLandingSections } from './CharacterBuilderLandingSections';

export async function CharacterBuilderLandingView({ content }: { content: CharacterBuilderLandingContent }) {
  const locale = await resolveLocale();
  const films = await getCharacterStudioMarketingVideos();
  const canonicalUrl = `https://maxvideoai.com${localizePathFromEnglish(locale, '/tools/character-builder')}`;
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

  const howToJsonLd = buildToolHowToJsonLd({
    canonicalUrl,
    name: content.meta.howToTitle,
    description: content.meta.howToDescription,
    steps: content.howItWorks.steps,
  });

  return (
    <div className={styles.page}><ToolJourneyNav active="character-builder" />
      <CharacterBuilderLandingSections content={content} films={films} locale={locale} />
      <FAQSchema questions={[...content.faq.items]} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(serviceJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(howToJsonLd) }} />
    </div>
  );
}
