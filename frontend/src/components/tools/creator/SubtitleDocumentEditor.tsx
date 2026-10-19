'use client';
import { useEffect, useRef, useState } from 'react';
import { SubtitleOverlay } from '@/lib/subtitles/SubtitleOverlay';
import type { SubtitleDocument } from '@/lib/subtitles/document';
import type { CreatorSource } from './creator-source-selection';
import { creatorWorkspaceCopy } from './creator-workspace-copy';
import { creatorExperienceCopy } from './creator-experience-copy';
import { Upload } from 'lucide-react';
import styles from './creator-workspace.module.css';
export function SubtitlePreview({ document, source, locale, onRefresh }: { document: SubtitleDocument | null; source: CreatorSource | null; locale: string; onRefresh?(): void }) {
  const copy = creatorWorkspaceCopy(locale), frame = useRef<HTMLDivElement>(null);
  const [failed,setFailed] = useState<string | null>(null);
  const [timeMs,setTime] = useState(0), [size,setSize] = useState({width:640,height:360}), [ratio,setRatio] = useState(16 / 9);
  useEffect(() => { setTime(0); setRatio(16 / 9); }, [source?.url]);
  useEffect(() => {
    const element = frame.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => setSize({width:entry.contentRect.width,height:entry.contentRect.height}));
    observer.observe(element); return () => observer.disconnect();
  }, [source?.url]);
  if (!source) return <div className={styles.media}><div className={styles.empty}><Upload size={28} aria-hidden="true" /><p>{copy.sourceHint}</p></div></div>;
  const failure = failed === source.url ? <p className={styles.error} role="alert">{copy.previewError}{onRefresh ? <button type="button" onClick={onRefresh}>{copy.retry}</button> : null}</p> : null;
  if (source.ref.kind === 'audio') return <><div className={styles.media}><audio key={source.url} src={source.url} controls preload="none" onError={() => setFailed(source.url)} onTimeUpdate={event => setTime(Math.round(event.currentTarget.currentTime * 1000))} /></div>{failure}</>;
  return <><div className={styles.media} style={{aspectRatio:'auto'}}><div ref={frame} style={{position:'relative',width:`min(100%, ${60 * ratio}svh)`,aspectRatio:ratio}}>
    <video key={source.url} src={source.url} poster={source.thumbnailUrl ?? undefined} controls preload="none" playsInline onError={() => setFailed(source.url)} style={{display:'block',maxHeight:'none'}}
      onLoadedMetadata={event => { const video = event.currentTarget; if (video.videoWidth && video.videoHeight) setRatio(video.videoWidth / video.videoHeight); }}
      onTimeUpdate={event => setTime(Math.round(event.currentTarget.currentTime * 1000))} />
    {document ? <SubtitleOverlay document={document} timeMs={timeMs} width={size.width} height={size.height} /> : null}
  </div></div>{failure}</>;
}
export function SubtitleDocumentEditor({ locale, document, onChange, disabled }: { locale: string; document: SubtitleDocument; onChange(document: SubtitleDocument): void; disabled: boolean }) {
  const copy = creatorWorkspaceCopy(locale), experience = creatorExperienceCopy(locale);
  return <div className={styles.captionEditor}>
    <p className={styles.notice}>{copy.editHint}</p>
    {!document.segments.length ? <p role="status">{copy.transcriptEmpty}</p> : null}
    {document.segments.length ? <div className={styles.captionColumnLabels} aria-hidden="true"><span>{experience.startColumn}</span><span>{experience.textColumn}</span><span>{experience.endColumn}</span></div> : null}
    {document.segments.map((segment,index) => <div className={styles.captionRow} key={segment.id}>
      <input aria-label={`${copy.start} — ${index + 1}`} type="number" min="0" step="0.001" max={document.source.durationMs / 1000} value={segment.startMs / 1000} disabled={disabled}
        onChange={event => onChange({...document,segments:document.segments.map(value => value.id === segment.id ? {...value,startMs:Math.round(Number(event.target.value) * 1000),alignment:'edited'} : value)})} />
      <textarea aria-label={`${copy.caption} ${index + 1}`} maxLength={500} rows={2} value={segment.text} disabled={disabled}
        onChange={event => onChange({...document,segments:document.segments.map(value => value.id === segment.id ? {...value,text:event.target.value,alignment:'edited'} : value)})} />
      <input aria-label={`${copy.end} — ${index + 1}`} type="number" min="0" step="0.001" max={document.source.durationMs / 1000} value={segment.endMs / 1000} disabled={disabled}
        onChange={event => onChange({...document,segments:document.segments.map(value => value.id === segment.id ? {...value,endMs:Math.round(Number(event.target.value) * 1000),alignment:'edited'} : value)})} />
    </div>)}
  </div>;
}
