'use client';
import { useState } from 'react';
import Image from 'next/image';
export function CharacterReferenceShowcase({ sheet, portrait, note, views }: {sheet:string;portrait:string;note:string;views:string}) {
  const [mode,setMode]=useState<'sheet'|'portrait'>('sheet');
  return <figure className="character-reference-showcase"><div className="character-reference-stage"><Image src={`/assets/tools/redesign/character-${mode}-v1.webp`} alt={mode==='sheet'?`${sheet} — ${views}`:portrait} fill priority={mode==='sheet'} fetchPriority={mode==='sheet' ? 'high' : 'auto'} sizes="(max-width: 900px) 100vw, 56vw" className="object-contain" /></div><div className="character-reference-controls"><button type="button" aria-pressed={mode==='sheet'} onClick={()=>setMode('sheet')}>{sheet}</button><button type="button" aria-pressed={mode==='portrait'} onClick={()=>setMode('portrait')}>{portrait}</button></div><figcaption><span>{mode==='sheet'?views:portrait}</span><small>{note}</small></figcaption></figure>;
}
