'use client';

import Image from 'next/image';
import { useId, useState, type PointerEvent } from 'react';
import { ArrowLeftRight, ArrowRight, RotateCcw } from 'lucide-react';
import type { CinematicCapabilities } from '../_lib/model-page-capabilities';

type Proof = NonNullable<CinematicCapabilities['items'][number]['proof']>;
type Picture = { url: string; width: number; height: number };

function Still({ image, alt, reference = false }: { image: Picture; alt: string; reference?: boolean }) {
  return <Image src={image.url} width={image.width} height={image.height} alt={alt} loading="lazy"
    sizes={reference ? '(min-width: 768px) 180px, 42vw' : '(min-width: 1600px) 800px, (min-width: 768px) 54vw, 90vw'} />;
}

/** Authored illustrations stay distinct from rendered model outputs and video schema.
 * Both comparison layers retain the same geometry; only the result's reveal is clipped.
 */
export function ModelCinematicCapabilityReveal({ before, after, labels, compare }: {
  before: Picture;
  after: Picture;
  labels: readonly [string, string];
  compare: string;
}) {
  const id = useId();
  const [reveal, setReveal] = useState(50);
  function move(event: PointerEvent<HTMLInputElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    setReveal(Math.round(Math.max(0, Math.min(100, (event.clientX - rect.left) / rect.width * 100))));
  }
  return <div className="cinema-capability-reveal">
      <div className="cinema-capability-reveal-layer"><Still image={before} alt={labels[0]} /></div>
      <div className="cinema-capability-reveal-layer" style={{ clipPath: `inset(0 0 0 ${reveal}%)` }}><Still image={after} alt={labels[1]} /></div>
      <span className="cinema-compare-tag cinema-compare-tag--before">{labels[0]}</span><span className="cinema-compare-tag cinema-compare-tag--after">{labels[1]}</span>
      <span className="cinema-compare-divider" style={{ left: `${reveal}%` }} aria-hidden="true"><span><ArrowLeftRight size={20} strokeWidth={1.5} /></span></span>
      <label className="sr-only" htmlFor={id}>{compare}</label>
      <input id={id} className="cinema-compare-input" type="range" min={0} max={100} value={reveal} aria-valuetext={`${reveal}%`}
        onChange={event => setReveal(Number(event.target.value))}
        onPointerDown={event => { event.preventDefault(); event.currentTarget.focus({ preventScroll: true }); event.currentTarget.setPointerCapture(event.pointerId); move(event); }}
        onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) move(event); }}
        onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }} />
    </div>;
}

export function ModelCinematicCapabilityProof({ proof, compare }: { proof: Proof; compare: string }) {
  const id = useId();
  const [extended, setExtended] = useState(true);
  const { images, labels } = proof;
  return <figure className={`cinema-capability-proof cinema-capability-proof--${proof.kind}`} data-media-kind="illustration">
    {proof.kind === 'create' ? <div className="cinema-capability-reference-scene">
      <div className="cinema-capability-references">{[images.character, images.setting].map((image, index) => <figure key={image.url}>
        <div><Still image={image} alt={labels[index]} reference /></div><figcaption>{labels[index]}</figcaption>
      </figure>)}</div>
      <div className="cinema-capability-result"><Still image={images.create} alt={proof.caption} /></div>
    </div> : proof.kind === 'modify' ? <ModelCinematicCapabilityReveal compare={compare} labels={labels}
      before={images.modifySource} after={images.modifyResult} /> : <div className="cinema-capability-extension" data-extended={extended}>
      <div className="cinema-capability-extension-preview"><Still image={extended ? images.extendResult : images.extendSource} alt={extended ? labels[1] : labels[0]} /></div>
      <div className="cinema-capability-filmstrip" aria-label={`${labels[0]} — ${labels[1]}`}>
        <div className="cinema-capability-filmstrip-source"><span>{labels[0]}</span><div>{[0, 1, 2].map(index => <Still key={index} image={images.extendSource} alt="" reference />)}</div></div>
        <div id={`${id}-continuation`} className="cinema-capability-filmstrip-added" aria-hidden={!extended}><span>{labels[1]}</span><div>{[0, 1, 2].map(index => <Still key={index} image={images.extendResult} alt="" reference />)}</div></div>
        <button type="button" onClick={() => setExtended(value => !value)} aria-expanded={extended} aria-controls={`${id}-continuation`} aria-label={extended ? proof.resetLabel : proof.previewLabel} title={extended ? proof.resetLabel : proof.previewLabel}>
          {extended ? <RotateCcw size={17} aria-hidden="true" /> : <ArrowRight size={19} aria-hidden="true" />}
        </button>
      </div>
    </div>}
    <figcaption>{proof.caption}</figcaption>
  </figure>;
}
