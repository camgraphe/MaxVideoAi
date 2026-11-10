'use client';

import { useState } from 'react';
import { ArrowRight, Check, Clock3 } from 'lucide-react';
import type { AppLocale } from '@/i18n/locales';
import { getExperienceCopy } from '../_content/experience';
import styles from './comparison.module.css';

export function ProductionPace({ locale }: { locale: AppLocale }) {
  const copy = getExperienceCopy(locale);
  const [regular, setRegular] = useState(false);
  return (
    <div className={styles.pace}>
      <div className={styles.paceHeader}>
        <h2>{copy.pace}</h2>
        <div>
          <div className={styles.intentControls} role="group" aria-label={copy.pace}>
            {[copy.occasional, copy.regular].map((label, index) => <button key={label} type="button" aria-pressed={regular === Boolean(index)} onClick={() => setRegular(Boolean(index))}><span aria-hidden="true">{regular === Boolean(index) ? <Check size={16} /> : null}</span>{label}</button>)}
          </div>
          <p className={styles.intentExplanation} aria-live="polite">{copy.explanation[Number(regular)]}</p>
        </div>
      </div>
      <div className={styles.commitments}>
        {[
          { brand: 'MaxVideoAI', title: copy.maxTitle, text: copy.maxText, stages: copy.maxTimeline, kind: 'max', Icon: Check },
          { brand: 'Higgsfield', title: copy.higgsTitle, text: copy.higgsText, stages: copy.higgsTimeline, kind: 'higgs', Icon: Clock3 },
        ].map(({ brand, title, text, stages, kind, Icon }) => (
          <div key={brand} className={styles.commitment} data-brand={kind}>
            <div className={styles.brandLine}><span>{brand}</span><Icon size={21} strokeWidth={1.5} aria-hidden="true" /></div>
            <h3>{title}</h3><p>{text}</p>
            <ol className={styles.timeline} aria-label={`${brand} · ${copy.timelineLabel}`}>{stages.map((stage) => <li key={stage}><span aria-hidden="true" /><span>{stage}</span></li>)}</ol>
            <a href={regular ? '#competitor-fit' : '#one-project'}>{copy.details}<ArrowRight size={16} aria-hidden="true" /></a>
          </div>
        ))}
      </div>
    </div>
  );
}
