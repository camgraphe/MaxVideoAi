import React from 'react';
import type { CreatorToolId } from '@/lib/toolbox/creator-availability';

/** Deliberately schematic: these drawings are not provider outputs or quality evidence. */
export function CharacterDrawing({ pose = 0, portrait = false }: { pose?: number; portrait?: boolean }) {
  return <svg viewBox={portrait ? '42 0 116 154' : '0 0 200 260'} fill="none" aria-hidden="true" className="creator-character-drawing">
    <circle cx="100" cy="53" r="29" fill="currentColor" opacity=".15" />
    <path d="M73 49c0-32 54-37 55 2M85 58h4m22 0h4m-22 18q8 5 16 0" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    <path d="M78 91Q100 84 122 91L132 158H67Z" fill="currentColor" opacity=".55" />
    <path d={pose === 1 ? 'M80 100L48 123L28 90M120 100l30-27 20 14' : pose === 2 ? 'M80 100L45 77L24 98M120 100l32 32 25-25' : 'M80 100L57 147M120 100l26 47'} stroke="currentColor" strokeWidth="12" strokeLinecap="round" />
    <path d={pose === 2 ? 'M83 161l-6 41-29 32M116 161l19 36-5 39' : 'M83 161l-8 75M116 161l11 75'} stroke="currentColor" strokeWidth="16" strokeLinecap="round" />
  </svg>;
}
export function ProductDrawing() {
  return <svg viewBox="0 0 220 250" fill="none" aria-hidden="true" className="creator-product-drawing">
    <ellipse cx="110" cy="224" rx="72" ry="12" fill="currentColor" opacity=".1" />
    <rect x="81" y="28" width="58" height="22" rx="5" fill="currentColor" opacity=".65" />
    <path d="M82 51h56l22 25v133q0 12-12 12H72q-12 0-12-12V76Z" fill="currentColor" opacity=".25" stroke="currentColor" strokeWidth="2" />
    <rect x="72" y="113" width="76" height="63" rx="3" fill="var(--creator-paper)" />
    <path d="M87 132h46m-46 10h32m-32 15h46" stroke="currentColor" strokeWidth="3" opacity=".6" />
    <path d="M73 85v19m0 83v16" stroke="white" strokeWidth="3" strokeLinecap="round" />
  </svg>;
}
export function VoiceDrawing() {
  return <svg viewBox="0 0 240 50" fill="none" aria-hidden="true" className="creator-voice-drawing">
    {[7,13,8,20,14,9,18,23,13,7,15,20,12,18,7,10,16,23,15,8,17,12,6].map((height, i) => <path key={i} d={`M${10 + i * 10} ${25 - height}v${height * 2}`} stroke="currentColor" strokeWidth="4" strokeLinecap="round" />)}
  </svg>;
}
export function CreatorToolMark({ id }: { id: CreatorToolId }) {
  const product = id.includes('product');
  return <div className="creator-tool-mark" style={{ width: '100%', height: '100%', minHeight: 160, background: '#e6e4d8', color: '#5d7354' }} aria-hidden="true">
    <svg viewBox="0 0 260 180" width="100%" height="100%" fill="none">
      {id === 'subtitles' ? <><rect x="70" y="35" width="120" height="90" rx="9" fill="currentColor" opacity=".12"/><path d="m100 100 17-40 17 40m-28-12h23m17-3c-11-20-22 19 1 13v-20" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/><path d="M78 142h104m-89 10h74" stroke="currentColor" strokeWidth="4"/></> : product ? <><rect x="108" y="26" width="44" height="16" rx="4" fill="currentColor"/><path d="M108 44h44l17 22v83H91V66Z" fill="currentColor" opacity=".25" stroke="currentColor" strokeWidth="2"/><path d="M105 93h50m-50 12h30m-30 12h50" stroke="currentColor" strokeWidth="3"/>{id === 'product-video-editor' ? <path d="M42 34v118m176-118v118M33 52h18m-18 35h18m-18 35h18m158-70h18m-18 35h18m-18 35h18" stroke="currentColor" strokeWidth="3" opacity=".4"/> : <circle cx="202" cy="46" r="18" stroke="currentColor" strokeWidth="2" opacity=".4"/>}</> : <><circle cx="125" cy="54" r="22" fill="currentColor" opacity=".3"/><path d="M110 83h30l12 56H98Z" fill="currentColor" opacity=".55"/>{id === 'motion-transfer' ? <path d="m108 92-29 15-16-29m78 14 25-25 16 8m-67 64-6 27m25-27 16 24" stroke="currentColor" strokeWidth="9" strokeLinecap="round"/> : <><path d="M109 94 91 135m50-41 17 41" stroke="currentColor" strokeWidth="9" strokeLinecap="round"/><path d="M183 89v12m8-24v36m8-43v50m8-38v26m8-18v10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></>}</>}
    </svg>
  </div>;
}
