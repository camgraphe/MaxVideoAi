import { ArrowLeft, ArrowRight, Download, ExternalLink, Maximize2, Star } from 'lucide-react';
import type { DemoAsset } from '../fixtures';
import { kindLabels, sources, isEligible } from '../fixtures';
import { Sheet } from './Primitives';
export function Viewer({asset, picker, onClose, onNavigate, onConfirm, onTool, notify}: {asset: DemoAsset | null; picker: boolean; onClose: () => void; onNavigate: (offset: number) => void; onConfirm: () => void; onTool: (tool: string) => void; notify: (message: string) => void}) {
  return <Sheet label="Aperçu du média" open={Boolean(asset)} onClose={onClose} className="viewer-sheet">{asset ? <>
    <div className="viewer-main"><div className="viewer-stage">
      {asset.kind === 'audio' ? <div className="audio-preview"><h3>{asset.name}</h3><audio controls preload="none" src="/assets/app-starters/electro-funk-c1a8c5151e60.mp3"/><p>Extrait de démonstration · lecture manuelle</p></div> : asset.kind === 'video' ? <video controls preload="none" poster={asset.thumbUrl ?? undefined} src="/assets/tools/creator-results/motion-result-ff2f69acbaf9.mp4"/> : <img src={asset.thumbUrl ?? undefined} alt={asset.name}/>}
      <div className="viewer-navigation"><button className="icon-button" aria-label="Média précédent" onClick={() => onNavigate(-1)}><ArrowLeft size={19}/></button><span>Format entier</span><button className="icon-button" aria-label="Média suivant" onClick={() => onNavigate(1)}><ArrowRight size={19}/></button></div>
    </div><aside className="viewer-details"><span className="eyebrow">{kindLabels[asset.kind]} · Démonstration</span><h3>{asset.name}</h3><dl><dt>Provenance</dt><dd>{sources[asset.source as keyof typeof sources]}</dd><dt>Dimensions</dt><dd>{asset.width && asset.height ? `${asset.width} × ${asset.height}` : 'Audio'}</dd><dt>Durée</dt><dd>{asset.durationSec ? `${asset.durationSec} secondes` : '—'}</dd><dt>Créé le</dt><dd>9 novembre 2026</dd><dt>Enregistrement</dt><dd>{asset.saved ? 'Enregistré' : 'Rendu récent'}</dd></dl>
      <button className="control" onClick={() => notify('Téléchargement de l’original · simulé dans la démo')}><Download size={17}/>Télécharger l’original</button><button className="control" onClick={() => notify('Ouverture du job ou import d’origine · simulée')}><ExternalLink size={17}/>Ouvrir la source</button><button className="control" onClick={() => notify('Favori · simulation locale')}><Star size={17}/>Ajouter aux favoris</button>
      <div className="section-label">Continuer avec ce média</div>{['Créer une vidéo','Créer une image','Character Studio','Storyboard','Angle','Upscale','Studio'].map(tool => <button className="destination" key={tool} onClick={() => onTool(tool)}>{tool}<ExternalLink size={14}/></button>)}
    </aside></div>
    {picker ? <div className="viewer-footer"><span>{isEligible(asset) ? 'Image utilisable comme référence' : 'Ce modèle accepte uniquement les images pour cette destination.'}</span><button className="primary" disabled={!isEligible(asset)} onClick={onConfirm}>Ajouter cette référence</button></div> : null}
  </> : null}</Sheet>;
}
