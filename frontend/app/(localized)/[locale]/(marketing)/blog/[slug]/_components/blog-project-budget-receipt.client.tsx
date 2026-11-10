'use client';

import { useState } from 'react';
import type { AppLocale } from '@/i18n/locales';
import { projectCostExample, projectAttemptBudget, type ProjectAttemptCount } from '@/lib/marketing/project-cost-example';
import { getProjectBudgetCopy } from './blog-project-budget-copy';
import styles from './blog-project-budget.module.css';

export function ProjectBudgetReceipt({ locale }: { locale: AppLocale }) {
  const [attempts, setAttempts] = useState<ProjectAttemptCount>(3);
  const copy = getProjectBudgetCopy(locale);
  const money = new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol' });
  const amount = (cents: number) => money.format(cents / 100);
  const budget = projectAttemptBudget(attempts);
  return <div className={styles.receipt}>
    <fieldset className={styles.choices}>
      <legend>{copy.selector}</legend>
      <div>{([1, 3, 6] as const).map((count, index) => <button key={count} type="button" aria-pressed={attempts === count} onClick={() => setAttempts(count)}>{copy.attempts[index]}</button>)}</div>
    </fieldset>
    <div aria-live="polite" aria-atomic="true">
      <dl className={styles.totals}>
        <div><dt>{copy.paid}</dt><dd>{amount(projectCostExample.initialFundingCents)}</dd></div>
        <div><dt>{copy.spent}</dt><dd>{amount(budget.spentCents)}</dd></div>
        <div><dt>{copy.left}</dt><dd>{amount(budget.remainingCents)}</dd></div>
      </dl>
      <div className={styles.balanceBar} role="img" aria-label={`${copy.chart}: ${copy.spent} ${amount(budget.spentCents)}, ${copy.left} ${amount(budget.remainingCents)}`}>
        <span style={{ width: `${budget.spentCents / projectCostExample.initialFundingCents * 100}%` }} />
      </div>
      <p className={styles.formula}>{attempts} × {amount(projectCostExample.unitCents)} <span>{copy.calculation}</span></p>
    </div>
    <p className={styles.scope}>{copy.note}</p>
  </div>;
}
