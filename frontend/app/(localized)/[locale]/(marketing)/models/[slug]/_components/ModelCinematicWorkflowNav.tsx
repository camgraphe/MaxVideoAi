import { Clapperboard, SlidersHorizontal, MoveRight } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { ModelCinematicContent } from '../_lib/model-page-cinematic-content';
import { CinematicArrow } from './ModelCinematicMarks';

const icons = { create: Clapperboard, modify: SlidersHorizontal, extend: MoveRight };

export function ModelCinematicWorkflowNav({ workflows }: { workflows: NonNullable<ModelCinematicContent['workflows']> }) {
  return <ul className="cinema-workflow-nav" style={{ '--cinema-workflow-count': workflows.items.length } as CSSProperties}>{workflows.items.map(item => {
    const Icon = icons[item.id];
    return <li key={item.id}><a href={`#proof-${item.id}`}>
      <div><Icon size={24} strokeWidth={1.5} aria-hidden="true" /><h3>{item.title}</h3><CinematicArrow direction="down" /></div>
      <p>{item.body}</p>
    </a></li>;
  })}</ul>;
}
