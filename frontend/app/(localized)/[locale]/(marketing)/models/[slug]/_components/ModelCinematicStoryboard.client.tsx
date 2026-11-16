'use client';

import { useId, useState } from 'react';
import Image from 'next/image';
import { ArrowLeftRight, Film, Plus } from 'lucide-react';

type Board = { url: string; width: number; height: number };

/** Concept frames only. No synthetic playback or attribution to a video model. */
export function ModelCinematicStoryboard({ board, before, after, concept, compare, kind, timeline }: {
  board: Board; before: string; after: string; concept: string; compare: string; kind: 'modify' | 'extend';
  timeline?: { label: string; source: string; continuation: string; note: string };
}) {
  const [reveal, setReveal] = useState(50);
  const id = useId();
  function updatePosition(event: React.PointerEvent<HTMLInputElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    setReveal(Math.round(Math.max(0, Math.min(100, (event.clientX - rect.left) / rect.width * 100))));
  }
  return <figure className={`cinema-storyboard cinema-storyboard--${kind}`}>
    {kind === 'modify' ? <div className="cinema-storyboard-compare">
      <div className="cinema-storyboard-half"><Image src={board.url} width={board.width} height={board.height} alt={before} sizes="(min-width: 768px) 100vw, 180vw" loading="lazy" /></div>
      <div className="cinema-storyboard-reveal" style={{ clipPath: `inset(0 0 0 ${reveal}%)` }}><div className="cinema-storyboard-half cinema-storyboard-half--after"><Image src={board.url} width={board.width} height={board.height} alt={after} sizes="(min-width: 768px) 100vw, 180vw" loading="lazy" /></div></div>
      <span className="cinema-compare-tag cinema-compare-tag--before">{before}</span><span className="cinema-compare-tag cinema-compare-tag--after">{after}</span>
      <span className="cinema-compare-divider" style={{ left: `${reveal}%` }} aria-hidden="true"><span><ArrowLeftRight size={20} strokeWidth={1.5} /></span></span>
      <label className="cinema-compare-hint" htmlFor={id}>{compare}<ArrowLeftRight size={16} aria-hidden="true" /></label>
      <input id={id} className="cinema-compare-input" type="range" min={0} max={100} value={reveal} aria-valuetext={`${reveal}%`}
        onChange={event => setReveal(Number(event.target.value))}
        onPointerDown={event => { event.preventDefault(); event.currentTarget.focus({ preventScroll: true }); event.currentTarget.setPointerCapture(event.pointerId); updatePosition(event); }}
        onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) updatePosition(event); }}
        onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }} />
    </div> : <div className="cinema-storyboard-sequence">
      <Image src={board.url} width={board.width} height={board.height} alt={`${before} → ${after}`} sizes="(min-width: 768px) 60vw, 90vw" loading="lazy" />
      {timeline ? <div className="cinema-extend-timeline" aria-label={timeline.label}>
        <div className="cinema-timeline-ruler" aria-hidden="true"><span>00:00</span><span>00:06</span><span>00:10</span></div>
        <div className="cinema-timeline-track">
          <div className="cinema-timeline-source"><Film size={17} aria-hidden="true" /><span>{timeline.source}<small>6s</small></span></div>
          <div className="cinema-timeline-continuation"><Plus size={17} aria-hidden="true" /><span>{timeline.continuation}<small>+4s</small></span><i aria-hidden="true" /></div>
        </div>
      </div> : null}
    </div>}
    <figcaption>{kind === 'extend' && timeline ? timeline.note : concept}</figcaption>
  </figure>;
}
