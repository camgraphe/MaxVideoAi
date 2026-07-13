import type { AngleLandingContent } from './angle-landing-assets';
import { AngleLandingConversionSections } from './AngleLandingConversionSections';
import { AngleLandingHeroSection, AngleLandingProofWorkflowSections } from './AngleLandingLeadSections';
import { AngleLandingUseCaseSections } from './AngleLandingUseCaseSections';
import styles from './AngleLanding.module.css';

export function AngleLandingSections({ content }: { content: AngleLandingContent }) {
  return (
    <div className={styles.page}>
      <AngleLandingHeroSection content={content} />
      <AngleLandingProofWorkflowSections content={content} />
      <AngleLandingUseCaseSections content={content} />
      <AngleLandingConversionSections content={content} />
    </div>
  );
}
