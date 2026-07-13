import Image from 'next/image';
import { ArrowRight, Check, ChevronDown } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { ButtonLink } from '@/components/ui/Button';
import { ANGLE_ORBIT_ASSETS, type AngleLandingContent } from './angle-landing-assets';
import { AngleSectionIntro, AngleTextLink } from './AngleLandingPrimitives';
import styles from './AngleLanding.module.css';

function AngleWorkspaceSection({ content }: { content: AngleLandingContent }) {
  return (
    <section className={styles.workspaceSection} aria-labelledby="angle-workspace-title">
      <div className="container-page max-w-6xl">
        <AngleSectionIntro
          eyebrow={content.workspace.eyebrow}
          title={content.workspace.title}
          titleId="angle-workspace-title"
          body={<p>{content.workspace.body}</p>}
        />

        <div className={styles.workspaceFrame}>
          <div className={styles.workspaceTopline}>
            <span>{content.workspace.topLeft}</span>
            <span>{content.workspace.topRight}</span>
          </div>
          <div className={styles.workspaceWindow}>
            <div className={styles.workspaceChrome} aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <p>{content.workspace.windowLabel}</p>
            <div className={styles.workspaceImage}>
              <Image
                src={ANGLE_ORBIT_ASSETS.workspace}
                alt={content.workspace.imageAlt}
                fill
                loading="lazy"
                sizes="(max-width: 1440px) 100vw, 1152px"
                className="object-cover object-top"
              />
            </div>
          </div>
        </div>

        <ol className={styles.workspaceCallouts}>
          {content.workspace.callouts.map((callout, index) => (
            <li key={callout.title}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <div>
                <h3>{callout.title}</h3>
                <p>{callout.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function AngleBenefitsSection({ content }: { content: AngleLandingContent }) {
  return (
    <section className={styles.conversionSection} aria-labelledby="angle-benefits-title">
      <div className="container-page max-w-6xl">
        <AngleSectionIntro
          eyebrow={content.benefits.eyebrow}
          title={content.benefits.title}
          titleId="angle-benefits-title"
          body={<p>{content.benefits.body}</p>}
        />
        <ol className={styles.benefitList}>
          {content.benefits.items.map((benefit, index) => (
            <li key={benefit.title}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <Check aria-hidden="true" />
              <h3>{benefit.title}</h3>
              <p>{benefit.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function AngleQuestionsSection({ content }: { content: AngleLandingContent }) {
  return (
    <section className={styles.questionsSection} aria-labelledby="angle-questions-title">
      <div className="container-page max-w-5xl">
        <AngleSectionIntro
          eyebrow={content.faq.eyebrow}
          title={content.faq.title}
          titleId="angle-questions-title"
          body={<p>{content.faq.body}</p>}
        />
        <p className={styles.limitsParagraph}>{content.faq.limits}</p>
        <div className={styles.questionList}>
          {content.faq.items.map((item) => (
            <details key={item.question}>
              <summary>
                <span>{item.question}</span>
                <ChevronDown aria-hidden="true" />
              </summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function AngleRelatedSection({ content }: { content: AngleLandingContent }) {
  return (
    <section className={styles.relatedSection} aria-labelledby="angle-related-title">
      <div className="container-page max-w-6xl">
        <AngleSectionIntro
          eyebrow={content.related.eyebrow}
          title={content.related.title}
          titleId="angle-related-title"
          body={<p>{content.related.body}</p>}
        />
        <div className={styles.relatedColumns}>
          <div>
            <h3>{content.related.workflowTitle}</h3>
            <nav aria-label={content.related.workflowTitle}>
              {content.related.workflowLinks.map((link) => (
                <AngleTextLink key={link.href} href={link.href}>{link.label}</AngleTextLink>
              ))}
            </nav>
          </div>
          <div>
            <h3>{content.related.guidesTitle}</h3>
            <nav aria-label={content.related.guidesTitle}>
              {content.related.guideLinks.map((link) => (
                <AngleTextLink key={link.href} href={link.href}>{link.label}</AngleTextLink>
              ))}
            </nav>
          </div>
        </div>
      </div>
    </section>
  );
}

function AngleFinalCtaSection({ content }: { content: AngleLandingContent }) {
  return (
    <section className={styles.finalSection} aria-labelledby="angle-final-title">
      <div className="container-page max-w-6xl">
        <div className={styles.finalCta}>
          <div className={styles.finalOrbit} aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
            <i />
          </div>
          <div className={styles.finalCopy}>
            <p className={styles.finalEyebrow}>{content.finalCta.eyebrow}</p>
            <h2 id="angle-final-title">{content.finalCta.title}</h2>
            <p>{content.finalCta.body}</p>
            <div className={styles.finalActions}>
              <ButtonLink
                href="/app/tools/angle"
                linkComponent={Link}
                size="lg"
                className="!bg-white !bg-none !text-[#171a20] hover:!bg-[#f3eee5]"
                data-analytics-event="tool_cta_click"
                data-analytics-cta-name="angle_try_tool_final"
                data-analytics-cta-location="tool_angle_final"
                data-analytics-tool-name="angle"
                data-analytics-tool-surface="public"
                data-analytics-target-family="app_tools"
              >
                {content.finalCta.primaryCta}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </ButtonLink>
              <ButtonLink
                href="/tools"
                linkComponent={Link}
                variant="outline"
                size="lg"
                className="!border-white/30 !bg-transparent !text-white hover:!bg-white/10"
              >
                {content.finalCta.secondaryCta}
              </ButtonLink>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function AngleLandingConversionSections({ content }: { content: AngleLandingContent }) {
  return (
    <>
      <AngleWorkspaceSection content={content} />
      <AngleBenefitsSection content={content} />
      <AngleQuestionsSection content={content} />
      <AngleRelatedSection content={content} />
      <AngleFinalCtaSection content={content} />
    </>
  );
}
