import Image from 'next/image';
import { ArrowRight, ChevronRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { ButtonLink } from '@/components/ui/Button';
import { ANGLE_ORBIT_ASSETS, type AngleLandingContent } from './angle-landing-assets';
import { AngleOrbitStudio } from './AngleOrbitStudio.client';
import styles from './AngleLanding.module.css';

export function AngleLandingHeroSection({ content }: { content: AngleLandingContent }) {
  return (
    <section className={styles.hero}>
      <div className="container-page relative max-w-7xl py-9 sm:py-12 lg:py-16">
        <nav aria-label="Breadcrumb" className={`${styles.heroBreadcrumb} mb-10 flex flex-wrap items-center gap-2 text-xs`}>
          <Link href="/" className={`${styles.heroBreadcrumbLink} rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-2`}>
            {content.breadcrumb.home}
          </Link>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <Link href="/tools" className={`${styles.heroBreadcrumbLink} rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-2`}>
            {content.breadcrumb.tools}
          </Link>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <span className={`${styles.heroBreadcrumbCurrent} font-semibold`}>{content.breadcrumb.current}</span>
        </nav>

        <div className="grid gap-11 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)] lg:items-center lg:gap-14 xl:gap-20">
          <div className="max-w-2xl">
            <p className={`${styles.heroEyebrow} text-xs font-semibold uppercase tracking-[0.24em]`}>{content.hero.eyebrow}</p>
            <h1 className={`${styles.heroTitle} mt-6 text-balance text-4xl font-semibold tracking-[-0.045em] sm:text-5xl lg:text-[4.25rem] lg:leading-[0.98]`}>
              {content.hero.title}
            </h1>
            <p className={`${styles.heroBody} mt-7 max-w-xl text-base leading-8 sm:text-lg`}>{content.hero.body}</p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <ButtonLink
                href="/app/tools/angle"
                linkComponent={Link}
                size="lg"
                data-analytics-event="tool_cta_click"
                data-analytics-cta-name="angle_try_tool_hero"
                data-analytics-cta-location="tool_angle_hero"
                data-analytics-tool-name="angle"
                data-analytics-tool-surface="public"
                data-analytics-target-family="app_tools"
              >
                {content.hero.primaryCta}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </ButtonLink>
            </div>
            <p className={`${styles.heroSupport} mt-6 max-w-lg border-l pl-4 text-sm font-medium leading-7`}>
              {content.hero.supportText}
            </p>
          </div>

          <AngleOrbitStudio content={content.hero.orbit} />
        </div>
      </div>
    </section>
  );
}

function WorkflowMark({ index }: { index: number }) {
  const activeY = 15 + index * 11;

  return (
    <svg viewBox="0 0 72 56" className="h-14 w-[72px]" aria-hidden="true">
      <rect x="1" y="1" width="70" height="54" rx="12" className={styles.workflowMarkPanel} />
      <circle cx="12" cy="10" r="2" fill="#ff7b54" />
      <circle cx="19" cy="10" r="2" fill="#f3c650" />
      <circle cx="26" cy="10" r="2" fill="#6abf91" />
      <rect x="10" y={activeY} width="34" height="6" rx="3" className={styles.workflowMarkAccent} opacity="0.92" />
      <rect x="48" y={activeY} width="14" height="6" rx="3" className={styles.workflowMarkSoftAccent} />
      <path d="M11 48H61" className={styles.workflowMarkDivider} strokeLinecap="round" />
    </svg>
  );
}

export function AngleLandingProofWorkflowSections({ content }: { content: AngleLandingContent }) {
  return (
    <>
      <section className={`${styles.problemSection} py-16 sm:py-20 lg:py-24`}>
        <div className="container-page max-w-6xl">
          <div className="max-w-3xl">
            <p className={`${styles.leadEyebrow} text-xs font-semibold uppercase tracking-[0.24em]`}>{content.problemSolution.eyebrow}</p>
            <h2 className={`${styles.leadTitle} mt-4 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl`}>{content.problemSolution.title}</h2>
            <p className={`${styles.leadBody} mt-5 text-base leading-8`}>{content.problemSolution.body}</p>
          </div>

          <div className={`${styles.proofGrid} mt-10`}>
            <article className={`${styles.proofCard} overflow-hidden rounded-[28px] border`}>
              <div className={`${styles.proofMedia} relative aspect-[4/3] overflow-hidden`}>
                <Image
                  src={ANGLE_ORBIT_ASSETS.proof.source}
                  alt={content.problemSolution.solution.sourceAlt}
                  fill
                  sizes="(max-width: 1024px) 100vw, 48vw"
                  className="object-cover"
                />
              </div>
              <div className="p-6 sm:p-7">
                <p className={`${styles.proofLabel} text-xs font-semibold uppercase tracking-[0.2em]`}>{content.problemSolution.problem.label}</p>
                <h3 className={`${styles.proofTitle} mt-3 text-2xl font-semibold tracking-[-0.025em]`}>{content.problemSolution.problem.title}</h3>
                <p className={`${styles.proofBody} mt-3 text-sm leading-7`}>{content.problemSolution.problem.body}</p>
              </div>
            </article>

            <article className={`${styles.proofCard} ${styles.proofOutputCard} overflow-hidden rounded-[28px] border`}>
              <div className={`${styles.proofMedia} relative aspect-[4/3] overflow-hidden`}>
                <Image
                  src={ANGLE_ORBIT_ASSETS.proof.output}
                  alt={content.problemSolution.solution.outputAlt}
                  fill
                  sizes="(max-width: 1024px) 100vw, 48vw"
                  className="object-cover"
                />
              </div>
              <div className="p-6 sm:p-7">
                <p className={`${styles.proofOutputLabel} text-xs font-semibold uppercase tracking-[0.2em]`}>{content.problemSolution.solution.label}</p>
                <h3 className={`${styles.proofTitle} mt-3 text-2xl font-semibold tracking-[-0.025em]`}>{content.problemSolution.solution.title}</h3>
                <p className={`${styles.proofBody} mt-3 text-sm leading-7`}>{content.problemSolution.solution.body}</p>
              </div>
            </article>
          </div>
          <p className={`${styles.proofCaption} mt-6 text-sm font-medium leading-7`}>{content.problemSolution.solution.caption}</p>
        </div>
      </section>

      <section className={`${styles.sectionRule} ${styles.workflowSection} py-16 sm:py-20 lg:py-24`}>
        <div className="container-page max-w-6xl">
          <div className="max-w-3xl">
            <p className={`${styles.leadEyebrow} text-xs font-semibold uppercase tracking-[0.24em]`}>{content.howItWorks.eyebrow}</p>
            <h2 className={`${styles.leadTitle} mt-4 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl`}>{content.howItWorks.title}</h2>
            <p className={`${styles.leadBody} mt-5 text-base leading-8`}>{content.howItWorks.body}</p>
          </div>

          <ol className={`${styles.workflowList} mt-12 grid gap-0 border-y lg:grid-cols-3`}>
            {content.howItWorks.steps.map((step, index) => (
              <li key={step.title} id={`step-${index + 1}`} className={`${styles.workflowStep} grid gap-5 border-b py-8 last:border-b-0 lg:border-b-0 lg:border-r lg:px-8 lg:first:pl-0 lg:last:border-r-0 lg:last:pr-0`}>
                <div className="flex items-center justify-between gap-5">
                  <WorkflowMark index={index} />
                  <span className={`${styles.workflowNumber} font-mono text-xs`}>{String(index + 1).padStart(2, '0')}</span>
                </div>
                <div>
                  <h3 className={`${styles.workflowTitle} text-xl font-semibold tracking-[-0.02em]`}>{step.title}</h3>
                  <p className={`${styles.workflowBody} mt-3 text-sm leading-7`}>{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
}
