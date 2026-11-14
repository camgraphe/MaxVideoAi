'use client';

import { useId, useState } from 'react';
import Image from 'next/image';
import { ModelCinematicPrompt } from './ModelCinematicAsset';
import type { CinematicAsset, CinematicPresentation } from '../_lib/model-page-cinematic-data';

export function ModelCinematicCompare({ assets, ui }: { assets: CinematicAsset[]; ui: CinematicPresentation['ui'] }) {
  const [step, setStep] = useState(1);
  const [reveal, setReveal] = useState(50);
  const sliderId = useId();
  const before = assets[Math.max(0, step - 1)];
  const after = assets[step];
  return <div className="cinema-comparison">
    <div className="cinema-segmented" role="group" aria-label={ui.compare}>
      {assets.map((asset, index) => <button key={asset.id} type="button" aria-pressed={step === index} onClick={() => setStep(index)}>{String(index + 1).padStart(2, '0')} / {asset.title}</button>)}
    </div>
    <div className="cinema-compare-images">
      <Image src={before.display.url} width={before.display.width} height={before.display.height} alt={before.title} sizes="(min-width: 1600px) 1432px, 91vw" loading="lazy" />
      {step > 0 ? <div className="cinema-compare-after" style={{ clipPath: `inset(0 0 0 ${100 - reveal}%)` }}>
        <Image src={after.display.url} width={after.display.width} height={after.display.height} alt={after.title} sizes="(min-width: 1600px) 1432px, 91vw" loading="lazy" />
      </div> : null}
      {step > 0 ? <span className="cinema-compare-divider" style={{ left: `${100 - reveal}%` }} aria-hidden="true"><span>↔</span></span> : null}
    </div>
    {step > 0 ? <div className="cinema-compare-controls"><label htmlFor={sliderId}>{ui.compare}</label><input id={sliderId} className="cinema-range" type="range" min="0" max="100" value={reveal} onChange={event => setReveal(Number(event.target.value))} /><span>{reveal}%</span></div> : null}
    <ModelCinematicPrompt key={after.id} asset={after} ui={ui} />
  </div>;
}

export function ModelCinematicCutout({ asset, ui }: { asset: CinematicAsset; ui: CinematicPresentation['ui'] }) {
  const [background, setBackground] = useState<'light' | 'dark'>('dark');
  return <div>
    <div className={`cinema-cutout cinema-cutout--${background}`}>
      <Image src={asset.display.url} width={asset.display.width} height={asset.display.height} alt={asset.title} sizes="(min-width: 768px) 55vw, 90vw" loading="lazy" />
    </div>
    <div className="cinema-segmented" role="group" aria-label={ui.background}>
      {(['dark', 'light'] as const).map(value => <button key={value} type="button" aria-pressed={background === value} onClick={() => setBackground(value)}>{ui[value]}</button>)}
    </div>
  </div>;
}
