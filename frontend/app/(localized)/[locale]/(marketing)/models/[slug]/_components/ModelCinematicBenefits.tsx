import type { ModelCinematicContent } from '../_lib/model-page-cinematic-content';
import { CinematicBenefitMark } from './ModelCinematicMarks';

export function ModelCinematicBenefits({ overview }: { overview: NonNullable<ModelCinematicContent['overview']> }) {
  return <ul className="cinema-benefits">{overview.benefits.map((benefit, index) => {
    return <li key={benefit.panelId}><a href={`#proof-${benefit.panelId}`}>
      <span className="cinema-benefit-index"><CinematicBenefitMark index={index} /></span>
      <h3>{benefit.title}</h3><p>{benefit.body}</p>
    </a></li>;
  })}</ul>;
}
