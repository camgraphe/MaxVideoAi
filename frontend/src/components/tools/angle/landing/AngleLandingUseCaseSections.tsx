import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { ButtonLink } from '@/components/ui/Button';
import { ANGLE_ORBIT_ASSETS, type AngleLandingContent } from './angle-landing-assets';
import { AngleTextLink } from './AngleLandingPrimitives';
import styles from './AngleLanding.module.css';

export function AngleLandingUseCaseSections({ content }: { content: AngleLandingContent }) {
  const useCases = [
    { content: content.intentExamples.items[0], assets: ANGLE_ORBIT_ASSETS.product, href: '/app/image' },
    { content: content.useCases.story, assets: ANGLE_ORBIT_ASSETS.storyboard, href: '/app/tools/storyboard' },
    { content: content.intentExamples.items[2], assets: ANGLE_ORBIT_ASSETS.adCreative, href: '/examples' },
    { content: content.videoPrep, assets: ANGLE_ORBIT_ASSETS.videoPrep, href: '/ai-video-engines' },
  ] as const;
  const eyebrows = [
    content.useCases.commerce.eyebrow,
    content.useCases.story.eyebrow,
    content.useCases.smallCases[0].eyebrow,
    content.videoPrep.eyebrow,
  ] as const;
  const linkLabels = [
    content.related.workflowLinks[0].label,
    `${content.related.workflowTitle}: ${content.useCases.story.title}`,
    content.related.workflowLinks[4].label,
    `${content.related.workflowTitle}: ${content.videoPrep.title}`,
  ] as const;

  return (
    <div className={styles.useCaseCollection}>
      <div className={`container-page max-w-6xl ${styles.useCasePrelude}`}>
        <p className={styles.eyebrow}>{content.intentExamples.eyebrow}</p>
        <p className={styles.useCasePreludeTitle}>{content.intentExamples.title}</p>
        <p>{content.intentExamples.body}</p>
      </div>

      {useCases.map((useCase, index) => {
        const mediaCopy =
          'sourceLabel' in useCase.content
            ? {
                sourceLabel: useCase.content.sourceLabel,
                outputLabel: useCase.content.outputLabel,
                sourceAlt: useCase.content.sourceAlt,
                outputAlt: useCase.content.outputAlt,
              }
            : {
                sourceLabel: useCase.content.thumbs[0].label,
                outputLabel: useCase.content.thumbs[1].label,
                sourceAlt: useCase.content.thumbs[0].alt,
                outputAlt: useCase.content.thumbs[1].alt,
              };
        const titleId = `angle-use-case-${index + 1}`;

        return (
          <section key={useCase.href} className={styles.useCaseSection} aria-labelledby={titleId}>
            <div className="container-page max-w-6xl">
              <article className={styles.useCaseRow} data-media-side={index % 2 === 0 ? 'right' : 'left'}>
                <div className={styles.useCaseCopy}>
                  <p className={styles.eyebrow}>{eyebrows[index]}</p>
                  <h2 id={titleId}>{useCase.content.title}</h2>
                  <p>{useCase.content.body}</p>
                  <AngleTextLink href={useCase.href}>{linkLabels[index]}</AngleTextLink>
                </div>

                <div className={styles.useCaseMedia}>
                  <figure>
                    <figcaption>{mediaCopy.sourceLabel}</figcaption>
                    <div className={styles.useCaseImage}>
                      <Image
                        src={useCase.assets.source}
                        alt={mediaCopy.sourceAlt}
                        fill
                        loading="lazy"
                        sizes="(max-width: 1024px) 100vw, 48vw"
                        className="object-cover"
                      />
                    </div>
                  </figure>
                  <figure data-output="true">
                    <figcaption>{mediaCopy.outputLabel}</figcaption>
                    <div className={styles.useCaseImage}>
                      <Image
                        src={useCase.assets.output}
                        alt={mediaCopy.outputAlt}
                        fill
                        loading="lazy"
                        sizes="(max-width: 1024px) 100vw, 48vw"
                        className="object-cover"
                      />
                    </div>
                  </figure>
                </div>
              </article>
            </div>
          </section>
        );
      })}

      <div className={`container-page max-w-6xl ${styles.useCaseAction}`}>
        <ButtonLink
          href="/app/tools/angle"
          linkComponent={Link}
          size="lg"
          data-analytics-event="tool_cta_click"
          data-analytics-cta-name="angle_try_tool_examples"
          data-analytics-cta-location="tool_angle_examples"
          data-analytics-tool-name="angle"
          data-analytics-tool-surface="public"
          data-analytics-target-family="app_tools"
        >
          {content.intentExamples.primaryCta}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </ButtonLink>
      </div>
    </div>
  );
}
