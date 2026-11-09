import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ChevronLeft, Film, Image as ImageIcon, Music2, Plus, Search, Upload, X } from 'lucide-react';
import type { Selection } from 'react-aria-components';
import { MediaGrid } from './MediaGrid.client';
import { explicitSelection, formatCount, KIND_LABELS, TARGETS } from './media-state';
import type { MediaItem, SelectionIntent } from './types';

type Props = {
  open: boolean;
  requestKey: number;
  initialItems: MediaItem[];
  items: MediaItem[];
  onClose: () => void;
  onPreview: (item: MediaItem, context: MediaItem[]) => void;
  onImport: () => void;
  acceptPreview: { id: string; revision: number } | null;
};

export function ToolDialog({ open, requestKey, initialItems, items, onClose, onPreview, onImport, acceptPreview }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const lastRole = useRef<string | null>(null);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string[]>>({});
  const [intent, setIntent] = useState<SelectionIntent | null>(null);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [feedback, setFeedback] = useState('');
  const [prepared, setPrepared] = useState(false);
  const target = TARGETS.find(target => target.id === targetId);
  const byId = useMemo(() => new Map(items.map(item => [item.id, item])), [items]);
  const activeInitialItems = initialItems.map(item => byId.get(item.id)).filter((item): item is MediaItem => Boolean(item));
  const candidates = useMemo(() => intent ? items.filter(item => intent.kinds.includes(item.kind) && item.name.toLowerCase().includes(query.toLowerCase())) : [], [items, intent, query]);
  const current = [...chosen].map(id => byId.get(id)).filter((item): item is MediaItem => Boolean(item));
  const keyFor = (role: SelectionIntent) => `${role.target}:${role.role}`;

  useEffect(() => {
    // Removing a source must release its slot everywhere. Search only changes
    // candidates, so references hidden by a query remain in the basket.
    const available = new Set([...chosen].filter(id => byId.has(id)));
    if (available.size !== chosen.size) {
      setChosen(available);
      setFeedback('Un média du panier a été retiré de la bibliothèque.');
    }
    let changed = false;
    const availableDrafts = Object.fromEntries(Object.entries(drafts).map(([key, ids]) => {
      const valid = ids.filter(id => byId.has(id));
      if (valid.length !== ids.length) changed = true;
      return [key, valid];
    }));
    if (changed) { setDrafts(availableDrafts); setPrepared(false); }
  }, [byId, chosen, drafts]);
  useEffect(() => { setTargetId(null); setIntent(null); setPrepared(false); setFeedback(''); }, [requestKey]);
  useEffect(() => {
    if (open && !ref.current?.open) ref.current?.showModal();
    if (!open && ref.current?.open) ref.current.close();
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      const element = intent ? ref.current?.querySelector<HTMLInputElement>('input') : lastRole.current ? ref.current?.querySelector<HTMLButtonElement>(`[data-role-key="${lastRole.current}"]`) : targetId ? ref.current?.querySelector<HTMLButtonElement>('[data-role-key]') : null;
      element?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [open, intent, targetId]);
  useEffect(() => {
    if (!acceptPreview || !intent) return;
    const item = byId.get(acceptPreview.id);
    if (!item || !intent.kinds.includes(item.kind)) return;
    if (intent.max > 1 && chosen.size >= intent.max && !chosen.has(item.id)) {
      setFeedback(`Le panier est plein (${intent.max}/${intent.max}). Retirez une référence pour en ajouter une autre.`);
      return;
    }
    setFeedback('');
    setChosen(previous => {
      if (intent.max === 1) return new Set([item.id]);
      if (previous.has(item.id) || previous.size >= intent.max) return previous;
      return new Set([...previous, item.id]);
    });
  }, [acceptPreview]);

  const choose = (keys: Selection) => {
    if (!intent) return;
    setFeedback('');
    const next = explicitSelection(keys, candidates);
    if (intent.max === 1) {
      const additions = [...next].filter(id => !chosen.has(id));
      setChosen(new Set((additions.length ? additions : [...next]).slice(-1)));
    } else if (next.size <= intent.max) setChosen(next);
    else setFeedback(`Vous pouvez choisir ${intent.max} médias pour ce rôle.`);
  };
  const openPicker = (role: SelectionIntent) => {
    lastRole.current = keyFor(role); setIntent(role); setChosen(new Set((drafts[keyFor(role)] ?? []).filter(id => byId.has(id)))); setQuery(''); setFeedback('');
  };
  const move = (id: string, delta: number) => {
    const ids = [...chosen]; const index = ids.indexOf(id); const next = index + delta;
    if (next < 0 || next >= ids.length) return;
    [ids[index], ids[next]] = [ids[next], ids[index]]; setChosen(new Set(ids));
  };
  const close = () => { if (intent) setIntent(null); else onClose(); };
  const manifest = target?.roles.flatMap(role => (drafts[keyFor(role)] ?? []).map(id => byId.get(id)).filter((item): item is MediaItem => Boolean(item)).map(item => ({ role: role.role, ref: item.ref, name: item.name }))) ?? [];
  const complete = Boolean(target && target.roles.every(role => (drafts[keyFor(role)] ?? []).some(id => byId.has(id))));

  return <dialog ref={ref} className={`tool-dialog ${intent ? 'picker-dialog' : ''}`} aria-label={intent?.title ?? target?.name ?? 'Utiliser dans un outil'} onCancel={event => { event.preventDefault(); close(); }}>
    <header className="dialog-heading">
      <div className="dialog-heading-text"><span className="eyebrow">{intent ? `${target?.name} · ${intent.max === 1 ? 'un média' : `${intent.max} places`}` : 'Préparation · simulation locale'}</span><h2>{intent?.title ?? target?.name ?? 'Utiliser dans…'}</h2></div>
      <button type="button" className="icon-button" aria-label={intent ? 'Revenir à l’outil' : 'Fermer les outils'} onClick={close}><X size={20}/></button>
    </header>
    {!target ? <div className="destination-list">{TARGETS.map(destination => {
      const compatible = activeInitialItems.length === 0 || activeInitialItems.some(item => destination.roles.some(role => role.kinds.includes(item.kind)));
      return <button type="button" key={destination.id} disabled={!compatible} onClick={() => { setTargetId(destination.id); setPrepared(false); }}><span className="destination-icon">{destination.id === 'subtitles' ? <Music2 size={19}/> : destination.id === 'image-references' || destination.id === 'angle' ? <ImageIcon size={19}/> : <Film size={19}/>}</span><span><b>{destination.name}</b><small>{destination.description}</small></span><ArrowRight size={16}/></button>;
    })}</div> : intent ? <>
      <div className="picker-search-row"><label className="search-field"><Search size={16}/><input type="search" aria-label="Rechercher dans le sélecteur" placeholder="Rechercher dans vos médias" value={query} onChange={event => setQuery(event.target.value)}/></label><button type="button" className="button quiet" onClick={onImport}><Upload size={15}/><span>Importer</span></button><span className="result-count">{formatCount(candidates.length)} médias</span></div>
      <MediaGrid items={candidates} selected={chosen} onSelectionChange={choose} onOpen={item => onPreview(item, candidates)} density={112} selectionOnly label={`Médias pour ${intent.title}`}/>
      <footer className="picker-footer">
        <div className="reference-basket" aria-label="Panier de références">{current.length ? current.map((item, index) => <div key={item.id} className="basket-item"><span className="basket-order">{index + 1}</span>{item.thumbUrl ? <img src={item.thumbUrl} alt=""/> : <Music2 size={17}/>}<span title={item.name}>{item.name}</span>{intent.max > 1 && <><button type="button" aria-label={`Déplacer ${item.name} avant`} disabled={index === 0} onClick={() => move(item.id, -1)}><ArrowLeft size={12}/></button><button type="button" aria-label={`Déplacer ${item.name} après`} disabled={index === current.length - 1} onClick={() => move(item.id, 1)}><ArrowRight size={12}/></button></>}<button type="button" aria-label={`Retirer ${item.name} du panier`} onClick={() => setChosen(new Set([...chosen].filter(id => id !== item.id)))}><X size={12}/></button></div>) : <span className="muted">Choisissez {intent.max === 1 ? 'un média' : `jusqu’à ${intent.max} médias`}.</span>}</div>
        <div className="picker-footer-actions"><span role="status">{feedback || `${current.length} / ${intent.max} sélectionné${current.length > 1 ? 's' : ''}`}</span><button type="button" className="button quiet" onClick={() => setIntent(null)}>Annuler</button><button type="button" className="button primary" disabled={!current.length} onClick={() => { setDrafts(previous => ({ ...previous, [keyFor(intent)]: current.map(item => item.id) })); setIntent(null); setPrepared(false); }}>Utiliser {current.length || ''} {current.length === 1 ? 'média' : 'médias'}</button></div>
      </footer>
    </> : <div className="tool-workspace">
      <button type="button" className="text-button" onClick={() => setTargetId(null)}><ChevronLeft size={15}/> Tous les outils</button>
      {activeInitialItems.length > 0 && <div className="handoff-notice"><b>{activeInitialItems.length} média{activeInitialItems.length > 1 ? 's' : ''} à affecter</b><span>Choisissez son rôle ci-dessous. Votre préparation actuelle reste disponible.</span></div>}
      <div className="tool-roles">{target.roles.map(role => {
        const values = (drafts[keyFor(role)] ?? []).map(id => byId.get(id)).filter((item): item is MediaItem => Boolean(item));
        const incoming = activeInitialItems.filter(item => role.kinds.includes(item.kind));
        return <section key={role.role} className="tool-role"><div className="role-title"><b>{role.role === 'audio' ? 'Piste audio' : role.role === 'motion' ? 'Vidéo de mouvement' : role.role === 'reference' ? 'Images de référence' : role.role === 'timeline' ? 'Médias de la séquence' : 'Média source'}</b><span>{role.kinds.map(kind => KIND_LABELS[kind]).join(' / ')} · {role.max === 1 ? '1 fichier' : `${role.max} maximum dans cet essai`}</span></div>
          {values.length ? <div className="role-items">{values.map(item => <div key={item.id}>{item.thumbUrl ? <img src={item.thumbUrl} alt=""/> : <Music2 size={24}/>}<span>{item.name}</span></div>)}</div> : <div className="role-empty"><Plus size={20}/><span>Aucun média choisi</span></div>}
          <div className="role-actions"><button type="button" className="button quiet" data-role-key={keyFor(role)} onClick={() => openPicker(role)}>{values.length ? 'Modifier dans Media' : 'Choisir dans Media'}</button>{incoming.length > 0 && <button type="button" className="button" onClick={() => { setDrafts(previous => ({ ...previous, [keyFor(role)]: incoming.slice(0, role.max).map(item => item.id) })); setPrepared(false); }}>{values.length ? 'Remplacer avec la sélection' : 'Utiliser la sélection'}{incoming.length > role.max ? ` (${role.max}/${incoming.length})` : ''}</button>}</div>
        </section>;
      })}</div>
      <div className="tool-confirm"><span className="muted">Cet essai prépare les sources. Aucun modèle n’est exécuté.</span><button type="button" className="button primary" disabled={!complete} onClick={() => setPrepared(true)}><Check size={15}/> Valider cette préparation</button></div>
      {prepared && <div className="prepared-receipt" role="status"><Check size={18}/><div><b>Préparation simulée enregistrée</b><span>{manifest.length} média{manifest.length > 1 ? 's' : ''} affecté{manifest.length > 1 ? 's' : ''} aux bons rôles. Vous pouvez fermer puis retrouver cette préparation.</span><details><summary>Inspecter le raccord du prototype</summary><pre>{JSON.stringify(manifest, null, 2)}</pre></details></div></div>}
    </div>}
  </dialog>;
}
