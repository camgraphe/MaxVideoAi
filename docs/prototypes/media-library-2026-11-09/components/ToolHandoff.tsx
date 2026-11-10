import { useState } from 'react';
import { Check, Film, Sparkles } from 'lucide-react';
import type { DemoActivity } from '../activity-fixtures';
import { displayMediaLabel, kindLabels, type DemoAsset } from '../fixtures';
import { Field, Sheet } from './Primitives';

export type ToolIntent = { name:string; assets:DemoAsset[]; activity?:DemoActivity; projectOnly?:boolean };

/** Reviewable local handoff: retains the selected record; never sends an API request. */
export function ToolHandoff({intent,onClose,onLibrary}: {intent:ToolIntent;onClose:()=>void;onLibrary:()=>void}) {
  const [applied,setApplied]=useState(false);
  const [placement,setPlacement]=useState('append');
  const studio=intent.name==='Studio';
  const sharing=intent.name==='Partager';
  return <Sheet label={studio&&intent.projectOnly?'Projet Studio':intent.name} open onClose={onClose} className="handoff-sheet"><div className="editor handoff-editor">
    {studio?<Film size={26}/>:<Sparkles size={26}/>}
    <h3>{intent.projectOnly?intent.activity?.project:intent.name}</h3>
    {intent.activity?<><p className="eyebrow">{intent.projectOnly?'Génération liée au projet':'Reprendre cette génération'}</p><p>{intent.activity.prompt}</p>{intent.activity.model!=='Modèle non renseigné'?<p>Modèle : {intent.activity.model}</p>:null}</>:null}
    {intent.assets.length?<><p>{intent.projectOnly?'Résultats associés':intent.activity?'Résultats de la génération précédente':'Média à utiliser'}</p><div className="handoff-assets">{intent.assets.map(asset=><div className="handoff-asset" data-media-key={asset.id} key={asset.id}>{asset.thumbUrl?<img src={asset.thumbUrl} alt=""/>:<span className="handoff-audio">♪</span>}<div><strong>{displayMediaLabel(asset)}</strong><span>{kindLabels[asset.kind]} · {asset.kind==='audio'?`${asset.durationSec} s`:`${asset.width} × ${asset.height}`}</span></div></div>)}</div></>:<p>{intent.projectOnly?'Le résultat de cette génération apparaîtra dans ce projet une fois disponible.':'Choisissez un média pour préparer cet outil.'}</p>}
    {studio&&!intent.projectOnly&&intent.assets.length?<><Field label="Choisir un film"><select defaultValue="demo-film"><option value="demo-film">Film de démonstration</option></select></Field><Field label="Placement"><select value={placement} onChange={e=>{setPlacement(e.target.value);setApplied(false);}}><option value="append">Ajouter à la fin</option><option value="replace">Remplacer un clip</option></select></Field>{placement==='replace'?<Field label="Clip à remplacer"><select><option>Plan 01 · 0:00–0:05</option><option>Plan 02 · 0:05–0:10</option></select></Field>:null}<button className="primary" onClick={()=>setApplied(true)}>{applied?<><Check size={16}/>Modification simulée</>:'Appliquer au film · démo'}</button></>:sharing?<><p>Préparez le partage de ce média après avoir choisi sa visibilité.</p><button className="primary" disabled>Partage désactivé dans le prototype</button></>:!intent.projectOnly?<><Field label="Instructions"><textarea defaultValue={intent.activity?.prompt??''} placeholder="Décrivez le résultat souhaité…"/></Field>{intent.assets.length||intent.activity?<button className="primary" disabled>Génération désactivée dans le prototype</button>:<button className="control" onClick={onLibrary}>Choisir depuis les médias</button>}</>:null}
    <p className="subtle">Simulation locale · aucun projet modifié, aucune génération lancée.</p>
  </div></Sheet>;
}
