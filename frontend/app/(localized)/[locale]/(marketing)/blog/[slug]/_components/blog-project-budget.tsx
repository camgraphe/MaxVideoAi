import Link from 'next/link';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import type { AppLocale } from '@/i18n/locales';
import { localizePathFromEnglish } from '@/lib/i18n/paths';
import { projectCostExample, projectAttemptBudget } from '@/lib/marketing/project-cost-example';
import { getProjectBudgetCopy } from './blog-project-budget-copy';
import { ProjectBudgetReceipt } from './blog-project-budget-receipt.client';
import styles from './blog-project-budget.module.css';

export function BlogProjectBudget({ locale }: { locale: AppLocale }) {
  const copy = getProjectBudgetCopy(locale);
  const path = (value: string) => localizePathFromEnglish(locale, value);
  const money = new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' });
  const sources = [
    { href: path('/pricing') },
    { href: path('/pay-as-you-go-ai-video-generator') },
    { href: 'https://higgsfield.ai/creator-hub/help-center/credits/how-credit-packs-work', rel: 'nofollow' },
    { href: 'https://openart.ai/help/', rel: 'nofollow' },
  ];
  return <div className={styles.page}>
    <section className={styles.opening} aria-labelledby="project-budget-title">
      <h2 id="project-budget-title">{copy.title}</h2><p>{copy.intro}</p>
    </section>
    <section aria-label={copy.scenario} className={styles.scenario}>
      <div className={styles.scenarioHead}><p><time dateTime={projectCostExample.checked}>{copy.scenario}</time></p><p>{copy.settings}</p></div>
      <ProjectBudgetReceipt locale={locale} />
      <Link className={styles.sourceLink} href={`${path(projectCostExample.pricePath)}#${projectCostExample.priceFragment}`}>{copy.source}<ArrowUpRight size={17} aria-hidden="true" /></Link>
      <p><Link className={styles.action} href="/app" prefetch={false} data-analytics-event="cta_click" data-analytics-cta-name="project_cost_configure" data-analytics-cta-location="project_cost_scenario" data-analytics-target-family="workspace">{copy.action}<ArrowRight size={18} aria-hidden="true" /></Link></p>
    </section>
    <section className={styles.scenarios} aria-labelledby="all-budgets-title">
      <div><h2 id="all-budgets-title">{copy.allTitle}</h2><p>{copy.allDescription}</p></div>
      <table><caption className={styles.visuallyHidden}>{copy.settings}</caption><thead><tr>{copy.table.map(item => <th scope="col" key={item}>{item}</th>)}</tr></thead><tbody>{([1, 3, 6] as const).map(count => { const budget = projectAttemptBudget(count); return <tr key={count}><th scope="row">{count}</th><td>{money.format(budget.spentCents / 100)}</td><td>{money.format(budget.remainingCents / 100)}</td></tr>; })}</tbody></table>
    </section>
    <section className={styles.method} aria-labelledby="cost-method-title"><h2 id="cost-method-title">{copy.stepsTitle}</h2><ol>{copy.steps.map((item, i) => <li key={item.title}><span aria-hidden="true">0{i + 1}</span><div><h3>{item.title}</h3><p>{item.text}</p></div></li>)}</ol></section>
    <aside className={styles.fair}><h2>{copy.fitTitle}</h2><p>{copy.fit}</p></aside>
    <section className={styles.next}><div><h2>{copy.nextTitle}</h2><p>{copy.nextBody}</p></div><div><Link className={styles.action} href="/app" prefetch={false} data-analytics-event="cta_click" data-analytics-cta-name="project_cost_configure" data-analytics-cta-location="project_cost_article" data-analytics-target-family="workspace">{copy.action}<ArrowRight size={18} aria-hidden="true" /></Link><Link className={styles.secondary} href={path('/blog/compare-ai-video-platforms')}>{copy.secondary}<ArrowUpRight size={16} aria-hidden="true" /></Link></div></section>
    <section className={styles.sources} aria-labelledby="cost-sources-title"><h2 id="cost-sources-title">{copy.sourcesTitle}</h2><p>{copy.sourcesNote}</p><ul>{sources.map(({ href, rel }, i) => <li key={href}><a href={href} rel={rel}>{copy.links[i]}<ArrowUpRight size={14} aria-hidden="true" /></a></li>)}</ul></section>
  </div>;
}
