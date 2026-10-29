'use client';
import { useId, useState } from 'react';
import Image from 'next/image';
import { ArrowRight, Check, Sparkles } from 'lucide-react';
import type { MiloCopy } from '../_lib/milo-copy';
import styles from './milo-marketing.module.css';

/** An authored teaching example, never a simulated provider request or generated result. */
export function MiloWalkthrough({ copy }: { copy: MiloCopy }) {
  const [step, setStep] = useState(0);
  const id = useId();
  return <figure className={styles.walkthrough} id="walkthrough">
    <div className={styles.exampleHeader}><Sparkles size={17} aria-hidden /><strong>Milo</strong><span>{copy.example}</span></div>
    <div className={styles.exampleImage}>
      <Image src="/assets/studio/starters/product-ad.webp" alt={copy.referenceAlt} width={960} height={541} sizes="(max-width: 760px) 92vw, (max-width: 1200px) 52vw, 620px" priority />
      <span>{copy.reference}</span>
    </div>
    <div className={styles.stepNav} role="tablist" aria-label={copy.example}>
      {copy.steps.map((label,index)=><button key={label} id={`${id}-step-${index}`} type="button" role="tab" aria-selected={step===index} aria-controls={`${id}-content`} tabIndex={step===index?0:-1} onClick={()=>setStep(index)} onKeyDown={event=>{
        if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
        event.preventDefault();
        const next=event.key==='Home'?0:event.key==='End'?2:(step+(event.key==='ArrowRight'?1:2))%3;
        setStep(next);document.getElementById(`${id}-step-${next}`)?.focus();
      }}><span aria-hidden>{index<step?<Check size={12}/>:index+1}</span>{label}</button>)}
    </div>
    <div className={styles.exampleBody} id={`${id}-content`} role="tabpanel" aria-labelledby={`${id}-step-${step}`} tabIndex={0}>
      {step===0?<><p className={styles.userBubble}>{copy.idea}</p><p className={styles.reply}><Sparkles size={17} aria-hidden/>{copy.reply}</p></>:step===1?<><p className={styles.reply}><Sparkles size={17} aria-hidden/>{copy.reply}</p><p className={styles.userBubble}>{copy.refinement}</p></>:<div className={styles.promptExample}><span><Sparkles size={15} aria-hidden/>{copy.steps[2]}</span><p>{copy.prompt}</p></div>}
    </div>
    <div className={styles.exampleFooter}><figcaption>{copy.demoNote}</figcaption>{step<2?<button type="button" aria-label={copy.steps[step+1]} onClick={()=>setStep(step+1)}><ArrowRight size={20} aria-hidden/></button>:null}</div>
  </figure>;
}
