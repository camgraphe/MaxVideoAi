'use client';

import { useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { GripVertical, ZoomIn, ZoomOut } from 'lucide-react';
import type { VideoExcerptRange } from '@/lib/video-excerpt';
import type { videoExcerptCopy } from '@/lib/video-excerpt-copy';

export function excerptTime(seconds: number) {
  const centiseconds = Math.round(Math.max(0, Number.isFinite(seconds) ? seconds : 0) * 100);
  return `${Math.floor(centiseconds / 6000).toString().padStart(2, '0')}:${((centiseconds % 6000) / 100).toFixed(2).padStart(5, '0')}`;
}
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const pointerTime = (value: number) => Number(value.toFixed(2));

type Props = {
  durationSec: number;
  range: VideoExcerptRange;
  currentTime: number;
  disabled: boolean;
  copy: ReturnType<typeof videoExcerptCopy>;
  frames: string[];
  onRangeChange: (range: VideoExcerptRange, seekTo: number) => void;
  onSeek: (seconds: number) => void;
};

/** All pointer operations share one time axis. Zoom changes only that axis. */
export function VideoExcerptTimeline({ durationSec, range, currentTime, disabled, copy, frames, onRangeChange, onSeek }: Props) {
  const track = useRef<HTMLDivElement>(null);
  const drag = useRef<{ kind: 'start' | 'end' | 'move' | 'seek'; x: number; range: VideoExcerptRange; pointerId: number } | null>(null);
  const [viewport, setViewport] = useState<VideoExcerptRange | null>(null);
  const instructions = useId();
  const duration = Number.isFinite(durationSec) && durationSec > 0 ? durationSec : 1;
  const finite = Number.isFinite(range.startSec) && Number.isFinite(range.endSec) && range.startSec >= 0 && range.endSec <= duration && range.endSec > range.startSec;
  const selected = finite ? range : { startSec: 0, endSec: duration };
  const view = viewport ?? { startSec: 0, endSec: duration };
  const span = view.endSec - view.startSec;
  const percent = (time: number) => clamp((time - view.startSec) / span * 100, 0, 100);
  const minimum = Math.min(.01, duration / 100);
  const update = (kind: 'start' | 'end' | 'move', value: number, base = selected) => {
    if (disabled) return;
    let next: VideoExcerptRange;
    if (kind === 'move') {
      const length = base.endSec - base.startSec;
      // Quantize movement, never the typed offset or interval width.
      const delta = pointerTime(value - base.startSec);
      const startSec = value <= 0 ? 0 : value >= duration - length ? duration - length : clamp(base.startSec + delta, 0, duration - length);
      next = { startSec, endSec: startSec === duration - length ? durationSec : startSec + length };
    } else if (kind === 'start') {
      next = { ...base, startSec: clamp(pointerTime(value), 0, base.endSec - minimum) };
    } else {
      const endSec = value >= duration ? duration : clamp(pointerTime(value), base.startSec + minimum, duration);
      next = { ...base, endSec: endSec === duration ? durationSec : endSec };
    }
    onRangeChange(next, kind === 'end' ? next.endSec : next.startSec);
  };
  const timeAt = (x: number) => {
    const box = track.current?.getBoundingClientRect();
    return box?.width ? clamp(view.startSec + (x - box.left) / box.width * span, view.startSec, view.endSec) : 0;
  };
  const pointerDown = (kind: 'start' | 'end' | 'move' | 'seek', event: PointerEvent<HTMLElement>) => {
    if (disabled || event.button > 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    drag.current = { kind, x: event.clientX, range: selected, pointerId: event.pointerId };
    if (kind === 'seek') onSeek(timeAt(event.clientX));
  };
  const pointerMove = (event: PointerEvent<HTMLElement>) => {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId || disabled) return;
    if (active.kind === 'seek') onSeek(timeAt(event.clientX));
    else if (active.kind === 'move') update('move', active.range.startSec + timeAt(event.clientX) - timeAt(active.x), active.range);
    else update(active.kind, timeAt(event.clientX), active.range);
  };
  const endDrag = () => { drag.current = null; };
  const events = (kind: 'start' | 'end' | 'move' | 'seek') => ({
    onPointerDown: (event: PointerEvent<HTMLElement>) => pointerDown(kind, event),
    onPointerMove: pointerMove, onPointerUp: endDrag, onPointerCancel: endDrag, onLostPointerCapture: endDrag,
  });
  const keyDown = (kind: 'start' | 'end' | 'move' | 'seek', event: KeyboardEvent<HTMLElement>) => {
    if (disabled || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const delta = (event.shiftKey ? 1 : .1) * (['ArrowLeft', 'ArrowDown'].includes(event.key) ? -1 : 1);
    if (kind === 'seek') onSeek(event.key === 'Home' ? view.startSec : event.key === 'End' ? view.endSec : clamp(currentTime + delta, view.startSec, view.endSec));
    else {
      const current = kind === 'end' ? selected.endSec : selected.startSec;
      const boundary = kind === 'start' ? selected.endSec - minimum : kind === 'move' ? duration - (selected.endSec - selected.startSec) : duration;
      update(kind, event.key === 'Home' ? kind === 'end' ? selected.startSec + minimum : 0 : event.key === 'End' ? boundary : current + delta);
    }
  };
  const zoom = () => {
    if (viewport) { setViewport(null); return; }
    const padding = Math.max(1, (selected.endSec - selected.startSec) * .2);
    setViewport({ startSec: Math.max(0, selected.startSec - padding), endSec: Math.min(duration, selected.endSec + padding) });
  };
  return <section className="video-excerpt-timeline" aria-label={copy.timeline}>
    <div className="video-excerpt-timeline-toolbar">
      <span>{copy.timeline}</span>
      <button type="button" aria-label={viewport ? copy.fullView : copy.zoom} aria-pressed={Boolean(viewport)} disabled={disabled || !finite} onClick={zoom}>{viewport ? <ZoomOut size={14} aria-hidden="true"/> : <ZoomIn size={14} aria-hidden="true"/>}{viewport ? copy.fullView : copy.zoom}</button>
    </div>
    <p id={instructions} className="sr-only">{copy.timelineHelp}</p>
    <div className="video-excerpt-track" ref={track}>
      <div className="video-excerpt-seek" role="slider" tabIndex={disabled ? -1 : 0} aria-label={copy.seek} aria-disabled={disabled} aria-valuemin={view.startSec} aria-valuemax={view.endSec} aria-valuenow={clamp(currentTime, view.startSec, view.endSec)} aria-valuetext={excerptTime(currentTime)} aria-describedby={instructions} {...events('seek')} onKeyDown={event => keyDown('seek', event)}>
        {[0, .25, .5, .75, 1].map((fraction) => <span key={fraction} style={{left: `${fraction * 100}%`}}>{excerptTime(view.startSec + fraction * span)}</span>)}
      </div>
      <div className="video-excerpt-frames" aria-hidden="true">
        {/* Frames are bounded local data URLs; never send them through the public image optimizer. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {frames.map((frame, index) => <img key={index} src={frame} alt="" draggable={false} style={{left:`${((index / frames.length * duration - view.startSec) / span) * 100}%`,width:`${duration / frames.length / span * 100}%`}} />)}
      </div>
      <div className="video-excerpt-excluded video-excerpt-excluded-start" style={{width:`${percent(selected.startSec)}%`}} aria-hidden="true" />
      <div className="video-excerpt-excluded video-excerpt-excluded-end" style={{left:`${percent(selected.endSec)}%`}} aria-hidden="true" />
      <div className="video-excerpt-selection" role="button" tabIndex={disabled ? -1 : 0} aria-label={copy.move} aria-disabled={disabled} aria-describedby={instructions} style={{left:`${percent(selected.startSec)}%`,width:`${Math.max(0,percent(selected.endSec)-percent(selected.startSec))}%`}} {...events('move')} onKeyDown={event=>keyDown('move',event)}>
        <span aria-hidden="true">{excerptTime(selected.endSec-selected.startSec)}</span>
      </div>
      {(['start', 'end'] as const).map(kind => <div key={kind} role="slider" tabIndex={disabled ? -1 : 0} className={`video-excerpt-handle video-excerpt-handle-${kind}`} aria-label={`${copy[kind]} · slider`} aria-disabled={disabled} aria-valuemin={kind === 'start' ? 0 : selected.startSec + minimum} aria-valuemax={kind === 'end' ? durationSec : selected.endSec - minimum} aria-valuenow={kind === 'start' ? selected.startSec : selected.endSec} aria-valuetext={excerptTime(kind === 'start' ? selected.startSec : selected.endSec)} aria-describedby={instructions} style={{left:`${percent(kind === 'start' ? selected.startSec : selected.endSec)}%`}} {...events(kind)} onKeyDown={event=>keyDown(kind,event)}><span><GripVertical size={14} aria-hidden="true" /></span></div>)}
      <div className="video-excerpt-playhead" aria-hidden="true" style={{left:`${percent(currentTime)}%`}} />
    </div>
    <div className="video-excerpt-timeline-footer"><span>{copy.dragHint}</span><button type="button" disabled={disabled} onClick={()=>{setViewport(null);onRangeChange({startSec:0,endSec:durationSec},0);}}>{copy.whole}</button></div>
  </section>;
}
