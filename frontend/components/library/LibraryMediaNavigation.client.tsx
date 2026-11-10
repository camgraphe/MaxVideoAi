'use client';
import { AudioWaveform, Clapperboard, Images, UsersRound } from 'lucide-react';
export function LibraryMediaNavigation({ locale, value, onChange, charactersEnabled }: {
  locale: string; value: string; onChange: (value: 'all' | 'image' | 'video' | 'audio' | 'characters') => void; charactersEnabled: boolean;
}) {
  const fr = locale.startsWith('fr'), es = locale.startsWith('es');
  return <div className="library-media-navigation" role="group" aria-label={fr ? 'Bibliothèque' : es ? 'Biblioteca' : 'Library'}>
    {([
      ['all', fr ? 'Tout' : es ? 'Todos' : 'All', null],
      ['image', es ? 'Imágenes' : 'Images', Images],
      ['video', fr ? 'Vidéos' : 'Videos', Clapperboard],
      ['audio', 'Audio', AudioWaveform],
      ...(charactersEnabled ? [['characters', fr ? 'Personnages' : es ? 'Personajes' : 'Characters', UsersRound] as const] : []),
    ] as const).map(([key, label, Icon]) => <button key={key} type="button" aria-pressed={value === key} onClick={() => onChange(key)}>{Icon ? <Icon size={16} aria-hidden /> : null}{label}</button>)}
  </div>;
}
