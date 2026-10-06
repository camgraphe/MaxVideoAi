'use client';
import {useId} from 'react';
import {STUDIO_TASK_PROFILES,type StudioTaskProfile} from '@/lib/studio/task-budget-contract';
import styles from './conversation-task.module.css';
export function TaskBudgetPicker({profile,onProfile,confirmed,onConfirmed,sol,disabled,locale}:{profile:StudioTaskProfile;onProfile:(profile:StudioTaskProfile)=>void;confirmed:boolean;onConfirmed:(value:boolean)=>void;sol:boolean;disabled:boolean;locale:'en'|'fr'}) {
  const id=useId(),t=(en:string,fr:string)=>locale==='fr'?fr:en;
  return <fieldset className={styles.picker} disabled={disabled}>
    <legend>{t('Work allowance','Enveloppe de travail')}</legend>
    <div className={styles.options}>{(['quick','standard','complex'] as const).map(value=><label key={value}><input type="radio" name={id} value={value} checked={profile===value} disabled={disabled||value==='complex'&&!sol} onChange={()=>onProfile(value)}/><span>{value==='quick'?t('Quick','Rapide'):value==='standard'?t('Standard','Standard'):t('Complex · Sol','Complexe · Sol')}<small>{sol?`${t('Up to','Jusqu’à')} ${STUDIO_TASK_PROFILES[value].maxCredits} ${t('credits','crédits')} ($${(STUDIO_TASK_PROFILES[value].maxCredits/1000).toFixed(2)})`:t('Included Luna','Luna inclus')}</small></span></label>)}</div>
    <p>{t('Ceiling, not a fixed fee. Sol uses your free credits first. Media generation and analysis keep their own price confirmation.','Plafond, pas un forfait. Sol utilise vos crédits gratuits en premier. La génération et l’analyse de médias conservent leur propre confirmation de prix.')}</p>
    {profile==='complex'&&<label className={styles.confirm}><input type="checkbox" checked={confirmed} disabled={disabled||!sol} onChange={event=>onConfirmed(event.target.checked)}/>{t('I authorize up to 500 credits ($0.50) with Sol for this request.','J’autorise jusqu’à 500 crédits (0,50 $) avec Sol pour cette demande.')}</label>}
  </fieldset>;
}
