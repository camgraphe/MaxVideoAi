'use client';
import React, { useId, useState } from 'react';
import type { CreatorToolId } from '@/lib/toolbox/creator-availability';
import type { CreatorMarketingLabels } from './creator-copy-types';
import { CharacterDrawing, ProductDrawing, VoiceDrawing } from './CreatorIllustrations';

export function CreatorWorkflowDemo({ id, labels }: { id: CreatorToolId; labels: CreatorMarketingLabels }) {
  const inputId = useId();
  const [caption, setCaption] = useState(labels.sample);
  const [style, setStyle] = useState(0);
  const [mode, setMode] = useState<'photo' | 'video'>('photo');
  const [scene, setScene] = useState(0);
  const [compare, setCompare] = useState(50);
  return <figure className="creator-demo" data-tool={id} aria-label={labels.demo}>
    <figcaption><span className="creator-demo-dot" aria-hidden="true" />{labels.illustration}</figcaption>
    {id === 'subtitles' ? <div className="creator-caption-demo">
      <div className="creator-demo-editor"><span className="creator-small-label">{labels.settings}</span><div className="creator-timecodes" aria-hidden="true"><span>00:01.20</span><span>00:03.80</span></div>
        <label htmlFor={inputId}>{labels.caption}</label><input id={inputId} type="text" value={caption} maxLength={120} onChange={event => setCaption(event.target.value)} />
        <fieldset><legend>{labels.style}</legend><div className="creator-demo-options">{labels.styles.map((value, index) => <button type="button" key={value} aria-pressed={style === index} onClick={() => setStyle(index)}>{value}</button>)}</div></fieldset>
        <div className="creator-caption-lines" aria-hidden="true"><i /><i /><i /></div>
      </div>
      <div className="creator-caption-stage"><span className="creator-stage-tag">{labels.after}</span><CharacterDrawing portrait /><p data-caption-preview data-style={style}>{caption || '…'}</p><div className="creator-caption-timeline" aria-hidden="true"><i /><i /><i /><i /></div></div>
    </div> : id === 'lip-sync' ? <div className="creator-lipsync-demo">
      <div className="creator-demo-options creator-mode-options" role="group" aria-label={`${labels.photo} / ${labels.video}`}>{(['photo','video'] as const).map(value => <button key={value} type="button" aria-pressed={mode === value} onClick={() => setMode(value)}>{labels[value]}</button>)}</div>
      <div className="creator-source-flow"><div className="creator-face-source" data-source-mode={mode}><span className="creator-small-label">{labels[mode]}</span><CharacterDrawing portrait />{mode === 'video' ? <div className="creator-frame-strip" aria-hidden="true"><i /><i /><i /><i /></div> : null}</div><span className="creator-flow-plus" aria-hidden="true">+</span><div className="creator-voice-source"><span className="creator-small-label">{labels.voice}</span><VoiceDrawing /><span className="creator-voice-line" aria-hidden="true" /></div><span className="creator-flow-arrow" aria-hidden="true">→</span><div className="creator-face-result"><span className="creator-small-label">{labels.after}</span><CharacterDrawing portrait /><VoiceDrawing /></div></div>
    </div> : id === 'motion-transfer' ? <div className="creator-motion-demo"><div className="creator-motion-inputs"><div><span className="creator-small-label">{labels.character}</span><CharacterDrawing /></div><span className="creator-flow-plus" aria-hidden="true">+</span><div><span className="creator-small-label">{labels.performance}</span><div className="creator-pose-strip"><CharacterDrawing pose={1}/><CharacterDrawing pose={2}/></div></div></div><span className="creator-flow-arrow" aria-hidden="true">→</span><div className="creator-motion-result"><span className="creator-small-label">{labels.after}</span><CharacterDrawing pose={1}/><div className="creator-motion-trail" aria-hidden="true"><CharacterDrawing pose={2}/></div></div></div>
    : <div className="creator-product-demo">
      {id === 'product-photo-editor' ? <div className="creator-demo-options" role="group" aria-label={labels.scene}>{labels.scenes.map((value,index) => <button type="button" key={value} aria-pressed={scene === index} onClick={() => setScene(index)}>{value}</button>)}</div> : null}
      <div className="creator-product-comparison" data-scene={scene}>
        <div className="creator-product-frame creator-product-original"><span className="creator-stage-tag">{labels.source}</span><ProductDrawing /></div>
        <div className="creator-product-frame creator-product-changed" style={id === 'product-video-editor' ? {clipPath:`inset(0 0 0 ${compare}%)`} : undefined}><span className="creator-stage-tag">{labels.after}</span><ProductDrawing /><div className="creator-set-prop" /></div>
        {id === 'product-video-editor' ? <div className="creator-compare-line" style={{left:`${compare}%`}} aria-hidden="true"><span>↔</span></div> : <span className="creator-product-divider" aria-hidden="true">→</span>}
      </div>
      {id === 'product-video-editor' ? <label className="creator-comparison-control">{labels.compare}<input aria-label={labels.compare} type="range" min="5" max="95" value={compare} onChange={event => setCompare(Number(event.target.value))} /></label> : null}
    </div>}
  </figure>;
}
