'use client';

import { useId, useState } from 'react';
import Image from 'next/image';
import { ModelCinematicPrompt } from './ModelCinematicAsset';
import type { CinematicAsset, CinematicPresentation } from '../_lib/model-page-cinematic-data';

export function ModelCinematicCompare({ assets, ui, note }: { assets: CinematicAsset[]; ui: CinematicPresentation['ui']; note?: string }) {
  const [step, setStep] = useState(1);
  const [reveal, setReveal] = useState(50);
  const sliderId = useId();
  const before = assets[Math.max(0, step - 1)];
  const after = assets[step];
  return <div className="cinema-comparison">
    <div className="cinema-segmented" role="group" aria-label={ui.compare}>
      {assets.map((asset, index) => <button key={asset.id} type="button" aria-pressed={step === index} onClick={() => { setStep(index); setReveal(50); }}><Image src={asset.display.url} width={160} height={90} alt="" sizes="160px" loading="lazy" /><span>{String(index + 1).padStart(2, '0')} / {asset.title}</span></button>)}
    </div>
    <div className="cinema-compare-images">
      <Image src={before.display.url} width={before.display.width} height={before.display.height} alt={before.title} sizes="(min-width: 1600px) 1432px, 91vw" loading="lazy" />
      {step > 0 ? <div className="cinema-compare-after" style={{ clipPath: `inset(0 0 0 ${reveal}%)` }}>
        <Image src={after.display.url} width={after.display.width} height={after.display.height} alt={after.title} sizes="(min-width: 1600px) 1432px, 91vw" loading="lazy" />
      </div> : null}
      {step > 0 ? <>
        <span className="cinema-compare-tag cinema-compare-tag--before">{ui.before}</span><span className="cinema-compare-tag cinema-compare-tag--after">{ui.after}</span>
        <span className="cinema-compare-divider" style={{ left: `${reveal}%` }} aria-hidden="true"><span>↔</span></span>
        <label className="cinema-compare-hint" htmlFor={sliderId}>{ui.compare} ↔</label>
        <input id={sliderId} className="cinema-compare-input" type="range" min="0" max="100" value={reveal}
          onChange={event => setReveal(Number(event.target.value))}
          onPointerDown={event => {
            event.preventDefault();
            event.currentTarget.focus({ preventScroll: true });
            event.currentTarget.setPointerCapture(event.pointerId);
            const rect = event.currentTarget.getBoundingClientRect();
            setReveal(Math.round(Math.max(0, Math.min(100, (event.clientX - rect.left) / rect.width * 100))));
          }}
          onPointerMove={event => {
            if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
            const rect = event.currentTarget.getBoundingClientRect();
            setReveal(Math.round(Math.max(0, Math.min(100, (event.clientX - rect.left) / rect.width * 100))));
          }}
          onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }} />
      </> : null}
    </div>
    <ModelCinematicPrompt key={after.id} asset={after} ui={ui}>{note ? <p>{note}</p> : null}</ModelCinematicPrompt>
  </div>;
}

export function ModelCinematicCutout({ asset, ui }: { asset: CinematicAsset; ui: CinematicPresentation['ui'] }) {
  const [background, setBackground] = useState<'light' | 'dark' | 'gradient'>('dark');
  return <div>
    <div className={`cinema-cutout cinema-cutout--${background}`}>
      <Image src={asset.display.url} width={asset.display.width} height={asset.display.height} alt={asset.title} sizes="(min-width: 768px) 55vw, 90vw" loading="lazy" />
    </div>
    <div className="cinema-segmented" role="group" aria-label={ui.background}>
      {(['dark', 'light', 'gradient'] as const).map(value => <button key={value} type="button" aria-pressed={background === value} onClick={() => setBackground(value)}>{ui[value]}</button>)}
    </div>
  </div>;
}
