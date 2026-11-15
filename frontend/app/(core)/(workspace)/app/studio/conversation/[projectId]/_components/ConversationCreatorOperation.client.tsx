'use client';
/* eslint-disable @next/next/no-img-element -- Owned private thumbnails must stay outside the public optimizer. */

import type {ImageConversationTurn} from '@/lib/studio/image-conversation-contract';
import {useConversationCreatorOperations} from '../_hooks/useConversationCreatorOperations';
import styles from '../image-conversation.module.css';

type Props={turn:ImageConversationTurn;projectId:string;accountKey:string;locale:'en'|'fr';busy:boolean;
  onChange:()=>void|Promise<unknown>;onRenew:()=>void};

export function ConversationCreatorOperation({turn,projectId,accountKey,locale,busy,onChange,onRenew}:Props) {
  const state=useConversationCreatorOperations({turn,projectId,accountKey,onChange});
  const t=(en:string,fr:string)=>locale==='fr'?fr:en;
  const quote=turn.creatorQuote;
  const operation=state.operation;
  const toolId=quote?.toolId??operation?.toolId;
  if(!toolId)return null;
  const names={subtitles:t('Subtitles','Sous-titres'),'lip-sync':'Lip Sync',
    'product-photo-editor':t('Product Photo Editor','Retouche produit'),
    'product-video-editor':t('Product Video Editor','Vidéo produit'),'motion-transfer':t('Motion Transfer','Transfert de mouvement')};
  const amount=quote?new Intl.NumberFormat(locale,{style:'currency',currency:quote.price.currency}).format(quote.price.amountCents/100):null;
  const includedExport=quote?.toolId==='subtitles'&&quote.kind==='render'&&quote.price.amountCents===0;
  const completed=operation?.state==='completed';
  const active=operation&&['queued','running','finalizing'].includes(operation.state);
  const attention=operation?.needsAttention===true;
  const needsQuote=operation?.state==='expired'||operation?.state==='failed'||state.expired
    ||state.error==='QUOTE_EXPIRED'||state.error==='PRICING_REFRESH_REQUIRED';
  const available=operation?.confirmationEnabled!==false;
  const result=completed?operation.result:null;
  const document=result?.document;
  return <div className={styles.quote} aria-label={`${names[toolId]} ${t('quote and result','devis et résultat')}`}>
    <strong>{names[toolId]}{includedExport?` · ${t('export included','export inclus')}`:amount&&` · ${amount}`}</strong>
    {quote?.kind==='render'&&<p>{t('Captioned video export included in your paid transcription.','Export vidéo sous-titré inclus dans votre transcription payante.')}</p>}
    {quote?.kind==='mix-transcribe'&&<p>{t('Transcript of the saved film and its selected audio.','Transcription du film sauvegardé et de son audio sélectionné.')}</p>}
    {quote?.document&&<p>{t('Subtitle revision','Version des sous-titres')} {quote.document.revision}</p>}
    {quote?.disclosure&&<details><summary>{t('Operation details','Détails de l’opération')}</summary><p>{quote.disclosure}</p></details>}
    {state.pending?<p role="status">{t('Confirming…','Confirmation…')}</p>:attention?<>
      <p role="status">{t('This attempt needs attention. Check its saved status before trying again.','Cette tentative demande votre attention. Vérifiez son état sauvegardé avant de réessayer.')}</p>
      <button disabled={busy||state.pending} onClick={()=>void state.refresh()}>{t('Refresh status','Actualiser le statut')}</button>
    </>:completed?<p role="status">{t('Your result is ready.','Votre résultat est prêt.')}</p>
      :active?<p role="status">{operation.state==='finalizing'?t('Preparing the final result…','Préparation du résultat final…'):t('Creating your result…','Création de votre résultat…')}</p>
      :state.uncertain?<>
        <p role="status">{t('The confirmation reply was lost. Recover this same attempt.','La réponse de confirmation a été perdue. Retrouvez cette même tentative.')}</p>
        <button disabled={busy||state.pending} onClick={()=>void state.refresh()}>{t('Recover this attempt','Retrouver cette tentative')}</button>
      </>:needsQuote?<>
        <p>{t('Review a new quote before another attempt.','Vérifiez un nouveau devis avant une autre tentative.')}</p>
        <button disabled={busy||state.pending} onClick={onRenew}>{t('Review a new quote','Vérifier un nouveau devis')}</button>
      </>:quote&&available&&(!operation||operation.state==='prepared')?<>
        <button className={styles.primary} disabled={busy||state.pending} onClick={()=>void state.confirm()}>
          {includedExport?t('Export MP4 — included','Exporter le MP4 — inclus'):`${t('Confirm','Confirmer')} · ${amount}`}
        </button>
        {state.error&&<>
          <p role="status">{t('This quote could not be confirmed. Refresh its saved status.','Ce devis n’a pas pu être confirmé. Actualisez son état sauvegardé.')}</p>
          <button disabled={busy||state.pending} onClick={()=>void state.refresh()}>{t('Refresh status','Actualiser le statut')}</button>
        </>}
      </>:<>
        <p role="status">{t('This operation is currently unavailable. Its saved status remains readable.','Cette opération est indisponible. Son état sauvegardé reste consultable.')}</p>
        <button disabled={busy||state.pending} onClick={()=>void state.refresh()}>{t('Refresh status','Actualiser le statut')}</button>
      </>}
    {state.error&&active&&<>
      <p role="status">{t('The saved status is temporarily unavailable.','L’état sauvegardé est temporairement indisponible.')}</p>
      <button disabled={busy||state.pending} onClick={()=>void state.refresh()}>{t('Refresh status','Actualiser le statut')}</button>
    </>}
    {completed&&<button disabled={busy||state.pending} onClick={()=>void state.refresh()}>{t('Refresh result access','Actualiser l’accès au résultat')}</button>}
    {document&&<div>
      <p>{t('Subtitle revision','Version des sous-titres')} {document.revision}</p>
      <div className={styles.walletActions}>
        <a href={document.openUrl}>{t('Edit subtitles','Modifier les sous-titres')}</a>
        <a href={document.srtUrl}>{t('Download SRT','Télécharger SRT')}</a>
        <a href={document.vttUrl}>{t('Download VTT','Télécharger VTT')}</a>
      </div>
    </div>}
    {!!result?.outputs.length&&<div className={styles.results}>
      {result.outputs.map((output,index)=>{
        const url=output.artifactDelivery==='available'?output.readUrl:null;
        return <figure key={`${output.kind}:${index}`}>
          {url? <>
            {output.kind==='image'?<img src={output.thumbnailReadUrl??url} alt={t('Your creation','Votre création')} loading="lazy"/>
              :output.kind==='video'?<video src={url} poster={output.thumbnailReadUrl??undefined} controls playsInline preload="none" aria-label={t('Your video','Votre vidéo')}/>
              :<audio src={url} controls preload="none" aria-label={t('Your audio','Votre audio')}/>}
            <figcaption><a href={url} target="_blank" rel="noopener noreferrer">{t('Open original','Ouvrir l’original')}</a></figcaption>
          </>:<>
            <p>{t('Original access is temporarily unavailable. Refresh its saved status.','L’accès à l’original est temporairement indisponible. Actualisez son état sauvegardé.')}</p>
            <button disabled={busy||state.pending} onClick={()=>void state.refresh()}>{t('Refresh access','Actualiser l’accès')}</button>
          </>}
        </figure>;
      })}
    </div>}
  </div>;
}
