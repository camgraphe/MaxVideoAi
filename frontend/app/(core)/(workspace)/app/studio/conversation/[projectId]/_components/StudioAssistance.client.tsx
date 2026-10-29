'use client';
import {useEffect,useId,useRef,useState,type RefObject} from 'react';
import Link from 'next/link';
import {ArrowUpRight,Info,Check, X,ChevronDown} from 'lucide-react';
import {MILO_LEVELS,miloLevelForModel,type MiloLevel,type StudioAssistanceChoice,type StudioAssistanceStatus} from '@/lib/studio/assistance-contract';
import {additionalAssistanceBudget} from '../_lib/conversation-assistance';
import styles from './studio-assistance.module.css';
import {StudioAssistanceCreditsDialog} from './StudioAssistanceCredits.client';
export type StudioAssistanceProps={tasksEnabled?:boolean;openSignal?:number;status:StudioAssistanceStatus|null;busy:boolean;error:string|null;locale:'en'|'fr';conversationBusy:boolean;choose:(choice:StudioAssistanceChoice)=>Promise<boolean>;refresh:()=>Promise<void>;onChoice:()=>void};
type Props=StudioAssistanceProps;
const money=(cents:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(cents/100);
export function StudioAssistance(props:Props) {
  const [open,setOpen]=useState(false),[requestedView,setRequestedView]=useState<MiloLevel|undefined>(),trigger=useRef<HTMLButtonElement>(null),returnFocus=useRef<HTMLButtonElement|null>(null);
  useEffect(()=>{if(props.openSignal){const active=document.activeElement;returnFocus.current=active?.tagName==='BUTTON'?active as HTMLButtonElement:trigger.current;setRequestedView('max');setOpen(true);}},[props.openSignal]);
  const {status,locale}=props,t=(en:string,fr:string)=>locale==='fr'?fr:en;
  if(status&&!status.enabled)return null;
  function close(){setOpen(false);}
  function show(opener:HTMLButtonElement,view?:MiloLevel){returnFocus.current=opener;setRequestedView(view);setOpen(true);}
  return <>
    <div className={styles.control}>
      <div className={styles.controlRow}>
        <span className={styles.identity}><span aria-hidden="true"/>Milo</span>
        <div className={styles.modes} role="group" aria-label={t('Milo mode','Mode Milo')}>
          {(['lite',...(status?.credits?['standard' as const]:[]),'max'] as MiloLevel[]).map(level=><button key={level} type="button" aria-pressed={!!status&&miloLevelForModel(status.selectedModel)===level} aria-haspopup="dialog" disabled={!status||props.busy} onClick={event=>show(event.currentTarget,level)}>{MILO_LEVELS[level].label}</button>)}
        </div>
        <button type="button" ref={trigger} className={styles.trigger} aria-haspopup="dialog" aria-expanded={open} aria-label={t('Milo settings and credits','Réglages et crédits Milo')} onClick={event=>show(event.currentTarget)}><Info size={16}/><span className={styles.mobileMode}>{status ? MILO_LEVELS[miloLevelForModel(status.selectedModel)].label : 'Milo'}<ChevronDown size={13}/></span></button>
      </div>
    </div>
    {open&&(status?.credits?<StudioAssistanceCreditsDialog {...props} initialView={requestedView} trigger={returnFocus} fallbackTrigger={trigger} onClose={close}/>:<AssistanceDialog {...props} trigger={returnFocus} fallbackTrigger={trigger} onClose={close}/>)}
  </>;
}
function AssistanceDialog({status,busy,error,locale,conversationBusy,choose,refresh,onChoice,trigger,fallbackTrigger,onClose}:Props&{trigger:RefObject<HTMLButtonElement>;fallbackTrigger?:RefObject<HTMLButtonElement>;onClose:()=>void}) {
  const dialog=useRef<HTMLDialogElement>(null),id=useId(),t=(en:string,fr:string)=>locale==='fr'?fr:en;
  const [amount,setAmount]=useState(500);
  useEffect(()=>{const el=dialog.current,opener=trigger.current,fallback=fallbackTrigger?.current;el?.showModal();return()=>{el?.close();(opener?.isConnected?opener:fallback)?.focus();};},[trigger,fallbackTrigger]);
  async function select(choice:StudioAssistanceChoice) {if(await choose(choice)){onChoice();onClose();}}
  const locked=busy||conversationBusy||!!status?.unresolvedCalls;
  const availableAmounts=[500,1000,2000].filter(value=>value<=(status?.paid.maxAdditionalBudgetCents??0));
  const selectedAmount=availableAmounts.includes(amount)?amount:availableAmounts[0];
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby={id} onCancel={event=>{event.preventDefault();if(!busy)onClose();}} onClick={event=>{if(event.target===event.currentTarget&&!busy)onClose();}}>
    <header><div><span className={styles.eyebrow}>MILO · STUDIO</span><h2 id={id}>{t('Room for your ideas.','De la place pour vos idées.')}</h2></div><button autoFocus disabled={busy} aria-label={t('Close assistance','Fermer l’assistance')} onClick={onClose}><X size={18}/></button></header>
    <p className={styles.intro}>{t('Milo is your creative partner. Set a spending limit, or continue with Lite at no extra assistance charge.','Milo vous accompagne dans la création. Fixez un budget ou continuez avec Lite sans coût d’assistance supplémentaire.')}</p>
    {error&&<div role="alert" className={styles.notice}><p>{error==='STALE'?t('Your budget or tariff has changed. Refresh it before confirming.','Votre budget ou le tarif a changé. Actualisez avant de confirmer.'):t('We could not verify your assistance budget. Refresh before making another choice.','Nous n’avons pas pu vérifier votre budget. Actualisez avant de choisir à nouveau.')}</p><button disabled={busy} onClick={()=>void refresh()}>{t('Refresh usage','Actualiser l’utilisation')}</button></div>}
    {!status&&!error&&<p role="status">{t('Checking your allowance…','Vérification de votre allocation…')}</p>}
    {status&&<>
      {!!status.unresolvedCalls&&<p className={styles.notice} role="status">{t('A previous assistance cost needs verification. Its budget remains reserved until it is settled or released by support.','Un coût d’assistance précédent doit être vérifié. Le budget reste réservé jusqu’à sa confirmation ou sa restitution par le support.')} <Link href="/contact" prefetch={false}>{t('Contact support','Contacter le support')}</Link></p>}
      <section className={styles.allowance}><div><strong>{t('Included Max','Max inclus')}</strong><span>{Math.round(status.includedSol.remainingPercent)}% {t('remaining','restants')}</span></div><progress max={100} value={status.includedSol.remainingPercent} aria-label={t('Included Max remaining','Max inclus restant')}/><small>{t('One-time introductory allowance. Does not renew automatically.','Allocation unique de découverte. Sans renouvellement automatique.')}</small></section>
      <section className={styles.budget}><div className={styles.sectionTitle}><h3>{t('Continue with Max','Continuer avec Max')}</h3>{status.mode==='paid_sol'&&<Check size={15}/>}</div><p>{t('Choose an additional limit for assistance, paid from your existing MaxVideoAI balance as you use it.','Choisissez un budget supplémentaire d’assistance, prélevé sur votre solde MaxVideoAI au fil de l’utilisation.')}</p>
        {!status.paid.enabled&&status.paid.remainingCents>0&&<button className={styles.textButton} disabled={locked||!!error} onClick={()=>void select({action:'authorize_paid',budgetCents:status.paid.authorizedCents,tariffVersion:status.tariff.version,expectedRevision:status.revision})}>{t('Resume authorized Max · ','Reprendre Max autorisé · ')+money(status.paid.remainingCents)}</button>}
        <div className={styles.amounts} role="group" aria-label={t('Additional assistance budget','Budget d’assistance supplémentaire')}>{availableAmounts.map(value=><button key={value} disabled={locked||!!error} aria-pressed={selectedAmount===value} onClick={()=>setAmount(value)}>{money(value)}</button>)}</div>
        <button className={styles.primary} disabled={locked||!!error||!selectedAmount} onClick={()=>void select({action:'authorize_paid',budgetCents:additionalAssistanceBudget(status,selectedAmount!),tariffVersion:status.tariff.version,expectedRevision:status.revision})}>{busy?t('Saving…','Enregistrement…'):selectedAmount?t('Authorize ','Autoriser ')+money(selectedAmount)+t(' more',' de plus'):t('Maximum budget reached','Budget maximum atteint')}<ArrowUpRight size={15}/></button>
        <small>{t('No automatic recharge. Setting a limit does not charge your wallet.','Aucune recharge automatique. Fixer un budget ne débite pas votre solde.')}</small>
        {(status.paid.authorizedCents>0||status.paid.spentCents>0)&&<div className={styles.balance}><span>{money(status.paid.remainingCents)} {t('available','disponibles')}</span><span>{money(status.paid.spentCents)} {t('used','utilisés')} · {money(status.paid.reservedCents)} {t('reserved','réservés')}</span></div>}
        {status.paid.enabled&&<button className={styles.textButton} disabled={busy||!!error} onClick={()=>void select({action:'disable_paid',expectedRevision:status.revision})}>{t('Stop paid assistance','Arrêter l’assistance payante')}</button>}
      </section>
      <section className={styles.luna}><div className={styles.sectionTitle}><h3>Lite</h3><span>{t('No extra assistance charge','Sans coût d’assistance supplémentaire')}</span></div><p>{t('Keep chatting and working. Lite is less capable on complex creative direction and detailed planning. Its included allowance is limited.','Continuez à discuter et à travailler. Lite est moins performant pour la direction créative complexe et la planification détaillée. Son allocation incluse est limitée.')}</p><button disabled={locked||!!error||status.sponsoredLuna.remainingPercent<=0||status.mode==='sponsored_luna'||status.blockedReason==='campaign_exhausted'} onClick={()=>void select({action:'select_luna',expectedRevision:status.revision})}>{status.mode==='sponsored_luna'?t('Using Lite','Lite actif'):t('Continue with Lite','Continuer avec Lite')}<span>{Math.round(status.sponsoredLuna.remainingPercent)}%</span></button></section>
      {status.mode==='sponsored_luna'&&(status.paid.enabled||status.includedSol.remainingPercent>0)&&<button className={styles.textButton} disabled={locked||!!error} onClick={()=>void select({action:'select_sol',expectedRevision:status.revision})}>{status.paid.enabled?t('Resume paid Max · '+money(status.paid.remainingCents)+' left','Reprendre Max payant · '+money(status.paid.remainingCents)+' restants'):t('Use remaining included Max','Utiliser le Max inclus restant')}</button>}
      <details className={styles.rates}><summary>{t('How assistance is priced','Comment l’assistance est facturée')}</summary><p>{t('Lite uses GPT‑6 Luna. Max uses GPT‑6.1 Sol.', 'Lite utilise GPT‑6 Luna. Max utilise GPT‑6.1 Sol.')}</p><p>{t('Per million tokens:','Par million de tokens :')} {money(status.tariff.noncachedInputUsdPerMillion*100)} {t('input','en entrée')}, {money(status.tariff.cachedInputUsdPerMillion*100)} {t('cached input','en entrée en cache')}, {money(status.tariff.outputUsdPerMillion*100)} {t('output, including reasoning','en sortie, réflexion comprise')}.</p><p>{t('All model calls for one message are added together, then rounded up to the next cent. Longer conversations and references can use more tokens.','Les appels au modèle pour un message sont additionnés, puis arrondis au centime supérieur. Les longues conversations et les références peuvent consommer davantage de tokens.')}</p><p>{t('Up to ','Jusqu’à ')}{status.tariff.maxCallsPerMessage}{t(' model calls per message, including retries.',' appels au modèle par message, reprises comprises.')}</p><small>{status.tariff.version}</small></details>
      <footer><p>{t('Images, videos and film exports are separate: you always review their price before confirming.','Images, vidéos et exports de films sont séparés : vous validez toujours leur prix avant confirmation.')}</p><Link href="/billing" prefetch={false}>{t('Manage your wallet','Gérer votre solde')}<ArrowUpRight size={13}/></Link></footer>
    </>}
  </dialog>;
}
