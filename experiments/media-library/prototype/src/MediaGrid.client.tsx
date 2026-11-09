import { memo, useMemo, useRef } from 'react';
import { Button, Checkbox, GridList, GridListItem, type Selection } from 'react-aria-components';
import { GridLayout, ListLayout, Size, Virtualizer } from 'react-aria-components/Virtualizer';
import { Check, Eye, Film, Image as ImageIcon, Music2, Star } from 'lucide-react';
import { durationLabel } from './media-state';
import type { MediaItem } from './types';
import './audio-list.css';

const AUDIO_LAYOUT_OPTIONS = { rowSize: 60, gap: 2 };
const audioDate = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });

type Props = {
  items: MediaItem[];
  selected: Selection;
  onSelectionChange: (keys: Selection) => void;
  onOpen: (item: MediaItem) => void;
  density: number;
  label?: string;
  onFavorite?: (id: string) => void;
  selectionOnly?: boolean;
  empty?: string;
  virtualized?: boolean;
};

export const MediaGrid = memo(function MediaGrid({ items, selected, onSelectionChange, onOpen, density, label = 'Bibliothèque de médias', onFavorite, selectionOnly, empty = 'Aucun média dans cette vue.', virtualized = true }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const autoAudioList = items.length > 0 && items.every(item => item.kind === 'audio');
  // React Aria caches item renderers. Read event intent from the current browser
  // context rather than retaining a previous filter/picker selection in a tile.
  const latest = useRef({ items, selected, onSelectionChange, onOpen, onFavorite, selectionOnly });
  latest.current = { items, selected, onSelectionChange, onOpen, onFavorite, selectionOnly };
  const options = useMemo(() => ({
    minItemSize: new Size(density, density + 25),
    maxItemSize: new Size(density + 24, density + 49),
    preserveAspectRatio: true,
    minSpace: new Size(6, 8),
    maxHorizontalSpace: 12,
  }), [density]);
  const openOrSelect = (item: MediaItem) => {
    const current = latest.current;
    if (current.selectionOnly) {
      const next = current.selected === 'all' ? new Set(current.items.map(item => item.id)) : new Set([...current.selected].map(String));
      if (next.has(item.id)) next.delete(item.id); else next.add(item.id);
      current.onSelectionChange(next);
    } else current.onOpen(current.items.find(candidate => candidate.id === item.id) ?? item);
  };

  const collection = <GridList
        ref={ref}
        aria-label={label}
        layout={autoAudioList ? 'stack' : 'grid'}
        className={`media-grid ${autoAudioList ? 'audio-list' : ''} ${virtualized ? '' : 'is-plain'}`}
        style={virtualized || autoAudioList ? undefined : { gridTemplateColumns: `repeat(auto-fill, minmax(${density}px, 1fr))` }}
        items={items}
        dependencies={[Boolean(onFavorite), Boolean(selectionOnly), autoAudioList]}
        selectionMode="multiple"
        selectionBehavior="replace"
        selectedKeys={selected}
        onSelectionChange={onSelectionChange}
        onAction={selectionOnly ? undefined : key => { const item = latest.current.items.find(item => item.id === key); if (item) latest.current.onOpen(item); }}
        renderEmptyState={() => <div className="empty-state"><ImageIcon size={30}/><p>{empty}</p></div>}
      >
        {item => <GridListItem id={item.id} textValue={item.name} className={autoAudioList ? 'audio-row' : 'media-tile'} data-media-id={item.id} data-kind={item.kind}>
          {autoAudioList ? <>
            <Checkbox slot="selection" aria-label={`Sélectionner ${item.name}`} className="audio-row-check">{({isSelected}) => <span>{isSelected && <Check size={12}/>}</span>}</Checkbox>
            <Button type="button" className="audio-row-main" aria-label={`${selectionOnly ? 'Sélectionner' : 'Ouvrir'} ${item.name}`} onPress={() => openOrSelect(item)}>
              <span className="audio-row-art">{item.thumbUrl ? <img src={item.thumbUrl} width={36} height={36} alt="" loading="lazy" decoding="async"/> : <Music2 size={19}/>}</span>
              <span className="audio-row-name" title={item.name}>{item.name}</span>
            </Button>
            <span className="audio-row-duration" aria-label={`Durée : ${durationLabel(item.durationSec)}`}>{durationLabel(item.durationSec)}</span>
            <span className="audio-row-origin">{item.source === 'upload' ? 'Importé' : 'Créé'}</span>
            <time className="audio-row-date" dateTime={item.createdAt}>{audioDate.format(new Date(item.createdAt))}</time>
            {onFavorite && <Button type="button" className={`audio-row-favorite ${item.favorite ? 'is-favorite' : ''}`} aria-label={`${item.favorite ? 'Retirer des' : 'Ajouter aux'} favoris : ${item.name}`} onPress={() => latest.current.onFavorite?.(item.id)}><Star size={15} fill={item.favorite ? 'currentColor' : 'none'}/></Button>}
            {selectionOnly && <Button type="button" className="audio-row-preview" aria-label={`Prévisualiser ${item.name}`} onPress={() => latest.current.onOpen(latest.current.items.find(candidate => candidate.id === item.id) ?? item)}><Eye size={16}/></Button>}
          </> : <>
          <div className="tile-cover">
            <Button type="button" className="tile-open" aria-label={`${selectionOnly ? 'Sélectionner' : 'Ouvrir'} ${item.name}`} onPress={() => openOrSelect(item)}>
              {item.thumbUrl ? <img src={item.thumbUrl} width={item.width || undefined} height={item.height || undefined} alt="" loading="lazy" decoding="async" /> : <span className="audio-cover"><Music2 size={32}/><i/><i/><i/><i/><i/><i/><i/><i/><i/></span>}
            </Button>
            <Checkbox slot="selection" aria-label={`Sélectionner ${item.name}`} className="tile-check">{({isSelected}) => <span>{isSelected && <Check size={12}/>}</span>}</Checkbox>
            {onFavorite && <Button type="button" className={`tile-favorite ${item.favorite ? 'is-favorite' : ''}`} aria-label={`${item.favorite ? 'Retirer des' : 'Ajouter aux'} favoris : ${item.name}`} onPress={() => latest.current.onFavorite?.(item.id)}><Star size={13} fill={item.favorite ? 'currentColor' : 'none'}/></Button>}
            {item.kind !== 'image' && <span className="tile-kind">{item.kind === 'video' ? <Film size={10}/> : <Music2 size={10}/>} {durationLabel(item.durationSec)}</span>}
            {selectionOnly && <Button type="button" className="tile-preview" aria-label={`Prévisualiser ${item.name}`} onPress={() => latest.current.onOpen(item)}>Aperçu</Button>}
          </div>
          <div className="tile-caption"><span title={item.name}>{item.name}</span>{item.kind === 'image' ? <ImageIcon size={11}/> : item.kind === 'video' ? <Film size={11}/> : <Music2 size={11}/>}</div>
          </>}
        </GridListItem>}
      </GridList>;
  return <div className="grid-wrap" data-testid="grid-wrap" data-virtualized={String(virtualized)} data-layout={autoAudioList ? 'audio-list' : 'grid'}>
    {virtualized ? autoAudioList
      ? <Virtualizer key="audio-list" layout={ListLayout} layoutOptions={AUDIO_LAYOUT_OPTIONS}>{collection}</Virtualizer>
      : <Virtualizer key="media-grid" layout={GridLayout} layoutOptions={options}>{collection}</Virtualizer>
      : collection}
  </div>;
});
