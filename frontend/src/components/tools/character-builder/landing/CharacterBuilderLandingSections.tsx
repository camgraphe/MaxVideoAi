import type { CharacterStudioMarketingFilm } from './character-studio-marketing-assets';
import type { CharacterBuilderLandingContent } from './character-builder-landing-assets';
import { CharacterBuilderFaqSection, CharacterBuilderFinalCtaSection, CharacterBuilderRelatedSection } from './CharacterBuilderLandingConversionSections';
import { CharacterBuilderHeroSection, CharacterBuilderHowItWorksSection } from './CharacterBuilderLandingLeadSections';
import { CharacterBuilderOutputsWorkflowSection } from './CharacterBuilderLandingWorkflowSections';

export function CharacterBuilderLandingSections({ content, films = [], locale = 'en' }: { content: CharacterBuilderLandingContent; films?: CharacterStudioMarketingFilm[]; locale?: string }) {
  return <>
    <CharacterBuilderHeroSection content={content} />
    <CharacterBuilderHowItWorksSection content={content} />
    <CharacterBuilderOutputsWorkflowSection content={content} films={films} locale={locale} />
    <CharacterBuilderFaqSection content={content} />
    <CharacterBuilderRelatedSection content={content} />
    <CharacterBuilderFinalCtaSection content={content} />
  </>;
}
