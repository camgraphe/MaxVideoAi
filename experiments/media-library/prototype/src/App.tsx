import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { Selection } from 'react-aria-components';
import { ArrowDownUp, Check, ChevronDown, Folder, FolderPlus, Grid3X3, Image as ImageIcon, Info, Menu, Music2, PanelLeftClose, Plus, Search, SlidersHorizontal, Sparkles, Star, Trash2, Upload, Video, X } from 'lucide-react';
import { COLLECTIONS, createFixtures } from './fixtures';
import { MediaGrid } from './MediaGrid.client';
import { ToolDialog } from './ToolDialog.client';
import { explicitSelection, formatCount, KIND_LABELS } from './media-state';
import type { MediaItem, MediaKind } from './types';

const MediaViewer = lazy(() => import('./MediaViewer.client'));
const ImportQueue = lazy(() => import('./ImportQueue.client').then(module => ({ default: module.ImportQueue })));
const countFromLocation = () => new URLSearchParams(location.search).get('count') === '10000' ? 10000 : 1000;

export function App() {
  const [count, setCount] = useState(countFromLocation);
  const base = useMemo(() => createFixtures(count), [count]);
  const [imports, setImports] = useState<MediaItem[]>([]);
  const [trash, setTrash] = useState<Set<string>>(new Set());
  const [favoriteOverrides, setFavoriteOverrides] = useState<Record<string, boolean>>({});
  const [membershipOverrides, setMembershipOverrides] = useState<Record<string, string[]>>({});
  const [extraCollections, setExtraCollections] = useState<{ id: string; name: string }[]>([]);
  const [scope, setScope] = useState('all');
  const [kind, setKind] = useState<MediaKind | 'all'>('all');
  const [origin, setOrigin] = useState('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('recent');
  const [density, setDensity] = useState(() => innerWidth <= 600 ? 104 : 128);
  const [selection, setSelection] = useState<Selection>(new Set());
  const [sidebarOpen, setSidebarOpen] = useState(() => innerWidth > 760);
  const [newCollection, setNewCollection] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [undoIds, setUndoIds] = useState<string[]>([]);
  const [pendingTrash, setPendingTrash] = useState<string[] | null>(null);
  const trashDialog = useRef<HTMLDialogElement>(null);
  const [viewer, setViewer] = useState<{ activeId: string; ids: string[]; origin: 'library' | 'picker' } | null>(null);
  const returnFocusId = useRef<string | null>(null);
  const [toolOpen, setToolOpen] = useState(false);
  const [toolRequest, setToolRequest] = useState(0);
  const [handoffItems, setHandoffItems] = useState<MediaItem[]>([]);
  const [acceptedPreview, setAcceptedPreview] = useState<{ id: string; revision: number } | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importMounted, setImportMounted] = useState(false);
  const ownedObjectUrls = useRef(new Set<string>());
  const [diagnostics, setDiagnostics] = useState(false);
  const [virtualized, setVirtualized] = useState(() => new URLSearchParams(location.search).get('render') !== 'plain');
  const [renderMs, setRenderMs] = useState(0);
  const renderStarted = useRef(performance.now());
  const [domSnapshot, setDomSnapshot] = useState({ tiles: 0, videos: 0, audios: 0 });

  const collections = [...COLLECTIONS, ...extraCollections];
  const allItems = useMemo(() => [...imports, ...base].map(item => favoriteOverrides[item.id] !== undefined || membershipOverrides[item.id] !== undefined ? { ...item, favorite: favoriteOverrides[item.id] ?? item.favorite, collectionIds: membershipOverrides[item.id] ?? item.collectionIds } : item), [base, imports, favoriteOverrides, membershipOverrides]);
  const activeItems = useMemo(() => allItems.filter(item => !trash.has(item.id)), [allItems, trash]);
  const byId = useMemo(() => new Map(allItems.map(item => [item.id, item])), [allItems]);
  const displayed = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('fr');
    const result = allItems.filter(item => {
      if (scope === 'trash' ? !trash.has(item.id) : trash.has(item.id)) return false;
      if (scope === 'favorites' && !item.favorite) return false;
      if (scope.startsWith('collection:') && !item.collectionIds.includes(scope.slice(11))) return false;
      if (kind !== 'all' && item.kind !== kind) return false;
      if (origin !== 'all' && item.source !== origin) return false;
      return !normalized || `${item.name} ${KIND_LABELS[item.kind]} ${item.source === 'upload' ? 'importé' : 'créé'}`.toLocaleLowerCase('fr').includes(normalized);
    });
    return sort === 'name' ? result.sort((a, b) => a.name.localeCompare(b.name, 'fr', { numeric: true })) : sort === 'oldest' ? result.sort((a,b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)) : result.sort((a,b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
  }, [allItems, trash, scope, kind, origin, query, sort]);
  const selectedIds = useMemo(() => explicitSelection(selection, displayed), [selection, displayed]);
  const selectedItems = useMemo(() => displayed.filter(item => selectedIds.has(item.id)), [displayed, selectedIds]);
  const viewerItems = useMemo(() => viewer ? viewer.ids.map(id => byId.get(id)).filter((item): item is MediaItem => Boolean(item) && !trash.has(item!.id)) : [], [viewer?.ids, byId, trash]);
  const favoritesCount = useMemo(() => activeItems.filter(item => item.favorite).length, [activeItems]);
  const currentCollection = scope.startsWith('collection:') ? collections.find(collection => collection.id === scope.slice(11)) : null;
  const title = scope === 'favorites' ? 'Favoris' : scope === 'trash' ? 'Corbeille' : currentCollection?.name ?? 'Tous les médias';
  const clearSelection = () => setSelection(new Set());
  const changeScope = (next: string) => { setScope(next); setQuery(''); clearSelection(); if (innerWidth <= 760) setSidebarOpen(false); };

  useEffect(() => {
    return () => { for (const url of ownedObjectUrls.current) URL.revokeObjectURL(url); };
  }, []);
  useEffect(() => {
    if (pendingTrash?.length && !trashDialog.current?.open) trashDialog.current?.showModal();
    if (!pendingTrash?.length && trashDialog.current?.open) trashDialog.current.close();
  }, [pendingTrash]);
  useEffect(() => {
    let a = 0, b = 0;
    a = requestAnimationFrame(() => { b = requestAnimationFrame(() => setRenderMs(Math.round(performance.now() - renderStarted.current))); });
    return () => { cancelAnimationFrame(a); cancelAnimationFrame(b); };
  }, [count, virtualized]);
  useEffect(() => {
    if (!diagnostics) return;
    const update = () => setDomSnapshot({ tiles: document.querySelectorAll('[data-media-id]').length, videos: document.querySelectorAll('video').length, audios: document.querySelectorAll('audio').length });
    update(); const timer = setInterval(update, 1000); return () => clearInterval(timer);
  }, [diagnostics]);

  const favorite = (id: string) => { const item = byId.get(id); if (item) setFavoriteOverrides(previous => ({ ...previous, [id]: !item.favorite })); };
  const openViewer = (item: MediaItem, items: MediaItem[], origin: 'library' | 'picker' = 'library') => {
    returnFocusId.current = item.id; setViewer({ activeId: item.id, ids: items.map(item => item.id), origin });
  };
  const closeViewer = () => {
    const origin = viewer?.origin; setViewer(null);
    if (origin === 'library') requestAnimationFrame(() => {
      const tile = document.querySelector<HTMLElement>(`[data-media-id="${returnFocusId.current}"]`);
      (tile ?? document.querySelector<HTMLElement>('.media-grid'))?.focus({ preventScroll: true });
    });
  };
  const useItems = (items: MediaItem[]) => { setHandoffItems(items); setToolRequest(previous => previous + 1); setToolOpen(true); setViewer(null); };
  const showNotice = (message: string, undo: string[] = []) => { setNotice(message); setUndoIds(undo); };
  const doTrash = (ids: string[]) => {
    setTrash(previous => new Set([...previous, ...ids])); showNotice(`${formatCount(ids.length)} média${ids.length > 1 ? 's' : ''} mis à la corbeille`, ids); clearSelection(); setPendingTrash(null); setViewer(null);
  };
  const restore = (ids: string[]) => { const restored = new Set(ids); setTrash(previous => new Set([...previous].filter(id => !restored.has(id)))); clearSelection(); showNotice(`${formatCount(ids.length)} média${ids.length > 1 ? 's' : ''} restauré${ids.length > 1 ? 's' : ''}`); };
  const addToCollection = (collectionId: string) => {
    if (!collectionId) return;
    setMembershipOverrides(previous => {
      const next = { ...previous };
      for (const item of selectedItems) next[item.id] = [...new Set([...(next[item.id] ?? item.collectionIds), collectionId])];
      return next;
    });
    showNotice(`${formatCount(selectedItems.length)} médias ajoutés à ${collections.find(collection => collection.id === collectionId)?.name}`);
  };
  const startImport = () => { setImportMounted(true); setImportOpen(true); };

  return <div className="app" data-fixture-count={count} data-total-count={allItems.length} data-result-count={displayed.length} data-selected-count={selectedItems.length} data-render-ms={renderMs}>
    <nav className="app-rail" aria-label="Navigation de l’application"><a className="brand-mark" href="/" aria-label="MaxVideoAI — prototype">M<span/></a><button className="rail-button" title="Création simulée" aria-label="Ouvrir les outils de création" onClick={() => useItems([])}><Sparkles size={21}/></button><button className="rail-button active" aria-label="Bibliothèque" onClick={() => changeScope('all')}><Grid3X3 size={21}/></button><span className="rail-spacer"/><button className={`rail-button ${diagnostics ? 'active' : ''}`} aria-label="Afficher les mesures du prototype" onClick={() => setDiagnostics(!diagnostics)}><Info size={20}/></button><div className="avatar">AM</div></nav>
    {sidebarOpen && <button className="sidebar-backdrop" aria-label="Fermer la navigation médias" onClick={() => setSidebarOpen(false)}/>}
    <aside className={`library-sidebar ${sidebarOpen ? 'is-open' : ''}`} aria-label="Organisation des médias">
      <div className="sidebar-heading"><span>Bibliothèque</span><button className="icon-button" aria-label="Réduire la navigation médias" onClick={() => setSidebarOpen(false)}><PanelLeftClose size={16}/></button></div>
      <button className={`sidebar-link ${scope === 'all' ? 'current' : ''}`} onClick={() => changeScope('all')}><Grid3X3 size={16}/><span>Tous les médias</span><small>{formatCount(activeItems.length)}</small></button>
      <button className={`sidebar-link ${scope === 'favorites' ? 'current' : ''}`} onClick={() => changeScope('favorites')}><Star size={16}/><span>Favoris</span><small>{formatCount(favoritesCount)}</small></button>
      <div className="sidebar-section"><span>Collections</span><button className="icon-button" aria-label="Créer une collection" onClick={() => setNewCollection('')}><Plus size={15}/></button></div>
      {collections.map(collection => <button key={collection.id} className={`sidebar-link ${scope === `collection:${collection.id}` ? 'current' : ''}`} onClick={() => changeScope(`collection:${collection.id}`)}><Folder size={16}/><span>{collection.name}</span></button>)}
      {newCollection !== null && <form className="collection-form" onSubmit={event => { event.preventDefault(); if (newCollection.trim()) { const id = `collection-local-${crypto.randomUUID()}`; setExtraCollections(previous => [...previous, { id, name: newCollection.trim() }]); setNewCollection(null); changeScope(`collection:${id}`); } }}><input autoFocus aria-label="Nom de la nouvelle collection" placeholder="Nom de la collection" value={newCollection} onChange={event => setNewCollection(event.target.value)}/><button className="icon-button" aria-label="Enregistrer la collection"><Check size={15}/></button><button type="button" className="icon-button" aria-label="Annuler la création" onClick={() => setNewCollection(null)}><X size={15}/></button></form>}
      <div className="sidebar-bottom"><button className={`sidebar-link ${scope === 'trash' ? 'current' : ''}`} onClick={() => changeScope('trash')}><Trash2 size={16}/><span>Corbeille</span>{trash.size > 0 && <small>{formatCount(trash.size)}</small>}</button><p>Vos collections regroupent les médias sans les copier.</p></div>
    </aside>
    <main className="library-main">
      <header className="library-topbar"><div className="title-group">{!sidebarOpen && <button className="icon-button" aria-label="Ouvrir la navigation médias" onClick={() => setSidebarOpen(true)}><Menu size={20}/></button>}<h1>{title}</h1><span className="result-count">{formatCount(displayed.length)}</span></div><div className="topbar-actions"><span className="prototype-tag">Prototype local</span><select aria-label="Nombre de médias simulés" value={count} onChange={event => { renderStarted.current = performance.now(); const next = Number(event.target.value); setCount(next); clearSelection(); const params = new URLSearchParams(location.search); params.set('count', String(next)); history.replaceState(null, '', `?${params}`); }}><option value={1000}>1 000 médias</option><option value={10000}>10 000 médias</option></select><button className="button primary import-button" onClick={startImport}><Upload size={15}/><span>Importer</span></button></div></header>
      <div className="library-toolbar">
        <div className="type-filters" role="group" aria-label="Types de médias">{(['all','image','video','audio'] as const).map(value => <button key={value} aria-pressed={kind === value} onClick={() => { setKind(value); clearSelection(); }}>{value === 'all' ? <Grid3X3 size={14}/> : value === 'image' ? <ImageIcon size={14}/> : value === 'video' ? <Video size={14}/> : <Music2 size={14}/>}<span>{value === 'all' ? 'Tout' : `${KIND_LABELS[value]}${value === 'audio' ? '' : 's'}`}</span></button>)}</div>
        <label className="search-field"><Search size={16}/><input type="search" aria-label="Rechercher dans la bibliothèque" placeholder="Rechercher vos médias…" value={query} onChange={event => { setQuery(event.target.value); clearSelection(); }}/></label>
        <select aria-label="Origine des médias" value={origin} onChange={event => { setOrigin(event.target.value); clearSelection(); }}><option value="all">Toutes les origines</option><option value="upload">Importés</option><option value="generated">Créés</option></select>
        <label className="density-control"><SlidersHorizontal size={15}/><span className="sr-only">Taille des vignettes</span><input type="range" aria-label="Taille des vignettes" min={88} max={184} step={8} value={density} onChange={event => setDensity(Number(event.target.value))}/></label>
        <label className="sort-control"><ArrowDownUp size={14}/><select aria-label="Trier les médias" value={sort} onChange={event => setSort(event.target.value)}><option value="recent">Plus récents</option><option value="oldest">Plus anciens</option><option value="name">Nom</option></select></label>
      </div>
      <div className={`selection-bar ${selectedItems.length ? 'has-selection' : ''}`}>
        <div><button className="selection-toggle" onClick={() => { if (selectedItems.length) clearSelection(); else if (displayed[0]) setSelection(new Set([displayed[0].id])); }}><span className={`selection-box ${selectedItems.length ? 'checked' : ''}`}>{selectedItems.length > 0 && <Check size={12}/>}</span>{selectedItems.length ? `${formatCount(selectedItems.length)} sélectionné${selectedItems.length > 1 ? 's' : ''}` : 'Sélectionner'}</button>{selectedItems.length > 0 && <button className="text-button select-all" onClick={() => setSelection(new Set(displayed.map(item => item.id)))}>Tout sélectionner ({formatCount(displayed.length)})</button>}</div>
        {selectedItems.length > 0 ? <div className="bulk-actions">{scope === 'trash' ? <button className="button quiet" onClick={() => restore(selectedItems.map(item => item.id))}>Restaurer</button> : <><select aria-label="Ajouter la sélection à une collection" value="" onChange={event => addToCollection(event.target.value)}><option value="">Ajouter à une collection</option>{collections.map(collection => <option key={collection.id} value={collection.id}>{collection.name}</option>)}</select><button className="button quiet bulk-favorite" onClick={() => { setFavoriteOverrides(previous => Object.assign({}, previous, Object.fromEntries(selectedItems.map(item => [item.id, true])))); showNotice('Sélection ajoutée aux favoris'); }}><Star size={14}/><span>Favoris</span></button><button className="button quiet" onClick={() => useItems(selectedItems)}><Sparkles size={14}/><span>Utiliser dans…</span></button><button className="button danger quiet" onClick={() => setPendingTrash(selectedItems.map(item => item.id))}><Trash2 size={14}/><span>Corbeille</span></button></>}</div> : <span className="selection-hint">Clic pour ouvrir · cases pour sélectionner · Maj pour une plage</span>}
      </div>
      <MediaGrid items={displayed} selected={selection} onSelectionChange={setSelection} onOpen={item => scope !== 'trash' && openViewer(item, displayed)} density={density} onFavorite={scope === 'trash' ? undefined : favorite} virtualized={virtualized} empty={scope === 'trash' ? 'La corbeille est vide.' : query ? 'Aucun média ne correspond à cette recherche.' : 'Cette collection est prête à accueillir vos médias.'}/>
      <footer className="library-status"><span>{formatCount(displayed.length)} médias{scope === 'trash' ? ' dans la corbeille' : ''}</span><span>Données fictives · modifications locales à cet essai</span><button className="text-button" onClick={() => setDiagnostics(!diagnostics)}>Mesures</button></footer>
    </main>
    {diagnostics && <aside className="diagnostics" aria-label="Mesures du prototype"><header><b>Mesures de l’essai</b><button className="icon-button" aria-label="Fermer les mesures" onClick={() => setDiagnostics(false)}><X size={16}/></button></header><dl><div><dt>Enregistrements simulés</dt><dd>{formatCount(allItems.length)}</dd></div><div><dt>Cases montées</dt><dd>{formatCount(domSnapshot.tiles)}</dd></div><div><dt>Lecteurs vidéo / audio</dt><dd>{domSnapshot.videos} / {domSnapshot.audios}</dd></div><div><dt>Changement de jeu + 2 frames</dt><dd>{renderMs} ms</dd></div></dl><label><input type="checkbox" checked={!virtualized} onChange={event => { renderStarted.current = performance.now(); setVirtualized(!event.target.checked); }}/> Référence : toutes les cases dans le DOM</label><p>Comparaison locale du rendu uniquement. Les métadonnées sont en mémoire et les fichiers sont réutilisés. Ce test ne mesure ni l’API, ni les accès privés, ni les performances de production.</p></aside>}
    {notice && <div className="toast" role="status"><Check size={16}/><span>{notice}</span>{undoIds.length > 0 && <button onClick={() => restore(undoIds)}>Annuler</button>}<button className="icon-button" aria-label="Fermer le message" onClick={() => { showNotice(''); }}><X size={14}/></button></div>}
    <dialog ref={trashDialog} className="confirm-dialog" aria-label="Confirmer la mise à la corbeille" onCancel={event => { event.preventDefault(); setPendingTrash(null); }}><Trash2 size={25}/><h2>Mettre {formatCount(pendingTrash?.length ?? 0)} média{(pendingTrash?.length ?? 0) > 1 ? 's' : ''} à la corbeille ?</h2><p>Ils disparaîtront des galeries, recherches et sélecteurs de cet essai. Vous pourrez les restaurer depuis la corbeille.</p><div className="confirm-actions"><button className="button quiet" onClick={() => setPendingTrash(null)}>Annuler</button><button className="button danger-fill" onClick={() => pendingTrash && doTrash(pendingTrash)}>Mettre à la corbeille</button></div></dialog>
    <ToolDialog open={toolOpen && !viewer && !importOpen} requestKey={toolRequest} initialItems={handoffItems} items={activeItems} onClose={() => setToolOpen(false)} onPreview={(item, items) => openViewer(item, items, 'picker')} onImport={startImport} acceptPreview={acceptedPreview}/>
    <Suspense fallback={viewer || importOpen ? <div className="loading-overlay" role="status">Ouverture…</div> : null}>
      {viewer && <MediaViewer items={viewerItems} activeId={viewer.activeId} onActiveChange={activeId => setViewer(previous => previous ? { ...previous, activeId } : null)} onClose={closeViewer} onFavorite={favorite} onTrash={id => { closeViewer(); setPendingTrash([id]); }} useLabel={viewer.origin === 'picker' ? 'Choisir ce média' : undefined} onUse={item => { if (viewer.origin === 'picker') { setAcceptedPreview({ id: item.id, revision: performance.now() }); setViewer(null); } else useItems([item]); }}/>}
      {importMounted && <ImportQueue open={importOpen} onClose={() => setImportOpen(false)} onImported={items => { for (const item of items) for (const url of [item.originalUrl, item.previewUrl, item.thumbUrl]) if (url?.startsWith('blob:')) ownedObjectUrls.current.add(url); setImports(previous => { const known = new Set(previous.map(item => item.id)); return [...items.filter(item => !known.has(item.id)), ...previous]; }); showNotice(`${items.length} média${items.length > 1 ? 's' : ''} ajouté${items.length > 1 ? 's' : ''} à la bibliothèque locale`); }}/>}
    </Suspense>
  </div>;
}
