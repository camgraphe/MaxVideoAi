'use client';

import { useRef, useState, type KeyboardEvent } from 'react';
import { Film, Image as ImageIcon, Layers, SlidersHorizontal, Type } from 'lucide-react';
import type { CinematicCapabilities } from '../_lib/model-page-capabilities';
import { CinematicArrow } from './ModelCinematicMarks';

const icons = { create: Film, modify: SlidersHorizontal, extend: Film, text: Type, image: ImageIcon, endpoints: ImageIcon, keyframes: Layers };

/** All useful copy is server-rendered; tabs only select which workflow is visible. */
export function ModelCinematicCapabilities({ copy }: { copy: CinematicCapabilities }) {
  const [selected, setSelected] = useState(copy.items[0].id);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const count = copy.items.length;
    const next = event.key === 'ArrowRight' ? (index + 1) % count : event.key === 'ArrowLeft' ? (index + count - 1) % count : event.key === 'Home' ? 0 : event.key === 'End' ? count - 1 : null;
    if (next === null) return;
    event.preventDefault(); setSelected(copy.items[next].id); tabs.current[next]?.focus();
  }
  return <section id="capabilities" className="cinema-capabilities" aria-labelledby="cinema-capabilities-title">
    <header><h3 id="cinema-capabilities-title">{copy.title}</h3><p>{copy.intro}</p></header>
    <div role="tablist" aria-label={copy.title} className="cinema-capability-tabs">{copy.items.map((item, index) => {
      const Icon = icons[item.id as keyof typeof icons] ?? Film;
      return <button key={item.id} id={`capability-tab-${item.id}`} ref={node => { tabs.current[index] = node; }} type="button" role="tab" aria-selected={selected === item.id}
        aria-controls={`capability-${item.id}`} tabIndex={selected === item.id ? 0 : -1} onClick={() => setSelected(item.id)} onKeyDown={event => navigate(event, index)}><Icon size={19} aria-hidden="true" />{item.label}</button>;
    })}</div>
    {copy.items.map(item => <div key={item.id} id={`capability-${item.id}`} role="tabpanel" aria-labelledby={`capability-tab-${item.id}`} hidden={selected !== item.id} tabIndex={0} className="cinema-capability-panel">
      <div className="cinema-capability-copy"><h4>{item.title}</h4><p>{item.body}</p>
        <div className="cinema-capability-actions">{item.actions.map((action, index) => <a key={action.href} href={action.href} className={index === 0 ? 'cinema-button' : 'cinema-source-link'}
          data-analytics-event="cta_click" data-analytics-cta-name="open_workspace" data-analytics-cta-location="model_capabilities" data-analytics-target-family="workspace">{action.label}<CinematicArrow /></a>)}</div>
      </div>
      <div className="cinema-capability-guide"><p className="cinema-eyebrow">{copy.diagramLabel}</p>
        <ol className={`cinema-capability-stages cinema-capability-stages--${item.id}`}>{item.stages.map((stage, index) => <li key={stage}><span>{stage}</span>{index < 2 ? <CinematicArrow /> : null}</li>)}</ol>
        <ul className="cinema-capability-uses">{item.uses.map(use => <li key={use}>{use}</li>)}</ul><p className="cinema-capability-limit">{item.note}</p>
      </div>
    </div>)}
    <div className="cinema-capability-controls"><strong>{copy.controls.title}</strong><p>{copy.controls.body}</p></div>
    {copy.handoff ? <aside className="cinema-capability-handoff"><div><h4>{copy.handoff.title}</h4><p>{copy.handoff.body}</p></div><div>{copy.handoff.actions.map(action => <a key={action.href} href={action.href} className="cinema-source-link"
      data-analytics-event="cta_click" data-analytics-cta-name="open_workspace" data-analytics-cta-location="model_workflow_handoff" data-analytics-target-family="workspace">{action.label}<CinematicArrow /></a>)}</div></aside> : null}
  </section>;
}
