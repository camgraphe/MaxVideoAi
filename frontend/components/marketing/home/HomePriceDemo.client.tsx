'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/locales';
import type { HomePriceModel } from './home-price-demo-types';

const AppSurface = dynamic(() => import('./HomePriceAppSurface.client').then(module => module.HomePriceAppSurface), {ssr:false});
const COPY = {
 en:{demo:'Inside MaxVideoAI',tag:'Guided demo',steps:['Try an idea','Give it more time','Add more detail'],details:['5 seconds. Enough to explore a direction.','Same model, same quality. A longer scene.','Keep 15 seconds. Switch to Full HD.'],duration:'Duration',resolution:'Resolution',audio:'Audio on · 16:9 · 1 video',quote:'The price is here, before you generate.',pause:'Pause',replay:'Replay',note:'Example quotes in USD. The app confirms the final price before generation.',cta:'Open the studio',pricing:'See all prices',guarantees:['No subscription','Choose your settings','See the price first']},
 fr:{demo:'Dans MaxVideoAI',tag:'Démonstration guidée',steps:['Tester une idée','Laisser durer la scène','Affiner les détails'],details:['5 secondes. De quoi explorer une piste.','Même modèle, même qualité. Une scène plus longue.','Gardez les 15 secondes. Passez en Full HD.'],duration:'Durée',resolution:'Résolution',audio:'Audio activé · 16:9 · 1 vidéo',quote:'Le prix est ici, avant de générer.',pause:'Pause',replay:'Rejouer',note:'Exemples de devis en USD. L’app confirme le prix final avant chaque génération.',cta:'Ouvrir le studio',pricing:'Voir tous les tarifs',guarantees:['Sans abonnement','Vos réglages, votre choix','Le prix avant de lancer']},
 es:{demo:'Dentro de MaxVideoAI',tag:'Demostración guiada',steps:['Probar una idea','Darle más tiempo','Afinar los detalles'],details:['5 segundos. Suficiente para explorar una idea.','Mismo modelo, misma calidad. Una escena más larga.','Mantén los 15 segundos. Pasa a Full HD.'],duration:'Duración',resolution:'Resolución',audio:'Audio activado · 16:9 · 1 video',quote:'El precio está aquí, antes de generar.',pause:'Pausa',replay:'Volver a ver',note:'Ejemplos de precios en USD. La app confirma el precio final antes de generar.',cta:'Abrir el estudio',pricing:'Ver todos los precios',guarantees:['Sin suscripción','Tú eliges los ajustes','Conoce el precio antes']},
};

export function HomePriceDemo({locale,models}:{locale:AppLocale;models:HomePriceModel[]}) {
 const c = COPY[locale];
 const root = useRef<HTMLDivElement>(null);
 const [stepIndex,setStepIndex] = useState(0);
 const [ready,setReady] = useState(false);
 const [visible,setVisible] = useState(false);
 const [playing,setPlaying] = useState(true);
 const [reduced,setReduced] = useState(true);
 useEffect(()=>{
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const update = () => setReduced(media.matches);
  update(); media.addEventListener('change',update);
  const observer = new IntersectionObserver(([entry])=>{setVisible(entry.isIntersecting);if(entry.isIntersecting)setReady(true);},{threshold:0.2});
  if(root.current)observer.observe(root.current);
  return ()=>{observer.disconnect();media.removeEventListener('change',update);};
 },[]);
 useEffect(()=>{
  if(!visible || !playing || reduced)return;
  const timer = setInterval(()=>{
   if(document.hidden)return;
   setStepIndex(value=>{if(value===2){setPlaying(false);return value;}return value+1;});
  },4200);
  return ()=>clearInterval(timer);
 },[visible,playing,reduced]);
 const model=models[0];
 if(!model)return <Link href="/pricing">{c.pricing} ↗</Link>;
 const step=model.steps[stepIndex];
 return <div className="price-walkthrough">
  <div className="price-walkthrough-story">
   <div className="price-walkthrough-label"><span>{c.demo}</span><small>Wan 3</small></div>
   <div className="price-walkthrough-steps">{model.steps.map((item,index)=><button type="button" key={index} aria-pressed={stepIndex===index} onClick={()=>{setStepIndex(index);setPlaying(false);}}><span className="price-step-number">0{index+1}</span><span><strong>{c.steps[index]}</strong><small>{item.seconds} s · {item.resolution}</small></span><span aria-hidden>↗</span></button>)}</div>
   <p className="price-walkthrough-description" key={stepIndex}>{c.details[stepIndex]}</p>
   <div className="price-walkthrough-links"><Link href="/app">{c.cta} ↗</Link><Link href="/pricing">{c.pricing} →</Link></div>
  </div>
  <div className="price-walkthrough-stage" ref={root}>
   <div className="price-walkthrough-play"><span>{c.tag}</span><button type="button" onClick={()=>{if(playing){setPlaying(false);}else{setStepIndex(0);setPlaying(true);}}}>{playing&&!reduced ? c.pause : c.replay} <span aria-hidden>{playing&&!reduced?'Ⅱ':'↻'}</span></button></div>
   <div className="price-app-frame" data-price-step={stepIndex}>
    {ready ? <AppSurface model={model} step={step} locale={locale}/> : <div className="price-app-placeholder">MaxVideoAI · Wan 3</div>}
    <div className="price-app-annotation"><span aria-hidden>↑</span>{c.quote}</div>
   </div>
   <div className="price-walkthrough-caption" aria-live={playing?'off':'polite'} aria-atomic="true"><span>{c.duration} <strong>{step.seconds} s</strong> · {c.resolution} <strong>{step.resolution}</strong><small>{c.audio}</small></span><strong className="sr-only" key={stepIndex}>{step.display}</strong></div>
   <p className="price-walkthrough-note">{c.note}</p>
  </div>
  <ul className="price-walkthrough-guarantees">{c.guarantees.map(text=><li key={text}><span aria-hidden>✓</span>{text}</li>)}</ul>
 </div>;
}
