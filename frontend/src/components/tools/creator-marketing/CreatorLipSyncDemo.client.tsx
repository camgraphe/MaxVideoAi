'use client';
import { Download, Pause, Play } from 'lucide-react';
import { useRef, useState, type SyntheticEvent } from 'react';
import type { AppLocale } from '@/i18n/locales';
import { CreatorResultImage, type CreatorResultVideoMedia } from './CreatorResultMedia';
import { CreatorResultVideo } from './CreatorResultVideo.client';
import { creatorResultCopy } from './creator-result-copy';
import recorded from './lip-sync-demo.json';

/** Source voice and result are independently playable, without competing soundtracks. */
export function CreatorLipSyncDemo({ locale }: { locale: AppLocale }) {
  const copy = creatorResultCopy(locale);
  const result = recorded.result as CreatorResultVideoMedia | null;
  const duration = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(recorded.audio.duration);
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false), [position, setPosition] = useState(0);
  const [ready, setReady] = useState(false), [failed, setFailed] = useState(false);
  const toggleVoice = () => {
    const node = audio.current;
    if (!node) return;
    if (!node.paused) node.pause();
    else { setFailed(false); void node.play().catch(() => setFailed(true)); }
  };
  const playOne = (event: SyntheticEvent<HTMLDivElement>) => {
    const current = event.target;
    event.currentTarget.querySelectorAll<HTMLMediaElement>('audio,video').forEach(media => {
      if (media !== current) media.pause();
    });
  };
  return <div className="creator-lip-result" onPlayCapture={playOne}>
    <header className="creator-result-heading"><h3>{copy.lip.title}</h3><p>{copy.lip.intro}</p></header>
    <div className="creator-lip-inputs">
      <figure><CreatorResultImage media={recorded.portrait} alt={copy.lip.portrait} sizes="(max-width: 760px) 100vw, 24vw" /><figcaption>01 / {copy.lip.portrait}</figcaption></figure>
      <div className="creator-lip-voice">
        <div className="creator-lip-voice-label"><h4>02 / {copy.lip.audio}</h4><span>{duration} s</span></div>
        <svg className="creator-lip-waveform" viewBox="0 0 256 60" aria-hidden="true">{recorded.audio.peaks.map((peak, index) => <rect key={index} x={index * 4} y={30 - peak * 28} width="2" height={peak * 56} rx="1" fill={index / recorded.audio.peaks.length < position / recorded.audio.duration ? '#17191a' : '#ac8756'} />)}</svg>
        <audio ref={audio} preload="none" src={recorded.audio.original} aria-label={copy.lip.audio}
          onLoadedMetadata={() => setReady(true)} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
          onTimeUpdate={event => setPosition(event.currentTarget.currentTime)} onEnded={() => setPlaying(false)} onError={() => setFailed(true)} />
        <div className="creator-lip-audio-controls">
          <button type="button" onClick={toggleVoice} aria-label={`${playing ? copy.pause : copy.play} — ${copy.lip.audio}`}>{playing ? <Pause size={17} /> : <Play size={17} />}</button>
          <span>0:{String(Math.floor(position)).padStart(2, '0')} / 0:{String(Math.floor(recorded.audio.duration)).padStart(2, '0')}</span>
          <input type="range" min="0" max={recorded.audio.duration} step="0.05" value={position} disabled={!ready} aria-label={`${copy.seek} — ${copy.lip.audio}`} onChange={event => { if (audio.current) audio.current.currentTime = Number(event.target.value); }} />
        </div>
        {failed ? <p role="alert">{copy.error} <a href={recorded.audio.original} download>{copy.download}</a></p> : null}
        <blockquote lang="en">{copy.lip.transcript}</blockquote>
      </div>
    </div>
    {result ? <div className="creator-lip-performance">
      <CreatorResultVideo media={result} label={`03 / ${copy.lip.result}`} locale={locale} />
      <div className="creator-result-footer"><p className="creator-result-note">{copy.lip.note}</p><a className="creator-result-download" href={result.original} download><Download size={16} aria-hidden="true" />{copy.download}</a></div>
    </div> : null}
  </div>;
}
