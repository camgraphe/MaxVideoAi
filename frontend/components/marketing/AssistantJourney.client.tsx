'use client';

import { useId, useState } from 'react';

type JourneyStep = { title: string; heading: string; body: string; detail: string };
export function AssistantJourney({ label, steps }: { label: string; steps: JourneyStep[] }) {
  const [selected, setSelected] = useState(0);
  const panelId = useId();
  const step = steps[selected];
  return <div className="assistant-journey">
    <p className="assistant-journey-label">{label}</p>
    <div className="assistant-journey-buttons">{steps.map((item,index)=><button key={item.title} type="button" aria-pressed={selected===index} aria-controls={panelId} onClick={()=>setSelected(index)}><span aria-hidden>{String(index+1).padStart(2,'0')}</span>{item.title}</button>)}</div>
    <div id={panelId} className="assistant-journey-panel" aria-live="polite" aria-atomic="true">
      <span className="assistant-journey-number" aria-hidden>{String(selected+1).padStart(2,'0')}</span>
      <h3>{step.heading}</h3><p>{step.body}</p><div>{step.detail}</div>
    </div>
  </div>;
}
