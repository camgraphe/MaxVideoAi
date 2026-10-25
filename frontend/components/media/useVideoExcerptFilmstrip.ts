'use client';

import { useEffect, useState } from 'react';

/** Optional, local-only decoration: one decoder, ten 160px frames, twelve seconds total. */
export function useVideoExcerptFilmstrip(url: string, durationSec: number, active: boolean) {
  const [result, setResult] = useState<{url: string; frames: string[]}>({url:'',frames:[]});
  useEffect(() => {
    if (!active || !url || !Number.isFinite(durationSec) || durationSec <= 0) return;
    const controller = new AbortController();
    const decoder = document.createElement('video');
    decoder.crossOrigin = 'anonymous';
    decoder.muted = true;
    decoder.playsInline = true;
    decoder.preload = 'auto';
    const release = () => { decoder.pause(); decoder.removeAttribute('src'); decoder.load(); };
    const wait = (name: string) => new Promise<void>((resolve, reject) => {
      const cleanup = () => { decoder.removeEventListener(name, done); decoder.removeEventListener('error', fail); controller.signal.removeEventListener('abort', fail); };
      const done = () => { cleanup(); resolve(); };
      const fail = () => { cleanup(); reject(new Error('capture unavailable')); };
      decoder.addEventListener(name, done, {once:true});
      decoder.addEventListener('error', fail, {once:true});
      controller.signal.addEventListener('abort', fail, {once:true});
      if (controller.signal.aborted) fail();
    });
    const timeout = window.setTimeout(() => controller.abort(), 12_000);
    void (async () => {
      try {
        const loaded = wait('loadeddata');
        decoder.src = url;
        decoder.load();
        await loaded;
        const canvas = document.createElement('canvas');
        const scale = Math.min(160 / decoder.videoWidth, 160 / decoder.videoHeight);
        canvas.width = Math.max(1, Math.round(decoder.videoWidth * scale));
        canvas.height = Math.max(1, Math.round(decoder.videoHeight * scale));
        const context = canvas.getContext('2d');
        if (!context) return;
        const frames: string[] = [];
        for (let index = 0; index < 10; index++) {
          if (controller.signal.aborted) return;
          const time = Math.min(durationSec - .001, (index + .5) / 10 * durationSec);
          const sought = wait('seeked');
          decoder.currentTime = Math.max(0, time);
          await sought;
          if (controller.signal.aborted) return;
          context.drawImage(decoder, 0, 0, canvas.width, canvas.height);
          frames.push(canvas.toDataURL('image/jpeg', .65));
        }
        if (!controller.signal.aborted) setResult({url,frames});
      } catch {
        // Decoder, CORS and canvas failures leave the numbered time track usable.
      } finally { window.clearTimeout(timeout); release(); }
    })();
    return () => { controller.abort(); window.clearTimeout(timeout); release(); };
  }, [url, durationSec, active]);
  return result.url === url ? result.frames : [];
}
