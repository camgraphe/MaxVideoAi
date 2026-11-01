'use client';
import {cloneElement,useId,useState,type ReactElement} from 'react';
import styles from './generation-action-help.module.css';

/** Keeps a blocked action focusable for explanation; the owning handler still enforces its guard. */
export function GenerationActionHelp({hint,children}:{hint:string|null;children:ReactElement<{'aria-describedby'?:string}>}) {
  const id=useId();
  const [open,setOpen]=useState(false);
  if(!hint)return children;
  return <span className={styles.root} data-generation-help onMouseEnter={()=>setOpen(true)} onMouseLeave={()=>setOpen(false)}
    onFocusCapture={()=>setOpen(true)} onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node|null))setOpen(false);}}
    onPointerDown={event=>{if(event.pointerType!=='mouse')setOpen(true);}} onKeyDown={event=>{if(event.key==='Escape')setOpen(false);}}>
    {cloneElement(children,{'aria-describedby':[children.props['aria-describedby'],id].filter(Boolean).join(' ')})}
    <span id={id} role="tooltip" hidden={!open} className={styles.hint}>{hint}</span>
  </span>;
}
