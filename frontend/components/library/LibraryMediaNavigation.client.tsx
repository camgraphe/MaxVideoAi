'use client';
import { AudioWaveform, ChevronDown, Clapperboard, Images, UsersRound } from 'lucide-react';
export function LibraryMediaNavigation({ locale, value, onChange, charactersEnabled }: {
  locale: string; value: string; onChange: (value: 'all' | 'image' | 'video' | 'audio' | 'characters') => void; charactersEnabled: boolean;
}) {
  const fr = locale.startsWith('fr'), es = locale.startsWith('es');
  const choices = [
      ['all', fr ? 'Tout' : es ? 'Todos' : 'All', null],
      ['image', es ? 'Imágenes' : 'Images', Images],
      ['video', fr ? 'Vidéos' : 'Videos', Clapperboard],
      ['audio', 'Audio', AudioWaveform],
      ...(charactersEnabled ? [['characters', fr ? 'Personnages' : es ? 'Personajes' : 'Characters', UsersRound] as const] : []),
    ] as const;
  return <div className="library-media-navigation" role="group" aria-label={fr ? 'Bibliothèque' : es ? 'Biblioteca' : 'Library'}>
    <div className="library-media-tabs">
      {choices.map(([key, label, Icon]) => <button key={key} type="button" aria-pressed={value === key} onClick={() => onChange(key)}>{Icon ? <Icon size={16} aria-hidden /> : null}{label}</button>)}
    </div>
    <div className="library-media-select">
      <select aria-label={fr ? 'Type de média' : es ? 'Tipo de medio' : 'Media type'} value={value} onChange={event => onChange(event.target.value as typeof choices[number][0])}>
        {choices.map(([key, label]) => <option key={key} value={key}>{key === 'all' ? (fr ? 'Tous les médias' : es ? 'Todos los medios' : 'All media') : label}</option>)}
      </select>
      <ChevronDown size={16} aria-hidden />
    </div>
  </div>;
}
