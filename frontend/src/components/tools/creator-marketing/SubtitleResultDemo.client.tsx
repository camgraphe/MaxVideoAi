'use client';
import { useEffect, useRef, useState } from 'react';
import { Download, Maximize, Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { usePublicVideoControls } from '@/components/media/usePublicVideoControls';
import type { SubtitleStyle } from '@/lib/subtitles/document';
import { SubtitleStylePicker } from '../creator/SubtitleStylePicker.client';
import demo from './subtitle-demo.json';

const copy = {
  en: { title: 'One scene. Three styles.', intro: 'Play the dialogue and compare three caption styles.', original: 'Without captions', download: 'Download this version', note: 'Original Wan 3 scene · English dialogue', error: 'This video cannot play here. You can download the selected version.' },
  fr: { title: 'Une scène. Trois styles.', intro: 'Écoutez la scène, puis comparez les trois styles de sous-titres.', original: 'Sans sous-titres', download: 'Télécharger cette version', note: 'Scène originale Wan 3 · Dialogue en anglais', error: 'La vidéo ne peut pas être lue ici. Vous pouvez télécharger la version sélectionnée.' },
  es: { title: 'Una escena. Tres estilos.', intro: 'Escucha la escena y compara los tres estilos de subtítulos.', original: 'Sin subtítulos', download: 'Descargar esta versión', note: 'Escena original Wan 3 · Diálogo en inglés', error: 'Este vídeo no se puede reproducir aquí. Puedes descargar la versión seleccionada.' },
};

/** Plays real rendered files. Changing style never starts a generation or an export. */
export function SubtitleResultDemo({ locale }: { locale: string }) {
  const labels = copy[locale === 'fr' ? 'fr' : locale === 'es' ? 'es' : 'en'];
  const controls = locale === 'fr' ? {play:'Lire la scène',pause:'Pause',seek:'Position de lecture',mute:'Couper le son',sound:'Activer le son',fullscreen:'Plein écran'} : locale === 'es' ? {play:'Reproducir la escena',pause:'Pausa',seek:'Posición de reproducción',mute:'Silenciar',sound:'Activar sonido',fullscreen:'Pantalla completa'} : {play:'Play the scene',pause:'Pause',seek:'Playback position',mute:'Mute',sound:'Turn sound on',fullscreen:'Full screen'};
  const [preset, setPreset] = useState<SubtitleStyle['preset']>('active-word');
  const [original, setOriginal] = useState(false);
  const src = original ? demo.source : demo.renders[preset];
  const playback = usePublicVideoControls(src, 'watch', 'original');
  const resume = useRef<{ time: number; playing: boolean } | null>(null);
  const player = useRef<HTMLDivElement>(null);
  const clock = (seconds:number) => `${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;
  const remember = () => {
    const node = playback.videoRef.current;
    resume.current = node && node.readyState > 0 ? { time: node.currentTime, playing: !node.paused } : null;
    if (node && !node.paused) node.pause();
  };
  const toggleFullscreen = () => {
    if (document.fullscreenElement) { void document.exitFullscreen().catch(() => {}); return; }
    if (player.current?.requestFullscreen) { void player.current.requestFullscreen().catch(() => {}); return; }
    // iPhone Safari exposes fullscreen on the video element instead of its wrapper.
    const video = playback.videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    video?.webkitEnterFullscreen?.();
  };
  useEffect(() => { if (resume.current) playback.videoRef.current?.load(); }, [src, playback.videoRef]);
  return <div className="creator-subtitle-result">
    <div className="creator-subtitle-result-heading"><h3>{labels.title}</h3><p>{labels.intro}</p></div>
    <div className="creator-subtitle-result-player" ref={player}>
      <video ref={playback.videoRef} src={src} poster={demo.posters[original ? 'original' : preset]} style={{aspectRatio:`${demo.width}/${demo.height}`}} playsInline preload="none" aria-label={labels.title} {...playback.events}
        onLoadedMetadata={event => {
          playback.events.onLoadedMetadata(event);
          const pending = resume.current; resume.current = null;
          if (pending) { event.currentTarget.currentTime = Math.min(pending.time, event.currentTarget.duration || 0); if (pending.playing) void event.currentTarget.play().catch(() => {}); }
        }} />
      <div className="creator-subtitle-transport">
        <button type="button" aria-label={playback.isPlaying?controls.pause:controls.play} onClick={playback.togglePlayback}>{playback.isPlaying?<Pause size={18}/>:<Play size={18}/>}</button>
        <span>{clock(playback.currentTime)} / {clock(playback.duration || demo.durationMs/1000)}</span>
        <input type="range" aria-label={controls.seek} min="0" max={playback.duration || demo.durationMs/1000} step="0.05" value={playback.currentTime} disabled={!playback.duration} onChange={event=>playback.seek(event.target.value)} />
        <button type="button" aria-label={playback.isMuted?controls.sound:controls.mute} onClick={playback.toggleMuted}>{playback.isMuted?<VolumeX size={17}/>:<Volume2 size={17}/>}</button>
        <button type="button" aria-label={controls.fullscreen} onClick={toggleFullscreen}><Maximize size={17}/></button>
      </div>
    </div>
    {playback.terminalError ? <p role="alert">{labels.error}</p> : null}
    <SubtitleStylePicker locale={locale} value={preset} onChange={value => { if (value === preset && !original) return; remember(); setPreset(value); setOriginal(false); }} />
    <div className="creator-subtitle-result-actions">
      <label><input type="checkbox" checked={original} onChange={event => { remember(); setOriginal(event.target.checked); }} />{labels.original}</label>
      <a href={src} download><Download size={15} aria-hidden="true" />{labels.download}</a>
    </div>
    <p className="creator-subtitle-result-note">{labels.note}</p>
  </div>;
}
