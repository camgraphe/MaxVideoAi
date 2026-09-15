'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/locales';
import { HomeComparisonScores } from './HomeComparisonScores.client';
import type { HomeComparisonData } from './home-comparison-types';

const COPY = {
 en: { overall:'Overall score', excerpt:'criteria scored · 3 shown here', cta:'Compare', pause:'Pause rotation', resume:'Resume rotation', select:'Compare Kling 3 Pro with', summary:'Overall score: average of prompt adherence, motion and temporal consistency, using the same calculation as the full comparison.', method:'Editorial ratings · /10', labels:['Prompt adherence','Visual quality','Motion realism'] },
 fr: { overall:'Note globale', excerpt:'critères notés · 3 affichés ici', cta:'Comparer', pause:'Mettre en pause', resume:'Reprendre le défilement', select:'Comparer Kling 3 Pro avec', summary:'Note globale : moyenne du respect des instructions, du mouvement et de la cohérence temporelle, comme dans le comparatif complet.', method:'Évaluations éditoriales · /10', labels:['Respect des instructions','Qualité d’image','Réalisme du mouvement'] },
 es: { overall:'Nota global', excerpt:'criterios evaluados · 3 mostrados aquí', cta:'Comparar', pause:'Pausar rotación', resume:'Reanudar rotación', select:'Comparar Kling 3 Pro con', summary:'Nota global: promedio del seguimiento de instrucciones, el movimiento y la coherencia temporal, igual que en la comparación completa.', method:'Evaluaciones editoriales · /10', labels:['Seguimiento de instrucciones','Calidad de imagen','Realismo del movimiento'] },
};

export function HomeComparisonCarousel({ locale, data, methodology }: { locale: AppLocale; data: HomeComparisonData; methodology: ReactNode }) {
  const copy = COPY[locale];
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [reduced, setReduced] = useState(true);
  const [engaged, setEngaged] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    const visibility = () => setHidden(document.visibilityState === 'hidden');
    update(); visibility();
    query.addEventListener('change', update);
    document.addEventListener('visibilitychange', visibility);
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {threshold:0.25});
    if (root.current) observer.observe(root.current);
    return () => { observer.disconnect(); query.removeEventListener('change', update); document.removeEventListener('visibilitychange', visibility); };
  }, []);
  useEffect(() => {
    if (paused || !visible || hidden || reduced || engaged || data.opponents.length < 2) return;
    const timer = window.setTimeout(() => setIndex(i => (i + 1) % data.opponents.length), 6500);
    return () => window.clearTimeout(timer);
  }, [index, paused, visible, hidden, reduced, engaged, data.opponents.length]);
  const right = data.opponents[index];
  if (!right) return null;
  const tips = { en: ['How closely the result follows the instructions.', 'Overall image quality and visual detail.', 'How natural and coherent the movement looks.'], fr: ['La fidélité du résultat aux instructions données.', 'La qualité d’ensemble et la finesse des détails.', 'Le naturel et la cohérence des mouvements.'], es: ['Qué tanto respeta el resultado las instrucciones.', 'La calidad general de la imagen y sus detalles.', 'Qué tan natural y coherente se ve el movimiento.'] }[locale];
  const metrics = copy.labels.map((label, i) => ({id:String(i), label, tooltip:tips[i], leftValue:data.left.scores[i] ?? null, rightValue:right.scores[i] ?? null}));
  return <div ref={root} className="choice-scorecard comparison-carousel" onMouseEnter={() => setEngaged(true)} onMouseLeave={() => setEngaged(false)} onFocusCapture={() => setEngaged(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setEngaged(false); }}>
    <div className="comparison-switcher" aria-label={copy.select}>
      {data.opponents.map((model, i) => <button key={model.slug} type="button" aria-pressed={index === i} onClick={() => {setIndex(i); setPaused(true);}}>{model.name}</button>)}
      {!reduced ? <button type="button" className="comparison-rotation" aria-label={paused ? copy.resume : copy.pause} onClick={() => setPaused(value => !value)}>{paused ? '▶' : 'Ⅱ'}</button> : null}
    </div>
    <HomeComparisonScores metrics={metrics} label={`${Math.min(data.left.criteriaCount, right.criteriaCount)} ${copy.excerpt}`} right={right} overallLabel={copy.overall} leftOverall={data.left.overall}/>

    <Link className="comparison-active-link" href={{pathname:'/ai-video-engines/[slug]',params:{slug:`kling-3-pro-vs-${right.slug}`}}} prefetch={false} data-analytics-event="comparison_card_click" data-analytics-cta-name={`kling-3-pro-vs-${right.slug}`} data-analytics-cta-location="comparison_intro">{copy.cta} Kling 3 Pro / {right.name} <span aria-hidden>↗</span></Link>
    <div className="comparison-footnotes"><details className="comparison-global-note"><summary>{ {en:'How is the score calculated?',fr:'Comment la note est-elle calculée ?',es:'¿Cómo se calcula la nota?'}[locale] }</summary><p>{copy.summary}</p></details>{methodology}</div>
  </div>;
}
