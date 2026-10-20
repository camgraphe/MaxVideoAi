'use client';
import { useEffect, useRef, useState } from 'react';
import type { AudioCreationCopy } from '../_lib/audio-creation-copy';

export function AudioVoicePreview({ voiceId, name, copy }: { voiceId: string; name: string; copy: AudioCreationCopy }) {
  const player = useRef<HTMLAudioElement>(null);
  const [failed, setFailed] = useState(false);
  const source = `/api/audio/voices/${voiceId}/preview`;
  useEffect(() => {
    const audio = player.current;
    // Strict Mode can restart this effect after cleanup on the same element.
    if (audio && audio.getAttribute('src') !== source) audio.setAttribute('src', source);
    return () => { audio?.pause(); audio?.removeAttribute('src'); audio?.load(); };
  }, [source]);
  return <>
    <span>{copy.preview} · {name}</span>
    <audio ref={player} aria-label={`${copy.preview} · ${name}`} controls preload="none"
      src={source} onError={() => setFailed(true)} onCanPlay={() => setFailed(false)} />
    <small>{copy.previewHint}</small>
    {failed ? <p role="status">{copy.previewUnavailable}</p> : null}
  </>;
}
