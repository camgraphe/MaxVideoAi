import type { CharacterBuilderLandingContent } from './character-builder-landing-assets';
import {
  CharacterBuilderFaqSection,
  CharacterBuilderFinalCtaSection,
  CharacterBuilderRelatedSection,
  CharacterBuilderUseCasesSection,
} from './CharacterBuilderLandingConversionSections';
import {
  CharacterBuilderHeroSection,
  CharacterBuilderHowItWorksSection,
  CharacterBuilderWhySection,
} from './CharacterBuilderLandingLeadSections';
import { CharacterBuilderOutputsWorkflowSection } from './CharacterBuilderLandingWorkflowSections';

export function CharacterBuilderLandingSections({ content }: { content: CharacterBuilderLandingContent }) {
  return (
    <>
      <CharacterBuilderHeroSection content={content} />
      <CharacterBuilderWhySection content={content} />
      <CharacterBuilderHowItWorksSection content={content} />
      <CharacterBuilderOutputsWorkflowSection content={content} />
      <CharacterBuilderUseCasesSection content={content} />
      <CharacterBuilderRelatedSection content={content} />
      <CharacterBuilderFinalCtaSection content={content} />
      <CharacterBuilderFaqSection content={content} />
    </>
  );
}
