'use client';

import type { PlaylistDestination } from './playlist-types';

type Props = {
  destinations: PlaylistDestination[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  disabled: boolean;
};

export function chooseInitialDestination(destinations: PlaylistDestination[]) {
  return destinations.find(destination => destination.id === 'examples' && destination.status === 'connected')
    ?? destinations.find(destination => destination.kind === 'family' && destination.status === 'connected')
    ?? destinations.find(destination => destination.status === 'connected');
}

export function DestinationSwitcher({ destinations, selectedId, onSelect, disabled }: Props) {
  const examples = destinations.find(destination => destination.id === 'examples');
  const starter = destinations.find(destination => destination.id === 'starter');
  const direct = (destination: PlaylistDestination | undefined, label: string) => (
    <button type="button" data-destination-id={destination?.id} aria-pressed={selectedId === destination?.id}
      disabled={disabled || !destination} onClick={() => destination && onSelect(destination.id)}
      className="rounded-md border border-border px-3 py-2 text-sm font-medium aria-pressed:border-brand aria-pressed:bg-brand/10 disabled:opacity-50">
      {label}{destination?.status === 'missing' ? ' · Missing' : ''}
    </button>
  );
  const missingHub = examples?.status === 'missing' ? examples.warning : null;
  return (
    <div className="space-y-3">
    {missingHub ? <p role="alert" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{missingHub}</p> : null}
    <nav aria-label="Destination groups" className="flex flex-wrap gap-2">
      {direct(examples, 'Examples')}
      {direct(starter, 'Starter video')}
      <a href="#playlist-families" className="rounded-md border border-border px-3 py-2 text-sm font-medium">Families</a>
      <a href="#playlist-models" className="rounded-md border border-border px-3 py-2 text-sm font-medium">Models</a>
      <a href="#playlist-image-audio" className="rounded-md border border-border px-3 py-2 text-sm font-medium">Image / audio</a>
    </nav>
    </div>
  );
}
