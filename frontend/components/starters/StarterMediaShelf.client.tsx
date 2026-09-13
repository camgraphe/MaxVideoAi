'use client';
import Image from 'next/image';
import useSWR from 'swr';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { BUILTIN_STARTER_MEDIA, type StarterMedia, type StarterMediaSurface } from '@/lib/starter-media';

export function StarterMediaShelf({ surface, onUsePrompt }: { surface: StarterMediaSurface; onUsePrompt?: (prompt: string) => void }) {
  const { locale } = useI18n();
  const audioKinds = locale === 'fr' ? { voice: 'Voix · EN', music: 'Instrumental', song: 'Chanson · EN' }
    : locale === 'es' ? { voice: 'Voz · EN', music: 'Instrumental', song: 'Canción · EN' }
      : { voice: 'Voice · EN', music: 'Instrumental', song: 'Song · EN' };
  const copy = locale === 'fr' ? { title: 'À vous de jouer', samples: 'Exemples créatifs', voices: 'Samples audio', use: 'Reprendre le prompt', hint: 'Une idée de départ, à réinterpréter avec votre modèle.' }
    : locale === 'es' ? { title: 'Ahora te toca', samples: 'Ejemplos creativos', voices: 'Muestras de audio', use: 'Usar el prompt', hint: 'Una idea para reinterpretar con tu modelo.' }
      : { title: 'Make it your own', samples: 'Creative samples', voices: 'Audio samples', use: 'Use this prompt', hint: 'A starting idea to reinterpret with your model.' };
  const { data } = useSWR<{ items: StarterMedia[] }>(`/api/starter-media?surface=${surface}`, async url => {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Starter media unavailable');
    return response.json();
  }, { fallbackData: { items: BUILTIN_STARTER_MEDIA[surface] }, revalidateOnFocus: false });
  return <section aria-label={surface === 'image' ? copy.samples : copy.voices} className="w-full min-w-0 space-y-3" data-starter-media={surface}>
    <header><p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{surface === 'image' ? copy.samples : copy.voices}</p><h2 className="text-lg font-semibold">{copy.title}</h2>{surface === 'image' ? <p className="text-xs text-text-muted">{copy.hint}</p> : null}</header>
    <div className="grid min-w-0 gap-3">
      {data?.items.map(item => <article key={item.id} className="min-w-0 overflow-hidden rounded-xl border border-hairline bg-surface">
        {surface === 'image' ? <div className="relative aspect-square"><Image src={item.src} alt={item.title} fill sizes="(max-width: 640px) 90vw, 300px" className="object-cover" loading="lazy" /></div> : null}
        <div className="space-y-2 p-3"><p className="text-sm font-medium">{item.title}<span className="ml-2 text-xs text-text-muted">Sample</span></p>
          {item.audioKind ? <p className="text-xs text-text-muted">{audioKinds[item.audioKind]}</p> : null}
          {surface === 'audio' ? <audio controls preload="none" src={item.src} aria-label={item.title} className="h-9 w-full min-w-0" onPlay={event => { const current = event.currentTarget; current.closest('[data-starter-media]')?.querySelectorAll('audio').forEach(audio => { if (audio !== current) audio.pause(); }); }} />
            : <button type="button" className="text-sm font-semibold text-brand" onClick={() => onUsePrompt?.(item.prompt)}>{copy.use} ↗</button>}
        </div>
      </article>)}
    </div>
  </section>;
}
