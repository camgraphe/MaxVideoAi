import Image from 'next/image';
import Link from 'next/link';
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';
import type { AppLocale } from '@/i18n/locales';
import { localizePathFromEnglish } from '@/lib/i18n/paths';
import { projectAttemptBudget, projectCostExample } from '@/lib/marketing/project-cost-example';
import { platformEvidence, platformGuideChecked, platformGuideCopy, type GuideSource, type PlatformId } from './blog-platform-guide-copy';
import styles from './blog-platform-guide.module.css';

const platformIds = Object.keys(platformEvidence) as PlatformId[];
const angleScene = '/assets/tools/angle-orbit-hero-dialogue';
const angleSizes = '(max-width: 760px) 44vw, (max-width: 1240px) 36vw, 442px';

function Sources({ sources, platform, locale }: { sources: GuideSource[]; platform: PlatformId; locale: AppLocale }) {
  const labels = platformGuideCopy[locale].labels;
  return (
    <div className={styles.sources}>
      {sources.map(({ href, label }) => (
        <a key={href} href={href} aria-label={platformEvidence[platform].name + ' · ' + labels[label]}>
          {labels[label]} <ArrowUpRight size={12} aria-hidden="true" />
        </a>
      ))}
    </div>
  );
}

export function BlogPlatformGuide({ locale }: { locale: AppLocale }) {
  const copy = platformGuideCopy[locale];
  const localized = (href: string) => localizePathFromEnglish(locale, href);
  const pricingHref = localized(projectCostExample.pricePath) + '#' + projectCostExample.priceFragment;
  const budget = projectAttemptBudget(1);
  const amounts = [projectCostExample.initialFundingCents, budget.spentCents, budget.remainingCents];
  const currency = new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD', currencyDisplay: 'code' });
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' });

  return (
    <div className={styles.guide}>
      <nav aria-label={copy.contentsLabel} className={styles.contents}>
        <a href="#platform-workflows">{copy.jobs.title}<ArrowDownRight size={16} aria-hidden="true" /></a>
        <a href="#platform-terms">{copy.matrix.title}<ArrowDownRight size={16} aria-hidden="true" /></a>
        <a href="#platform-duels">{copy.duels.title}<ArrowDownRight size={16} aria-hidden="true" /></a>
        <a href="#platform-budget">{copy.budget.title}<ArrowDownRight size={16} aria-hidden="true" /></a>
      </nav>

      <section id="platform-workflows" className={styles.section} aria-labelledby="platform-workflows-title">
        <div className={styles.sectionHead}>
          <span aria-hidden="true">01</span>
          <div>
            <h2 id="platform-workflows-title">{copy.jobs.title}</h2>
            <p>{copy.jobs.intro}</p>
          </div>
        </div>
        <div className={styles.workflowGrid}>
          <ul className={styles.jobs}>
            {copy.jobs.items.map((job) => (
              <li key={job.title}>
                <h3>{job.title}</h3>
                <p>{job.description}</p>
                <div className={styles.jobPlatforms}>
                  {job.platforms.map((platform) => (
                    <a key={platform} href={'#platform-' + platform}>{platformEvidence[platform].name}</a>
                  ))}
                </div>
              </li>
            ))}
          </ul>
          <figure className={styles.angle}>
            <div className={styles.angleImages}>
              <Image src={angleScene + '-source.webp'} alt={copy.jobs.sourceAlt} width={1600} height={1200} sizes={angleSizes} priority />
              <Image src={angleScene + '-reverse.webp'} alt={copy.jobs.imageAlt} width={1600} height={1200} sizes={angleSizes} loading="lazy" />
            </div>
            <figcaption>
              {copy.jobs.imageCaption}
              <Link href={localized('/tools/angle')} prefetch={false}>
                {copy.jobs.imageLink}<ArrowUpRight size={14} aria-hidden="true" />
              </Link>
            </figcaption>
          </figure>
        </div>
      </section>

      <section id="platform-terms" className={styles.section} aria-labelledby="platform-terms-title">
        <div className={styles.sectionHead}>
          <span aria-hidden="true">02</span>
          <div>
            <h2 id="platform-terms-title">{copy.matrix.title}</h2>
            <p>{copy.matrix.intro}</p>
          </div>
        </div>
        <div className={styles.byline}>
          <span>{copy.checked} <time dateTime={platformGuideChecked}>{date.format(new Date(platformGuideChecked))}</time></span>
          <p>{copy.publisher}</p>
        </div>
        <table className={styles.matrix} role="table">
          <caption className="sr-only">{copy.matrix.title}</caption>
          <thead role="rowgroup">
            <tr role="row">
              <th role="columnheader" scope="col" id="platform-workflow-column">{copy.matrix.columns[0]}</th>
              <th role="columnheader" scope="col" id="platform-web-column">{copy.matrix.columns[1]}</th>
              <th role="columnheader" scope="col" id="platform-mcp-column">{copy.matrix.columns[2]}</th>
            </tr>
          </thead>
          <tbody role="rowgroup">
            {platformIds.map((id) => {
              const platform = platformEvidence[id];
              const row = copy.matrix.rows[id];
              return (
                <tr key={id} id={'platform-' + id} data-platform-id={id} role="row">
                  <th id={'platform-name-' + id} scope="row" role="rowheader">
                    <strong>{platform.name}</strong>
                    <p>{row.fit}</p>
                    <Sources platform={id} sources={platform.workflow} locale={locale} />
                  </th>
                  <td headers={'platform-name-' + id + ' platform-web-column'} role="cell">
                    <span className={styles.mobileLabel} aria-hidden="true">{copy.matrix.columns[1]}</span>
                    <p>{row.web}</p>
                    <Sources platform={id} sources={platform.web} locale={locale} />
                  </td>
                  <td headers={'platform-name-' + id + ' platform-mcp-column'} role="cell">
                    <span className={styles.mobileLabel} aria-hidden="true">{copy.matrix.columns[2]}</span>
                    <p>{row.assistant}</p>
                    <Sources platform={id} sources={platform.assistant} locale={locale} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className={styles.matrixNote}>{copy.matrix.note}</p>
      </section>

      <section id="platform-duels" className={styles.duels} aria-labelledby="platform-duels-title">
        <div className={styles.sectionHead}>
          <span aria-hidden="true">03</span>
          <h2 id="platform-duels-title">{copy.duels.title}</h2>
        </div>
        <div className={styles.duelGrid}>
          {copy.duels.items.map((duel) => (
            <section key={duel.id} className={styles.duel} id={duel.id} aria-labelledby={duel.id + '-title'}>
              <h3 id={duel.id + '-title'}>{duel.title}</h3>
              <ul>
                {duel.picks.map(({ platform, description }) => (
                  <li key={platform}>
                    <strong>{platformEvidence[platform].name}</strong>
                    <p>{description}</p>
                    <Sources platform={platform} sources={platformEvidence[platform].workflow} locale={locale} />
                  </li>
                ))}
              </ul>
              <p className={styles.duelCheck}>{duel.check}</p>
            </section>
          ))}
        </div>
      </section>

      <section id="platform-budget" className={styles.section} aria-labelledby="platform-budget-title">
        <div className={styles.sectionHead}>
          <span aria-hidden="true">04</span>
          <div>
            <h2 id="platform-budget-title">{copy.budget.title}</h2>
            <p>{copy.budget.scenario}</p>
          </div>
        </div>
        <dl className={styles.budget}>
          {copy.budget.labels.map((label, index) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{currency.format(amounts[index] / 100)}</dd>
            </div>
          ))}
        </dl>
        <p className={styles.budgetNote}>{copy.budget.note} {copy.budget.checked} <time dateTime={projectCostExample.checked}>{date.format(new Date(projectCostExample.checked))}</time>.</p>
        <div className={styles.budgetLinks}>
          <Link className={styles.budgetAction} href="/app" prefetch={false} data-analytics-event="cta_click" data-analytics-cta-name="platform_guide_configure" data-analytics-cta-location="platform_guide_budget" data-analytics-target-family="workspace">{copy.budget.action}<ArrowRight size={17} aria-hidden="true" /></Link>
          <Link href={pricingHref} prefetch={false}>{copy.budget.price}<ArrowUpRight size={15} aria-hidden="true" /></Link>
          <Link href={localized('/blog/ai-video-project-cost')} prefetch={false}>{copy.budget.details}<ArrowUpRight size={15} aria-hidden="true" /></Link>
          <Link href={localized('/higgsfield-alternative')} prefetch={false}>{copy.budget.comparison}<ArrowUpRight size={15} aria-hidden="true" /></Link>
        </div>
      </section>
    </div>
  );
}
