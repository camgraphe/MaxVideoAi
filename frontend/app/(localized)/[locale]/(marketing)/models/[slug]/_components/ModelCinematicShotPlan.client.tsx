'use client';

import { useState } from 'react';
import type { CinematicPresentation } from '../_lib/model-page-cinematic-data';
import { ModelDecisionCopyButton } from './ModelDecisionCopyButton.client';

export function ModelCinematicShotPlan({ plan, ui }: { plan: { motion: string; sound: string }; ui: CinematicPresentation['ui'] }) {
  const [selected, setSelected] = useState<'frame' | 'motion' | 'sound'>('motion');
  const prompt = `${ui.animateFrame} ${plan.motion}\n${ui.sound}: ${plan.sound}`;
  return <div className="cinema-shot-director">
    <div className="cinema-shot-tabs" role="group" aria-label={ui.shotPlan}>{(['frame', 'motion', 'sound'] as const).map((key, index) => <button type="button" key={key} aria-pressed={selected === key} onClick={() => setSelected(key)}><span>0{index + 1}</span> {ui[key]}</button>)}</div>
    <p className="cinema-shot-direction">{selected === 'frame' ? ui.frameDirection : plan[selected]}</p>
    <details className="cinema-disclosure"><summary>{ui.videoPrompt}<span aria-hidden="true">+</span></summary><div><p>{prompt}</p><ModelDecisionCopyButton copyText={prompt} label={ui.copy} copiedLabel={ui.copied} /></div></details>
  </div>;
}
