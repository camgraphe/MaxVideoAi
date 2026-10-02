'use client';
import type {StudioPreparedExport} from '@/lib/studio/conversation-export-contract';
import type {TimelineExportJobResponse} from '@/server/timeline-exports/contracts';
import {usePreparedConversationExport} from '../_hooks/usePreparedConversationExport';
import styles from '../image-conversation.module.css';
export function ConversationExportQuote({quote,jobs,busy,locale,onChange,onRenew}:{quote:StudioPreparedExport;jobs:TimelineExportJobResponse[];busy:boolean;locale:'en'|'fr';onChange:()=>void|Promise<void>;onRenew:()=>void}){
  const state=usePreparedConversationExport(quote,jobs,onChange);
  const t=(en:string,fr:string)=>locale==='fr'?fr:en;
  const price=state.job?.billing??quote.price;
  const amount=price.amountCents===0?t('Free','Gratuit'):new Intl.NumberFormat(locale,{style:'currency',currency:price.currency}).format(price.amountCents/100);
  const needsNewQuote=state.error==='QUOTE_EXPIRED'||state.error==='PRICING_REFRESH_REQUIRED'||(state.expired&&!state.uncertain&&!state.job);
  return <div className={styles.quote} aria-label={t('Film export quote','Devis d’export du film')}>
    <strong>{t('Your film','Votre film')} · {amount}</strong>
    <p>{quote.durationSec.toFixed(1)} s · {quote.resolution} · {quote.aspectRatio} · {quote.fps} fps · {quote.qualityPreset}</p>
    {!quote.includeAudio&&<p>{t('Without audio','Sans audio')}</p>}
    {state.job?<p role="status">{state.job.status==='completed'?t('Film ready below.','Film disponible ci-dessous.'):state.job.status==='failed'||state.job.status==='canceled'?t('This render stopped. Prepare a new quote to try again.','Ce rendu s’est arrêté. Préparez un nouveau devis pour réessayer.'):t('Rendering your film…','Votre film se prépare…')}</p>:needsNewQuote?<><p>{t('The quote or saved cut has changed. Review a new quote before exporting.','Le devis ou le montage sauvegardé a changé. Vérifiez un nouveau devis avant l’export.')}</p><button disabled={busy||state.pending} onClick={onRenew}>{t('Refresh export quote','Actualiser le devis d’export')}</button></>:<>
      <button disabled={busy||state.pending} onClick={()=>void state.confirm()}>{state.pending?t('Confirming…','Confirmation…'):state.uncertain?t('Resume this export','Reprendre cet export'):`${t('Confirm export','Confirmer l’export')} · ${amount}`}</button>
      {state.error&&<p role="status">{state.uncertain?t('The reply was lost. This button recovers the same export.','La réponse a été perdue. Ce bouton retrouve le même export.'):t('The export could not start. Refresh its status before trying again.','L’export n’a pas pu démarrer. Actualisez son statut avant de réessayer.')}</p>}
    </>}
  </div>;
}
