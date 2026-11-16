import type { ModelCinematicContent } from '../_lib/model-page-cinematic-content';
import { CinematicArrow } from './ModelCinematicMarks';

/** Model-authored entry points; not a shared list of assumed capabilities. */
export function ModelCinematicHighlights({ items }: { items: NonNullable<ModelCinematicContent['highlights']> }) {
  return <ul className="cinema-workflow-nav cinema-highlights">{items.map(item => <li key={item.target}>
    <a href={`#${item.target}`}><div><h3>{item.title}</h3><CinematicArrow direction="down" /></div><p>{item.body}</p></a>
  </li>)}</ul>;
}
