'use client';

import { useId, useState } from 'react';
import { Link } from '@/i18n/navigation';
import type { ModelCinematicContent } from '../_lib/model-page-cinematic-content';

export function ModelCinematicWorkflows({ content, workspaceHref }: { content: NonNullable<ModelCinematicContent['workflows']>; workspaceHref: string }) {
  const [selected, setSelected] = useState(0);
  const id = useId();
  return <section id="workflows" className="cinema-paths cinema-section"><div className="cinema-wrap">
    <header className="cinema-section-heading"><div><p className="cinema-eyebrow">{content.eyebrow}</p><h2>{content.title}</h2></div><p>{content.intro}</p></header>
    <div className="cinema-path-picker" role="group" aria-label={content.eyebrow}>{content.items.map((item, index) => <button key={item.id} type="button" aria-pressed={selected === index} aria-controls={`${id}-${index}`} onClick={() => setSelected(index)}><span>0{index + 1}</span>{item.title}<span aria-hidden="true">↗</span></button>)}</div>
    {content.items.map((active, index) => {
      const entry = new URL(workspaceHref, 'https://maxvideoai.com');
      entry.searchParams.set('mode', { create: 't2v', extend: 'extend', modify: 'v2v' }[active.id]);
      return <div key={active.id} id={`${id}-${index}`} hidden={selected !== index} className={`cinema-path-body cinema-path-body--${active.id}`}>
      <div className="cinema-path-diagram" aria-hidden="true"><div className="cinema-path-frame"><span>{active.input}</span><i /><i /><i /></div><span className="cinema-path-arrow">→</span><div className="cinema-path-frame cinema-path-result"><span>{active.output}</span><i /><i /><i /></div></div>
      <div><h3>{active.title}</h3><p>{active.body}</p><ol>{active.steps.map(step => <li key={step}>{step}</li>)}</ol><Link href={entry.pathname + entry.search} prefetch={false} className="cinema-source-link">{content.action} ↗</Link></div>
    </div>; })}<p className="cinema-panel-note">{content.note}</p>
  </div></section>;
}
