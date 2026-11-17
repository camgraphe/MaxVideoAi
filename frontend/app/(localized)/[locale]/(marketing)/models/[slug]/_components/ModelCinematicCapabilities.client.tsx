'use client';

import Image from 'next/image';
import { ModelCinematicFilm } from './ModelCinematicFilm.client';
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { Film, Image as ImageIcon, Layers, SlidersHorizontal, Type } from 'lucide-react';
import type { CinematicCapabilities } from '../_lib/model-page-capabilities';
import { CinematicArrow, CinematicPlus } from './ModelCinematicMarks';
import type { CinematicPresentation } from '../_lib/model-page-cinematic-data';
import { ModelCinematicCapabilityProof } from './ModelCinematicCapabilityProof.client';
import { ModelCinematicKeyframeBoard } from './ModelCinematicKeyframeBoard.client';
import { ModelCinematicVideoPrompt } from './ModelCinematicVideoPrompt.client';

const icons = { create: Film, modify: SlidersHorizontal, extend: Film, text: Type, image: ImageIcon, endpoints: ImageIcon, keyframes: Layers };

/** All useful copy is server-rendered; tabs only select which workflow is visible. */
export function ModelCinematicCapabilities({ copy, ui }: { copy: CinematicCapabilities; ui?: CinematicPresentation['ui'] }) {
  const [selected, setSelected] = useState(copy.items[0].id);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => {
    function openLinkedTab() {
      const item = copy.items.find(mode => window.location.hash === `#capability-${mode.id}`);
      if (!item) return;
      setSelected(item.id);
      document.getElementById('capabilities')?.scrollIntoView({ block: 'start' });
    }
    openLinkedTab();
    window.addEventListener('hashchange', openLinkedTab);
    return () => window.removeEventListener('hashchange', openLinkedTab);
  }, [copy.items]);
  function selectTab(id: string) {
    setSelected(id);
    window.history.replaceState(window.history.state, '', `#capability-${id}`);
  }
  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const count = copy.items.length;
    const next = event.key === 'ArrowRight' ? (index + 1) % count : event.key === 'ArrowLeft' ? (index + count - 1) % count : event.key === 'Home' ? 0 : event.key === 'End' ? count - 1 : null;
    if (next === null) return;
    event.preventDefault(); selectTab(copy.items[next].id); tabs.current[next]?.focus();
  }
  return <section id="capabilities" className="cinema-capabilities" aria-labelledby="cinema-capabilities-title">
    <header><h3 id="cinema-capabilities-title">{copy.title}</h3><p>{copy.intro}</p></header>
    <div role="tablist" aria-label={copy.title} className="cinema-capability-tabs">{copy.items.map((item, index) => {
      const Icon = icons[item.id as keyof typeof icons] ?? Film;
      return <button key={item.id} id={`capability-tab-${item.id}`} ref={node => { tabs.current[index] = node; }} type="button" role="tab" aria-selected={selected === item.id}
        aria-controls={`capability-${item.id}`} tabIndex={selected === item.id ? 0 : -1} onClick={() => selectTab(item.id)} onKeyDown={event => navigate(event, index)}><Icon size={19} aria-hidden="true" />{item.label}</button>;
    })}</div>
    {copy.items.map(item => <div key={item.id} id={`capability-${item.id}`} role="tabpanel" aria-labelledby={`capability-tab-${item.id}`} hidden={selected !== item.id} tabIndex={0} className={`cinema-capability-panel${item.proof || item.visual ? ' cinema-capability-panel--visual' : ''}`}>
      <div className="cinema-capability-copy"><h4>{item.title}</h4><p>{item.body}</p>
        <div className="cinema-capability-actions">{item.actions.map((action, index) => <a key={action.href} href={action.href} className={index === 0 ? 'cinema-button' : 'cinema-source-link'}
          data-analytics-event="cta_click" data-analytics-cta-name="open_workspace" data-analytics-cta-location="model_capabilities" data-analytics-target-family="workspace">{action.label}<CinematicArrow /></a>)}</div>
        {item.proof && ui ? <ModelCinematicVideoPrompt title={item.title} prompt={item.proof.prompt} note={item.proof.note} imageDetailsLabel={ui.prompt} ui={ui} triggerLabel={ui.prompt} creation={item.proof.creation} /> : null}
        {item.videoRecipe && ui ? <ModelCinematicVideoPrompt title={item.videoRecipe.title}
          prompt={item.videoRecipe.prompt} note={item.videoRecipe.note} imageDetailsLabel={ui.prompt}
          ui={ui} triggerLabel={ui.prompt} creation={item.videoRecipe.creation} /> : null}
      </div>
      {item.proof ? <ModelCinematicCapabilityProof proof={item.proof} compare={ui?.compare ?? item.proof.labels.join(' / ')} /> : item.visual ? <figure className={`cinema-mode-visual cinema-mode-visual--${item.id}`}>
        {item.visual.storyboard && item.visual.seconds ? <ModelCinematicKeyframeBoard {...item.visual.storyboard} images={item.visual.images}
          seconds={item.visual.seconds} labels={item.visual.labels} /> : item.visual.resultLabel && item.visual.video && item.visual.poster && ui ? <div className="cinema-mode-comparison">
          <div className="cinema-mode-inputs">{item.visual.images.map((url, index) => <figure key={url}>
            <Image src={url} width={480} height={270} loading="lazy" sizes="(min-width: 768px) 130px, 25vw" alt={item.visual!.labels[index]} />
            <figcaption>{item.visual!.labels[index]}</figcaption>
          </figure>)}</div>
          <figure className="cinema-mode-output" style={{ '--film-aspect': `${item.visual.width} / ${item.visual.height}` } as CSSProperties}>
            <ModelCinematicFilm video={item.visual.video} poster={item.visual.poster} title={item.visual.resultLabel} ui={ui} mask="frame" />
            <figcaption>{item.visual.resultLabel}</figcaption>
          </figure>
        </div> : item.visual.video && ui ? <ModelCinematicFilm video={item.visual.video} poster={item.visual.images[0]} title={item.visual.labels[0]} ui={ui} mask="frame" />
          : <div className="cinema-mode-stills">{item.visual.images.map((url, index) => <figure key={url}>
            <Image src={url} width={840} height={462} loading="lazy" sizes="(min-width: 800px) 44vw, 88vw" alt={item.visual!.labels[index]} />
            <figcaption>{item.visual!.labels[index]}</figcaption>
          </figure>)}</div>}
        <figcaption>{item.visual.caption} {item.visual.storyboard ? <a className="cinema-source-link" href="#model-workflow">{item.visual.storyboard.workflowLink}<CinematicArrow direction="down" /></a> : null}</figcaption>
      </figure> : <div className="cinema-capability-guide"><p className="cinema-eyebrow">{copy.diagramLabel}</p>
        <ol className={`cinema-capability-stages cinema-capability-stages--${item.id}`}>{item.stages.map((stage, index) => <li key={stage}><span>{stage}</span>{index < 2 ? <CinematicArrow /> : null}</li>)}</ol>
        <ul className="cinema-capability-uses">{item.uses.map(use => <li key={use}>{use}</li>)}</ul><p className="cinema-capability-limit">{item.note}</p>
      </div>}
      {item.proof || item.visual ? <details className="cinema-capability-more"><summary>{item.proof?.detailsLabel ?? copy.diagramLabel}<CinematicPlus /></summary><div>
        <ul className="cinema-capability-uses">{item.uses.map(use => <li key={use}>{use}</li>)}</ul><p className="cinema-capability-limit">{item.note}</p>
      </div></details> : null}
    </div>)}
    <div className="cinema-capability-controls"><strong>{copy.controls.title}</strong><p>{copy.controls.body}</p></div>
    {copy.handoff ? <aside className="cinema-capability-handoff"><div><h4>{copy.handoff.title}</h4><p>{copy.handoff.body}</p></div><div>{copy.handoff.actions.map(action => <a key={action.href} href={action.href} className="cinema-source-link"
      data-analytics-event="cta_click" data-analytics-cta-name="open_workspace" data-analytics-cta-location="model_workflow_handoff" data-analytics-target-family="workspace">{action.label}<CinematicArrow /></a>)}</div></aside> : null}
  </section>;
}
