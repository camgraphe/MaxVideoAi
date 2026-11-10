import { useMemo, useState } from 'react';
import { ArrowUpRight, Check, Clock3, CircleAlert, Search, X } from 'lucide-react';
import { activityOrigins, activityStatuses, type DemoActivity } from '../activity-fixtures';
import { displayMediaLabel, type DemoAsset } from '../fixtures';
import { Sheet } from './Primitives';

const date = new Intl.DateTimeFormat('fr',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Madrid'});
function Status({status}: {status:DemoActivity['status']}) {
  const Icon=status==='completed'?Check:status==='pending'?Clock3:CircleAlert;
  return <span className="activity-status" data-status={status}><Icon size={14}/>{activityStatuses[status]}</span>;
}

export function Activity({events,onDetails,onResults}: {events:DemoActivity[];onDetails:(event:DemoActivity)=>void;onResults:(event:DemoActivity)=>void}) {
  const [query,setQuery]=useState('');
  const [status,setStatus]=useState('all');
  const [origin,setOrigin]=useState('all');
  const [limit,setLimit]=useState(24);
  const filtered=useMemo(()=>events.filter(event=>(status==='all'||event.status===status)&&(origin==='all'||event.origin===origin)&&`${event.prompt} ${event.model} ${event.originLabel}`.toLocaleLowerCase('fr').includes(query.toLocaleLowerCase('fr'))),[events,status,origin,query]);
  return <section className="activity-page" aria-label="Journal des générations">
    <header className="activity-heading"><div><h1>Activité</h1><p>Suivez vos générations et reprenez là où vous en étiez.</p></div><span>{events.filter(e=>e.status==='pending').length} en cours</span></header>
    <div className="activity-filters"><label className="search"><Search size={17}/><span className="sr-only">Rechercher une génération</span><input type="search" placeholder="Prompt, modèle…" value={query} onChange={e=>{setQuery(e.target.value);setLimit(24);}}/>{query?<button className="icon-button" aria-label="Effacer la recherche d’activité" onClick={()=>setQuery('')}><X size={16}/></button>:null}</label><label><span className="sr-only">État des générations</span><select value={status} onChange={e=>{setStatus(e.target.value);setLimit(24);}}>{Object.entries(activityStatuses).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><label><span className="sr-only">Origine des générations</span><select value={origin} onChange={e=>{setOrigin(e.target.value);setLimit(24);}}>{Object.entries(activityOrigins).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label></div>
    <div className="activity-list" role="list" aria-label="Générations">
      {filtered.slice(0,limit).map(event=><article className="activity-row" role="listitem" data-activity-id={event.id} key={event.id}>
        <time dateTime={event.createdAt}>{date.format(new Date(event.createdAt))}</time><Status status={event.status}/>
        <button className="activity-description" onClick={()=>onDetails(event)} aria-label={`Détails : ${event.prompt}`}><strong>{event.tool||event.model}</strong><span>{event.prompt}</span></button>
        <span className="activity-origin">{event.originLabel}</span>
        <button className="activity-result" onClick={()=>event.outputIds.length?onResults(event):onDetails(event)}>{event.outputIds.length?`${event.outputIds.length} média${event.outputIds.length>1?'s':''}`:'Détails'}<ArrowUpRight size={15}/></button>
      </article>)}
      {!filtered.length?<p className="activity-empty">Aucune génération ne correspond à ces filtres.</p>:null}
      {filtered.length>limit?<button className="control activity-more" onClick={()=>setLimit(n=>n+24)}>Charger les générations précédentes</button>:null}
    </div>
    <p className="activity-footnote">{Math.min(limit,filtered.length)} sur {filtered.length} générations · Vos fichiers se retrouvent dans Médias.</p>
  </section>;
}

export function ActivityDetails({event,assets,onClose,onResults,onResume,onProject}: {event:DemoActivity|null;assets:DemoAsset[];onClose:()=>void;onResults:(event:DemoActivity)=>void;onResume:(event:DemoActivity)=>void;onProject:(event:DemoActivity)=>void}) {
  if(!event)return null;
  const outputs=assets.filter(a=>event.outputIds.includes(a.id));
  return <Sheet label="Détails de la génération" open onClose={onClose} className="activity-detail-sheet"><div className="editor activity-details">
    <Status status={event.status}/><h3>{event.tool||event.model}</h3><p>{event.prompt}</p>
    <dl><dt>Origine</dt><dd>{event.originLabel}</dd><dt>Modèle</dt><dd>{event.model}</dd><dt>Lancée le</dt><dd>{date.format(new Date(event.createdAt))}</dd><dt>Résultats</dt><dd>{outputs.length} média{outputs.length>1?'s':''}</dd></dl>
    {event.status==='pending'?<p>La génération est en cours. Ses résultats apparaîtront ici une fois disponibles.</p>:event.status==='failed'?<p>Cette génération n’a pas produit de résultat. Vous pouvez rouvrir ses réglages.</p>:null}
    {outputs.length?<><div className="activity-output-preview">{outputs.map(asset=><span key={asset.id} data-media-key={asset.id}>{asset.thumbUrl?<img src={asset.thumbUrl} alt={displayMediaLabel(asset)}/>:<span>Audio</span>}{asset.trashed?<small>Corbeille</small>:null}</span>)}</div><button className="primary" onClick={()=>onResults(event)}>Voir {outputs.length} média{outputs.length>1?'s':''} dans la bibliothèque<ArrowUpRight size={16}/></button></>:null}
    {event.project?<button className="control" onClick={()=>onProject(event)}>Ouvrir le projet Studio<ArrowUpRight size={16}/></button>:null}
    {event.status!=='pending'?<button className="control" onClick={()=>onResume(event)}>{event.tool?`Reprendre dans ${event.tool}`:'Reprendre dans Créer'}<ArrowUpRight size={16}/></button>:null}
  </div></Sheet>;
}
