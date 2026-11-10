import { useState } from 'react';
import { Folder, FolderPlus, Grid2X2, MoreHorizontal, Search, Star, Trash2 } from 'lucide-react';
import type { Collection } from '../fixtures';
import { Popup, Sheet, Field } from './Primitives';
export function Collections({items, folder, onChoose, onChange, notify}: {items: Collection[]; folder: string; onChoose: (id: string) => void; onChange: (items: Collection[]) => void; notify: (message: string) => void}) {
  const [query, setQuery] = useState('');
  const [limit,setLimit] = useState(30);
  const matched = items.filter(c => c.name.toLocaleLowerCase('fr').includes(query.toLocaleLowerCase('fr')));
  const [editor, setEditor] = useState<Collection | 'new' | null>(null);
  const [name, setName] = useState('');
  const label = folder === 'favorites' ? 'Favoris' : folder === 'trash' ? 'Corbeille' : items.find(c => c.id === folder)?.name ?? 'Tous les médias';
  const edit = (collection: Collection | 'new') => { setEditor(collection); setName(collection === 'new' ? '' : collection.name); };
  return <>
    <Popup label={label} icon={<Folder size={17}/>} className="collection-trigger">{close => <div className="collection-menu">
      <div className="menu-title"><span>Bibliothèque</span><span className="subtle">Collections facultatives</span></div>
      <label className="search collection-search"><Search size={16}/><span className="sr-only">Rechercher une collection</span><input type="search" placeholder="Trouver une collection…" value={query} onChange={event => {setQuery(event.target.value);setLimit(30);}}/></label>
      <nav aria-label="Emplacements"><button aria-current={folder === 'all' ? 'page' : undefined} onClick={() => {onChoose('all');close();}}><Grid2X2 size={17}/>Tous les médias</button><button aria-current={folder === 'favorites' ? 'page' : undefined} onClick={() => {onChoose('favorites');close();}}><Star size={17}/>Favoris</button><button aria-current={folder === 'trash' ? 'page' : undefined} onClick={() => {onChoose('trash');close();}}><Trash2 size={17}/>Corbeille</button></nav>
      <div className="section-label">Collections</div><nav className="collection-list" aria-label="Collections">{matched.slice(0,limit).map(c => <div className="collection-row" key={c.id}><button aria-current={folder === c.id ? 'page' : undefined} onClick={() => {onChoose(c.id);close();}}><Folder size={17}/><span>{c.name}</span></button><button className="icon-button" aria-label={`Gérer ${c.name}`} onClick={() => {close();edit(c);}}><MoreHorizontal size={18}/></button></div>)}</nav>
      {matched.length === 0 ? <p className="subtle menu-empty">Aucune collection trouvée.</p> : null}
      <div className="collection-count"><span>{Math.min(limit,matched.length)} sur {matched.length.toLocaleString('fr')}</span>{matched.length>limit?<button className="text-button" onClick={()=>setLimit(n=>n+30)}>Afficher 30 de plus</button>:null}</div>
      <button className="menu-create" onClick={() => {close();edit('new');}}><FolderPlus size={17}/>Nouvelle collection</button>
    </div>}</Popup>
    <Sheet open={editor !== null} onClose={() => setEditor(null)} label={editor === 'new' ? 'Nouvelle collection' : 'Gérer la collection'}>
      <form className="editor" onSubmit={event => {event.preventDefault();if (!name.trim()) return;const id = editor === 'new' ? `collection-${Date.now()}` : editor!.id;onChange(editor === 'new' ? [...items,{id,name:name.trim()}] : items.map(c => c.id === id ? {...c,name:name.trim()} : c));onChoose(id);setEditor(null);notify(editor === 'new' ? 'Collection créée dans la démo' : 'Collection renommée dans la démo');}}>
        <p>Un média peut appartenir à plusieurs collections. Tous vos médias restent accessibles depuis la bibliothèque.</p>
        <Field label="Nom de la collection"><input autoFocus required maxLength={120} value={name} onChange={event => setName(event.target.value)}/></Field>
        <div className="editor-actions">{editor && editor !== 'new' ? <button type="button" className="danger" onClick={() => {onChange(items.filter(c => c.id !== editor.id));if(folder === editor.id)onChoose('all');setEditor(null);notify('Collection supprimée · ses médias sont conservés');}}><Trash2 size={16}/>Supprimer la collection</button> : null}<button className="primary" disabled={!name.trim()}>{editor === 'new' ? 'Créer' : 'Enregistrer'}</button></div>
      </form>
    </Sheet>
  </>;
}
