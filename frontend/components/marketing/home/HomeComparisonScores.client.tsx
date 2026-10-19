'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import type { HomeComparisonModel } from './home-comparison-types';
import type { PairedMetric } from '@/components/marketing/PairedScores';

function validScore(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 10 ? value : null;
}

/** Compact excerpt of the light comparison grid; values remain readable without motion. */
export function HomeComparisonScores({ metrics, label, right, overallLabel, leftOverall, criterionLabel = 'Criterion', leftName = 'Kling 3 Pro', leftLogo = '/brand/partners/kling/kling-mark-light.png' }: { metrics: PairedMetric[]; label: string; right?: HomeComparisonModel; overallLabel?: string; leftOverall?: number | null; criterionLabel?: string; leftName?: string; leftLogo?: string }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = root.current;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!node || motion.matches) return;
    let frame = 0;
    let started = false;
    let active = true;
    const observer = new IntersectionObserver(([entry]) => {
      if (!active || !entry.isIntersecting || started) return;
      started = true;
      observer.disconnect();
      const start = performance.now();
      node.style.setProperty('--home-score-progress', '0');
      const tick = (now: number) => {
        if (!active) return;
        const fraction = Math.min(1, (now - start) / 1100);
        node.style.setProperty('--home-score-progress', String(1 - Math.pow(1 - fraction, 3)));
        if (fraction < 1) frame = requestAnimationFrame(tick);
        else node.style.removeProperty('--home-score-progress');
      };
      frame = requestAnimationFrame(tick);
    }, { threshold: 0.35 });
    observer.observe(node);
    const finish = () => {
      if (!motion.matches) return;
      active = false;
      observer.disconnect();
      cancelAnimationFrame(frame);
      node.style.removeProperty('--home-score-progress');
    };
    motion.addEventListener('change', finish);
    return () => {
      active = false;
      observer.disconnect();
      cancelAnimationFrame(frame);
      motion.removeEventListener('change', finish);
      node.style.removeProperty('--home-score-progress');
    };
  }, [right?.slug]);

  const models = [
    { name: leftName, logo: leftLogo, overall: leftOverall, side: 'left' },
    { name: right?.name ?? 'Seedance 2.5', logo: right?.logo ?? '/brand/partners/bytedance/bytedance-mark-light.svg', overall: right?.overall, side: 'right' },
  ];
  return <div ref={root} className="comparison-duel">
    <table className="home-score-grid">
      <caption>{label}</caption>
      <colgroup><col className="home-score-criterion-col"/><col/><col/></colgroup>
      <thead><tr>
        <th scope="col">{criterionLabel}<small>0–10</small></th>
        {models.map(model => <th scope="col" key={model.side} className={`home-score-heading home-score-heading-${model.side}`}>
          <div className="home-score-model"><Image src={model.logo} alt="" aria-hidden="true" width={24} height={24}/><span>{model.name}</span></div>
          <span className="home-score-overall"><strong>{validScore(model.overall)?.toFixed(1) ?? '—'}</strong><small>/10 · {overallLabel}</small></span>
        </th>)}
      </tr></thead>
      <tbody>{metrics.map(metric => <tr key={metric.id}>
        <th scope="row"><strong>{metric.label}</strong><small>{metric.tooltip}</small></th>
        {[metric.leftValue, metric.rightValue].map((value, index) => {
          const score = validScore(value);
          return <td key={index} className={`home-score-value home-score-value-${models[index].side}`}>
            <span className="home-score-mobile-name" aria-hidden="true">{models[index].name}</span>
            <span className="home-score-number">{score?.toFixed(1) ?? '—'}{score !== null ? <small>/10</small> : null}</span>
            <span className="home-score-track" aria-hidden="true">{score !== null ? <span style={{width: `${score * 10}%`, transform: index === 0 && right ? 'none' : 'scaleX(var(--home-score-progress, 1))'}}/> : null}</span>
          </td>;
        })}
      </tr>)}</tbody>
    </table>
  </div>;
}
