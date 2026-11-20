import Image from 'next/image';
import type { ModelCinematicContent } from '../_lib/model-page-cinematic-content';
import type { CinematicShotStill } from '../_lib/model-page-cinematic-media';

type Workflow = NonNullable<ModelCinematicContent['workflows']>['items'][number];
type Breakdown = NonNullable<Workflow['shotBreakdown']>;

export function ModelCinematicShotBreakdown({ copy, frames }: {
  copy: Breakdown;
  frames: readonly CinematicShotStill[];
}) {
  return <section id="shot-breakdown" className="cinema-shot-breakdown" aria-labelledby="cinema-shot-breakdown-title">
    <h3 id="cinema-shot-breakdown-title">{copy.title}</h3>
    <p>{copy.caption}</p>
    <ol tabIndex={0} aria-labelledby="cinema-shot-breakdown-title">{copy.shots.map((shot, index) => {
      const frame = frames[index];
      return <li key={shot.id}><figure>
        <Image src={frame.url} width={frame.width} height={frame.height} alt=""
          sizes="(min-width: 1200px) 18vw, 176px" loading="lazy" />
        <figcaption><strong>{shot.title}</strong><span>{shot.detail}</span></figcaption>
      </figure></li>;
    })}</ol>
  </section>;
}
