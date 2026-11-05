'use client';
import {MILO_LEVELS,miloLevelForModel,type StudioAssistanceStatus} from '@/lib/studio/assistance-contract';
import styles from './prompt-assistance.module.css';

/** Application feedback: never represented as an assistant reply or a purchase. */
export function MiloAccessNotice({authRequired=false,canUseLite=true,busy=false,onLite,onCredits,liteLabel='Send with Lite',placement='feedback',status,locale='en'}:{authRequired?:boolean;canUseLite?:boolean;busy?:boolean;onLite:()=>void;onCredits:()=>void;liteLabel?:string;placement?:'feedback'|'input';status?:StudioAssistanceStatus|null;locale?:string}) {
  if(authRequired) {
    const signIn = <a href={`/login?next=${encodeURIComponent(typeof window==='undefined'?'/app':window.location.pathname+window.location.search)}`}>Sign in to chat</a>;
    return placement === 'input'
      ? <div className={styles.inputNotice} role="status">{signIn} with Milo. Lite is free.</div>
      : <div className={styles.liveFeedback} role="status"><span>Sign in to chat with Milo. Lite is free.</span>{signIn}</div>;
  }
  const credits=status?.credits;
  const available=credits?credits.included.remaining+(status.paid.enabled?credits.purchased.remaining:0):null;
  const level=status?MILO_LEVELS[miloLevelForModel(status.selectedModel)].label:null;
  const t=(en:string,fr:string,es:string)=>locale.startsWith('fr')?fr:locale.startsWith('es')?es:en;
  const quantity=available===null?null:new Intl.NumberFormat(locale).format(available);
  return <div className={styles.liveFeedback} role="status">
    <span>{available===null
      ? t('Not enough credits for this message’s credit reservation. Some credits may remain.','Les crédits ne suffisent pas à réserver ce message. Il peut rester des crédits.','No hay suficientes créditos para la reserva de este mensaje. Puede que queden créditos.')
      : t(`${quantity} Milo credits available. This message needs a larger credit reservation${level?` at ${level}`:''}.`,`${quantity} crédits Milo disponibles. Ce message nécessite une réserve de crédits plus importante${level?` avec ${level}`:''}.`,`${quantity} créditos Milo disponibles. Este mensaje necesita una reserva de créditos mayor${level?` con ${level}`:''}.`)}{' '}
      {canUseLite?t('You can choose Milo Lite to send for free.','Vous pouvez choisir Milo Lite pour envoyer gratuitement.','Puedes elegir Milo Lite para enviar gratis.'):t('Free Lite is unavailable right now.','Lite gratuit est indisponible actuellement.','Lite gratis no está disponible ahora.')} {' '}
      {t('Open Milo to review credits and levels.','Ouvrez Milo pour consulter les crédits et les niveaux.','Abre Milo para revisar los créditos y niveles.')}
    </span>
    {canUseLite&&<button type="button" disabled={busy} onClick={onLite}>{liteLabel}</button>}
    <button type="button" disabled={busy} onClick={onCredits}>Add credits</button>
  </div>;
}
