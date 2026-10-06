'use client';
import type {StudioPreparedAnalysis} from '@/lib/studio/media-analysis-contract';
import {useConversationAnalysis} from '../_hooks/useConversationAnalysis';
import styles from './conversation-analysis.module.css';

export function ConversationAnalysis({quote,projectId,accountKey,locale,busy,onConfirmed,onRenew}:{quote:StudioPreparedAnalysis;projectId:string;accountKey:string;locale:'en'|'fr';busy:boolean;onConfirmed:()=>void;onRenew:()=>void}){
  const analysis=useConversationAnalysis(projectId,accountKey,quote);
  const t=(en:string,fr:string)=>locale==='fr'?fr:en;
  const state=analysis.status?.state;
  const expired=Date.parse(quote.expiresAt)<=Date.now();
  const blocked=busy||analysis.busy;
  return <section className={styles.card} aria-label={t('Media analysis','Analyse du média')}>
    <h3>{t('Analyse with Sol 6.1','Analyser avec Sol 6.1')}</h3>
    <p>{quote.goal}</p>
    <p>{quote.startSec.toFixed(2)}–{quote.endSec.toFixed(2)} s · {quote.profile==='audio-window-v1'?t('Sound','Son'):t('Video frames','Images de la vidéo')}</p>
    <p>{t('Maximum','Maximum')} <strong>{quote.maxCredits} {t('credits','crédits')}</strong>. {t('Included credits are used first. Purchased credits stay paused until you resume them.','Les crédits inclus sont utilisés en premier. Les crédits achetés restent en pause jusqu’à leur réactivation.')}</p>
    {(state==='queued'||state==='running')&&<p role="status">{t('Analysis in progress. Your media is preserved.','Analyse en cours. Votre média est conservé.')}</p>}
    {state==='unknown'&&<p role="status">{t('Usage is being recovered. Credits remain reserved; this analysis will not be repeated.','La consommation est en cours de récupération. Les crédits restent réservés ; cette analyse ne sera pas répétée.')}</p>}
    {analysis.error&&<p role="alert">{analysis.error}</p>}
    {state==='failed'&&<p role="alert">{t('Analysis stopped. Check the recorded usage before requesting another inspection.','L’analyse s’est arrêtée. Vérifiez la consommation enregistrée avant de demander une nouvelle inspection.')}</p>}
    {analysis.status?.chargedCredits!=null&&<p>{t('Recorded usage','Consommation enregistrée')} : {analysis.status.chargedCredits} {t('credits','crédits')}.</p>}
    {analysis.status?.result&&<>
      <p>{analysis.status.result.summary}</p>
      <p className={styles.note}>{t('Only the stated interval and sampled frames or audio window were inspected. Timings may be approximate.','Seuls l’intervalle indiqué et les images échantillonnées ou l’extrait audio ont été examinés. Les repères peuvent être approximatifs.')}</p>
      <ul>{analysis.status.result.observations.map((item,index)=><li key={index}><strong>{item.startSec.toFixed(2)}–{item.endSec.toFixed(2)} s</strong> · {item.text} {item.kind==='inferred'?t('(inferred)','(déduit)'):''}</li>)}</ul>
    </>}
    {state==='prepared'&&!expired&&<button disabled={blocked} onClick={()=>void analysis.confirm().then(confirmed=>{if(confirmed)onConfirmed();})}>{t('Analyse with Sol 6.1','Analyser avec Sol 6.1')} · {quote.maxCredits} {t('credits maximum','crédits maximum')}</button>}
    {state==='prepared'&&expired&&<button disabled={blocked} onClick={onRenew}>{t('Prepare a current analysis quote','Préparer un nouveau devis d’analyse')}</button>}
    {state!=='prepared'&&state!=='queued'&&state!=='running'&&<button disabled={blocked} onClick={()=>void analysis.refresh()}>{t('Refresh analysis status','Actualiser l’état de l’analyse')}</button>}
    <p className={styles.note}>{t('This confirms only the selected analysis. New generations and exports have their own quotes.','Cette confirmation concerne uniquement l’analyse sélectionnée. Les nouvelles générations et les exports ont leurs propres devis.')}</p>
  </section>;
}
