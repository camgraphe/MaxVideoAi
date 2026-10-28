'use client';

import Image from 'next/image';
import { useRef } from 'react';
import { PublicVideoPlayer } from '@/components/media/PublicVideoPlayer.client';
import type { VideoBackgroundMedia } from '../_lib/media';
import { useVideoBackgroundComparison, type ComparisonSound } from './useVideoBackgroundComparison';
import styles from '../video-background-changer.module.css';

const cls = (...names: string[]) => names.map(name => styles[name]).join(' ');
const stamp = (time: number) => `0:${String(Math.floor(time)).padStart(2, '0')}`;

export function VideoBackgroundComparison({ media }: { media: VideoBackgroundMedia }) {
  const pair = useVideoBackgroundComparison(media);
  const individuals = useRef<HTMLDetailsElement>(null);
  const pauseIndividuals = () => individuals.current?.querySelectorAll('video').forEach(node => node.pause());
  return <>
    <div ref={pair.containerRef} className={styles['comparison-shell']}>
      <div className={styles['video-pair']}>
        {([['source', 'Original', 'Generated source · 1080p', 'Original six-second generated source video'], ['result', 'New setting', 'Wan 3 Prime · 720p', 'Wan 3 Prime cockpit edit of the source video']] as const).map(([key, label, detail, title], index) => {
          const owner = pair[key], clip = media[key];
          return <figure key={key}>
            <figcaption><span><i className={styles[`${key}-dot`]} />{label}</span><span>{detail}</span></figcaption>
            <div className={styles['video-frame']}>
              <video ref={owner.videoRef} src={clip.src} preload="none" playsInline muted aria-label={title} {...owner.events} />
              {!pair.frames[index] ? <Image src={clip.poster} alt={title} fill sizes="(max-width: 760px) 100vw, 50vw" priority={index === 0} className={styles['comparison-poster']} /> : null}
            </div>
          </figure>;
        })}
      </div>
      <div className={styles.transport} role="group" aria-label="Compare both videos">
        <button className={styles['play-button']} type="button" onClick={() => { pauseIndividuals(); pair.togglePlayback(); }}>
          <span aria-hidden="true">{pair.playing ? 'Ⅱ' : '▶'}</span><span>{pair.failed ? 'Retry both' : pair.playing ? 'Pause both' : 'Play both'}</span>
        </button>
        <div className={styles.timeline}><span>{stamp(pair.time)}</span><input type="range" min={0} max={pair.duration} step={0.01} value={pair.time} aria-label="Seek both videos" aria-valuetext={`${pair.time.toFixed(1)} seconds`} onChange={event => pair.seek(Number(event.target.value))} /><span>0:06</span></div>
        <fieldset className={styles['sound-choice']}><legend>Sound</legend><div>
          {([['off', 'Off'], ['source', 'Original'], ['result', 'Result']] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={pair.sound === value} onClick={() => pair.setSound(value as ComparisonSound)}>{label}</button>)}
        </div></fieldset>
      </div>
      <p className={styles['player-status']} role={pair.failed ? 'alert' : 'status'} aria-live="polite">{pair.failed ? 'A video could not play. Retry both clips or open each complete file below.' : pair.buffering ? 'Buffering. Both clips will resume together.' : 'Press Play both to compare the complete clips. Sound starts off.'}</p>
    </div>
    <div className={styles['proof-caption']}><p><strong>A different world, with details to review.</strong> The office becomes a spacecraft cockpit. The spoken sentence is retained in this example; gestures, expressions and the sound of the voice differ.</p><p>The source is a fictional, AI-generated performance. This is an accepted example, with different source and output resolutions, rather than a promise of identical faces, movement or audio.</p></div>
    <details ref={individuals} className={styles['clip-details']} id="individual-clips" onToggle={event => { if (!event.currentTarget.open) pauseIndividuals(); }} onPlayCapture={event => {
      pair.pause();
      individuals.current?.querySelectorAll('video').forEach(node => { if (node !== event.target) node.pause(); });
    }}>
      <summary>Watch each complete clip · spoken line</summary>
      <div className={styles['individual-grid']}>
        <figure><figcaption>Original · complete file</figcaption><div className={styles['individual-video']}><PublicVideoPlayer src={media.source.src} poster={media.source.poster} title="Watch complete original clip" deferPoster /></div><a href={media.source.src}>Open original file ↗</a></figure>
        <figure><figcaption>Cockpit · complete file</figcaption><div className={styles['individual-video']}><PublicVideoPlayer src={media.result.src} poster={media.result.poster} title="Watch complete cockpit clip" deferPoster /></div><a href={media.result.src}>Open cockpit file ↗</a></figure>
      </div>
      <p className={styles.transcript}><b>Spoken line, both clips:</b> “Here are three simple steps to make your next video look better.”</p><p className={styles['caption-note']}>Words are from the existing accepted review. Listen to each version to compare delivery.</p>
    </details>
    <a className={cls('text-link', 'walkthrough')} href="https://www.youtube.com/watch?v=qKrPvZj_dL0" target="_blank" rel="noopener"><span className={styles['youtube-icon']} aria-hidden="true">▶</span>Watch the full Wan 3 Prime walkthrough <span aria-hidden="true">↗</span></a>
  </>;
}
