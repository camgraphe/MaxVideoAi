'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { CinematicAsset, CinematicPresentation } from '../_lib/model-page-cinematic-data';

/** The template's always-visible detail is a crop of the same reviewed display, not another render. */
export function ModelCinematicDetailCrop({ asset, ui }: { asset: CinematicAsset; ui: CinematicPresentation['ui'] }) {
  const [detail, setDetail] = useState<'face' | 'texture'>('face');
  return <figure className="cinema-detail-proof">
    <div className="cinema-detail-crop" data-detail={detail}>
      <Image src={asset.display.url} width={asset.display.width} height={asset.display.height}
        alt={`${ui[detail]} — ${asset.title}`} sizes="(min-width: 1440px) 1240px, (min-width: 768px) 90vw, 180vw" loading="lazy"
        style={{ objectPosition: `50% ${detail === 'face' ? 30 : 90}%` }} />
      <span aria-hidden="true">2×</span>
    </div>
    <figcaption><span>{ui.detailSource}</span><span>{ui.unretouched}</span></figcaption>
    <div className="cinema-detail-controls" role="group" aria-label={ui.zoom}>
      {(['face', 'texture'] as const).map(value => <button key={value} type="button" aria-pressed={detail === value} onClick={() => setDetail(value)}>{ui[value]}</button>)}
    </div>
  </figure>;
}

/** Inspect the original only on demand; the initial page keeps its lazy display image. */
export function ModelCinematicZoom({ asset, ui }: { asset: CinematicAsset; ui: CinematicPresentation['ui'] }) {
  const [zoomed, setZoomed] = useState(false);
  const [point, setPoint] = useState({ x: 50, y: 35 });
  return <div className="cinema-detail-view">
    <button type="button" className="cinema-detail-image" aria-label={`${ui.zoom} — ${asset.title}`} aria-pressed={zoomed}
      onClick={() => setZoomed(value => !value)}
      onPointerMove={event => {
        if (!zoomed || event.pointerType === 'touch') return;
        const rect = event.currentTarget.getBoundingClientRect();
        setPoint({ x: Math.max(0, Math.min(100, (event.clientX - rect.left) / rect.width * 100)), y: Math.max(0, Math.min(100, (event.clientY - rect.top) / rect.height * 100)) });
      }}
      onKeyDown={event => {
        if (event.key === 'Escape') { setZoomed(false); return; }
        if (!zoomed || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
        event.preventDefault();
        setPoint(previous => ({
          x: Math.max(0, Math.min(100, previous.x + (event.key === 'ArrowRight' ? 10 : event.key === 'ArrowLeft' ? -10 : 0))),
          y: Math.max(0, Math.min(100, previous.y + (event.key === 'ArrowDown' ? 10 : event.key === 'ArrowUp' ? -10 : 0))),
        }));
      }}>
      <Image src={asset.display.url} width={asset.display.width} height={asset.display.height} alt={asset.title}
        sizes="(min-width: 768px) 42vw, 90vw" loading="lazy" />
      {zoomed ? <Image className="cinema-detail-original" src={asset.original.url} width={asset.original.width} height={asset.original.height}
        alt="" aria-hidden="true" unoptimized style={{ transform: 'scale(2)', transformOrigin: `${point.x}% ${point.y}%` }} /> : null}
      <span className="cinema-detail-badge" aria-hidden="true">{zoomed ? '−  2×' : '+  2×'} · {zoomed ? ui.zoomOut : ui.zoom}</span>
    </button>
    {zoomed ? <div className="cinema-detail-controls" role="group" aria-label={ui.zoom}>
      <button type="button" onClick={() => setPoint({ x: 50, y: 25 })}>{ui.face}</button>
      <button type="button" onClick={() => setPoint({ x: 50, y: 80 })}>{ui.texture}</button>
      <button type="button" onClick={() => setZoomed(false)}>{ui.zoomOut}</button>
    </div> : null}
    <a className="cinema-detail-original-link" href={asset.original.url} target="_blank" rel="noopener noreferrer">{ui.original} ↗</a>
  </div>;
}
