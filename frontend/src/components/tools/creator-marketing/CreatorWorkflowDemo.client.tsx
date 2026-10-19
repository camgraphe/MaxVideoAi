'use client';
import React, { useId, useState } from 'react';
import { ArrowRight, MoveHorizontal } from 'lucide-react';
import type { AppLocale } from '@/i18n/locales';
import type { CreatorToolId } from '@/lib/toolbox/creator-availability';
import type { CreatorMarketingLabels } from './creator-copy-types';
import { CreatorArtwork } from './CreatorArtwork';
import { getCreatorDetailCopy } from './creator-detail-copy';

/** Local presentation controls never upload, quote, or claim a generated result. */
export function CreatorWorkflowDemo({ id, labels, locale = 'en' }: { id: CreatorToolId; labels: CreatorMarketingLabels; locale?: AppLocale }) {
  const inputId = useId();
  const [caption, setCaption] = useState(labels.sample);
  const [style, setStyle] = useState(0);
  const [mode, setMode] = useState<'photo' | 'video'>('photo');
  const [compare, setCompare] = useState(50);
  const detail = getCreatorDetailCopy(locale);
  const words = caption.trim().split(/\s+/);
  const lastSpace = caption.lastIndexOf(' ');
  return <figure className="creator-demo" data-tool={id} aria-label={labels.demo}>
    {id === 'subtitles' ? <div className="creator-caption-demo">
      <div className="creator-caption-stage"><CreatorArtwork id={id} alt={detail.tools[id].artAlt}/><p data-caption-preview data-style={style}>{style === 1 && words.length > 1 ? <>{caption.slice(0, lastSpace + 1)}<mark>{caption.slice(lastSpace + 1)}</mark></> : caption || '…'}</p></div>
      <div className="creator-caption-controls"><label htmlFor={inputId}>{labels.caption}</label><input id={inputId} type="text" value={caption} maxLength={120} onChange={event => setCaption(event.target.value)}/>
        <fieldset><legend>{labels.style}</legend><div className="creator-demo-options">{labels.styles.map((value, index) => <button type="button" key={value} aria-pressed={style === index} onClick={() => setStyle(index)}>{value}</button>)}</div></fieldset>
      </div>
    </div> : id === 'lip-sync' ? <div className="creator-lipsync-demo">
      <div className="creator-face-source" data-source-mode={mode}><CreatorArtwork id={id} alt={detail.tools[id].artAlt}/></div>
      <div className="creator-mode-explanation"><div className="creator-demo-options" role="group" aria-label={`${labels.photo} / ${labels.video}`}>{(['photo', 'video'] as const).map(value => <button key={value} type="button" aria-pressed={mode === value} aria-controls={`${inputId}-mode`} onClick={() => setMode(value)}>{labels[value]}</button>)}</div><p id={`${inputId}-mode`} aria-live="polite">{mode === 'photo' ? detail.photoMode : detail.videoMode}</p><div className="creator-mode-flow"><span>{labels[mode]}</span><span aria-hidden="true">+</span><span>{labels.voice}</span><ArrowRight aria-hidden="true" size={17}/><span>{labels.video}</span></div></div>
    </div> : id === 'motion-transfer' ? <div className="creator-motion-demo"><CreatorArtwork id={id} alt={detail.tools[id].artAlt}/><div className="creator-motion-caption"><span>{labels.character}</span><span aria-hidden="true">+</span><span>{labels.performance}</span><ArrowRight aria-hidden="true" size={18}/><span>{labels.video}</span></div></div>
    : id === 'product-photo-editor' ? <div className="creator-scene-pair">
      <div><CreatorArtwork id="product-photo-editor" alt={detail.tools['product-photo-editor'].artAlt} sizes="(max-width: 760px) 100vw, 28vw"/><strong>{detail.mineral}</strong></div>
      <div><CreatorArtwork id="product-video-editor" alt={detail.tools['product-video-editor'].artAlt} sizes="(max-width: 760px) 100vw, 28vw"/><strong>{detail.light}</strong></div>
    </div> : <div className="creator-product-demo">
      <div className="creator-product-comparison">
        <div className="creator-product-frame"><CreatorArtwork id="product-photo-editor" alt={detail.tools['product-photo-editor'].artAlt}/></div>
        <div className="creator-product-frame creator-product-changed" style={{ clipPath: `inset(0 0 0 ${compare}%)` }}><CreatorArtwork id="product-video-editor" alt={detail.tools['product-video-editor'].artAlt}/></div>
        <div className="creator-compare-line" style={{ left: `${compare}%` }} aria-hidden="true"><span><MoveHorizontal size={22}/></span></div>
      </div>
      <div className="creator-scene-labels"><span>{detail.mineral}</span><span>{detail.light}</span></div>
      <label className="creator-comparison-control">{labels.compare}<input aria-label={labels.compare} type="range" min="5" max="95" value={compare} onChange={event => setCompare(Number(event.target.value))}/></label>
    </div>}
    <figcaption>{id.includes('product') ? detail.comparisonNote : labels.illustration}</figcaption>
  </figure>;
}
