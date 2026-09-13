'use client';
import { useId } from 'react';
import type { ToolboxVisualId } from './toolbox-copy';
import { isFinishingToolId } from '@/lib/toolbox/finishing';
import { FinishingScene } from './FinishingScene';

/** Authored explanatory art. No generated output or benchmark is depicted. */
export function ToolboxScene({ kind }: { kind: ToolboxVisualId }) {
  const uid = useId().replace(/:/g, '');
  if (isFinishingToolId(kind)) return <FinishingScene kind={kind} />;
  const ref = (name: string) => `url(#${uid}-${name})`;
  return <svg viewBox="0 0 600 340" fill="none" aria-hidden="true" focusable="false" style={{ width: '100%', height: '100%', display: 'block' }}>
    <defs>
      <linearGradient id={`${uid}-sky`} x1="300" y1="0" x2="300" y2="340" gradientUnits="userSpaceOnUse"><stop stopColor="#172c3b" /><stop offset="1" stopColor="#c89165" /></linearGradient>
      <linearGradient id={`${uid}-petal`} x1="-40" y1="-65" x2="40" y2="65" gradientUnits="userSpaceOnUse"><stop stopColor="#f9d3a5" /><stop offset=".5" stopColor="#de814a" /><stop offset="1" stopColor="#7a332a" /></linearGradient>
      <linearGradient id={`${uid}-paper`} x1="0" y1="0" x2="600" y2="340" gradientUnits="userSpaceOnUse"><stop stopColor="#ddd7c8" /><stop offset="1" stopColor="#a7ada1" /></linearGradient>
      <pattern id={`${uid}-check`} width="26" height="26" patternUnits="userSpaceOnUse"><rect width="26" height="26" fill="#e1e0d7" /><path d="M0 0h13v13H0zm13 13h13v13H13z" fill="#cecec3" /></pattern>
      <pattern id={`${uid}-grid`} width="30" height="30" patternUnits="userSpaceOnUse"><path d="M30 0H0v30" stroke="#fff" strokeOpacity=".07" /></pattern>
      <clipPath id={`${uid}-frame`}><rect x="62" y="46" width="476" height="244" rx="8" /></clipPath>
      <clipPath id={`${uid}-lens`}><circle cx="393" cy="153" r="94" /></clipPath>
      <g id={`${uid}-mountain`}>
        <rect width="600" height="340" fill={ref('sky')} />
        <circle cx="410" cy="87" r="32" fill="#f2d1a2" />
        <path d="M0 280 136 91l93 118L326 73l155 187 119-105v185H0z" fill="#b9b1a2" />
        <path d="m136 91 25 82-26-18-33 13zm190-18 37 128-39-41-51 32z" fill="#f0e7d2" />
        <path d="m136 91 93 118-22 31zm190-18 155 187-86 3-51-114z" fill="#726c67" />
        <path d="M0 264 92 224l84 48 83-63 124 61 103-27 114 34v63H0z" fill="#283f41" />
        <path d="M0 301q141-32 289 9t311-21v51H0z" fill="#182b30" />
        <path d="M249 340q66-25 47-34t43-32" stroke="#d9b894" strokeWidth="3" />
      </g>
      <g id={`${uid}-flower`}>
        <path d="M0 140q-23-67 0-154" stroke="#354d38" strokeWidth="7" />
        <path d="M-3 105q-71 2-64-52 45 4 64 52M-4 69q53-7 56-43-41 0-56 43" fill="#567052" />
        {[0, 60, 120, 180, 240, 300].map(rotation => <ellipse key={rotation} cx="0" cy="-42" rx="28" ry="58" fill={ref('petal')} transform={`rotate(${rotation})`} />)}
        <circle r="25" fill="#51392b" /><circle r="17" fill="#b48b4d" />
        {Array.from({ length: 12 }, (_, n) => <circle key={n} cx={Math.cos(n * .524) * 15} cy={Math.sin(n * .524) * 15} r="2" fill="#e3c57e" />)}
      </g>
    </defs>
    {kind === 'background-removal' ? <>
      <rect width="600" height="340" fill={ref('paper')} />
      <path d="M0 240Q150 170 250 240T600 220v120H0Z" fill="#718574" opacity=".4" />
      <ellipse cx="311" cy="303" rx="134" ry="16" fill="#182b30" opacity=".15" />
      <rect x="267" y="35" width="236" height="260" rx="9" fill={ref('check')} transform="rotate(7 385 165)" />
      <path d="M267 40v251" stroke="#f0c665" strokeWidth="2" strokeDasharray="5 6" />
      <use href={`#${uid}-flower`} transform="translate(312 139) rotate(-9)" />
      <path d="m431 82 9-21 9 21 21 9-21 9-9 21-9-21-21-9z" fill="#fff3d5" />
      <path d="m127 164 40-10-5 41-10-14-17 20-11-9 17-20z" fill="#f7f1e2" stroke="#415245" strokeWidth="2" />
    </> : kind === 'upscale-video' ? <>
      <rect width="600" height="340" fill="#1c292d" /><rect width="600" height="340" fill={ref('grid')} />
      {[0, 1, 2].map(n => <g key={n} transform={`translate(${34 + n * 133} ${97 - n * 19}) rotate(${n === 2 ? 4 : -5})`}>
        <rect x="-5" y="-18" width="257" height="200" rx="9" fill={n === 2 ? '#e7ddc4' : '#526265'} />
        <svg width="247" height="148" viewBox="0 0 600 340"><use href={`#${uid}-mountain`} /></svg>
        {[0, 1, 2, 3, 4, 5, 6, 7].map(h => <g key={h} fill="#1c292d"><rect x={8 + h * 30} y="-12" width="12" height="7" rx="2" /><rect x={8 + h * 30} y="160" width="12" height="7" rx="2" /></g>)}
      </g>)}
      <path d="M85 290h405m-12-8 12 8-12 8" stroke="#d5b46c" strokeWidth="2" /><circle cx="288" cy="290" r="5" fill="#d5b46c" />
    </> : kind === 'storyboard' ? <>
      <rect width="600" height="340" fill="#d6ccba" />
      {[0, 1, 2].map(n => <g key={n} transform={`translate(${32 + n * 187} ${58 + (n % 2) * 24}) rotate(${n - 1})`}>
        <rect width="164" height="208" rx="4" fill="#f6f0e4" />
        <svg x="10" y="12" width="144" height="142" viewBox={`${85 + n * 70} 45 ${430 - n * 115} ${350 - n * 70}`} preserveAspectRatio="xMidYMid slice"><use href={`#${uid}-mountain`} /><path d="M287 279v-42q0-22 20-22t20 22v42" fill="#121e21" /><circle cx="307" cy="199" r="14" fill="#121e21" /></svg>
        <path d="M12 171h58m-58 10h118m-118 9h86" stroke="#b0a693" strokeWidth="3" />
        <circle cx="137" cy="175" r="7" fill="#c3844d" />
      </g>)}
    </> : <>
      <rect width="600" height="340" fill="#253638" /><rect width="600" height="340" fill={ref('grid')} />
      <g clipPath={ref('frame')}><use href={`#${uid}-mountain`} /></g>
      <rect x="62" y="46" width="476" height="244" rx="8" stroke="#d4dbc9" strokeOpacity=".4" />
      <g clipPath={ref('lens')}><use href={`#${uid}-mountain`} transform="translate(-263 -97) scale(1.65)" /></g>
      <circle cx="393" cy="153" r="99" stroke="#142328" strokeWidth="12" /><circle cx="393" cy="153" r="95" stroke="#eed29a" strokeWidth="3" />
      <path d="m466 223 48 48" stroke="#142328" strokeWidth="18" strokeLinecap="round" /><path d="m467 222 44 44" stroke="#d5b46c" strokeWidth="7" strokeLinecap="round" />
      <path d="M80 77V63h14m-14 201v14h14m409-201V63h-14" stroke="#eed29a" strokeWidth="2" />
      <path d="M102 250h56m-56 8h34" stroke="#eed29a" strokeWidth="2" />
    </>}
  </svg>;
}
