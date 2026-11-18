'use client';

import Image from 'next/image';
import { useId, useState } from 'react';

type Props = {
  images: string[];
  seconds: number[];
  labels: string[];
  title: string;
  frameLabel: string;
};

/** A selectable storyboard of source stills, separate from the rendered film and its player. */
export function ModelCinematicKeyframeBoard({ images, seconds, labels, title, frameLabel }: Props) {
  const [selected, setSelected] = useState(0);
  const previewId = useId();
  const position = (index: number) => `${seconds[index]} s · ${frameLabel} ${Math.round(seconds[index] * 24)}`;

  return <div className="cinema-keyframe-board">
    <div className="cinema-board-preview" id={previewId}>
      <Image src={images[selected]} alt={labels[selected]} width={1536} height={864}
        loading="lazy" sizes="(min-width: 1400px) 660px, (min-width: 800px) 48vw, 90vw" />
      <div className="cinema-board-legend">
        <span>{title}</span>
        <div><strong>{labels[selected]}</strong><small>{position(selected)}</small></div>
      </div>
    </div>
    <ol className="cinema-board-strip" aria-label={title}>
      {images.map((url, index) => <li key={url}>
        <button type="button" aria-controls={previewId} aria-pressed={selected === index}
          aria-label={`${labels[index]} · ${position(index)}`} onClick={() => setSelected(index)}>
          <Image src={url} alt="" aria-hidden="true" width={192} height={108} sizes="(min-width: 900px) 110px, 17vw" loading="lazy" />
          <span>{seconds[index]} s</span>
        </button>
      </li>)}
    </ol>
  </div>;
}
