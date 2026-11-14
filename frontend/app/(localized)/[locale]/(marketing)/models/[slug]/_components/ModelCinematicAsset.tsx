import Image from 'next/image';
import type { CinematicAsset, CinematicPresentation } from '../_lib/model-page-cinematic-data';
import { ModelDecisionCopyButton } from './ModelDecisionCopyButton.client';

export function ModelCinematicAsset({ asset, ui, plan, compact = false }: {
  asset: CinematicAsset; ui: CinematicPresentation['ui']; plan?: { motion: string; sound: string }; compact?: boolean;
}) {
  return <figure className={`cinema-asset${compact ? ' cinema-asset--compact' : ''}`}>
    <a className="cinema-asset-image" href={asset.original.url} target="_blank" rel="noopener noreferrer" aria-label={`${ui.original} — ${asset.title}`}>
      <Image src={asset.display.url} width={asset.display.width} height={asset.display.height} alt={asset.title}
        sizes={compact ? '(min-width: 768px) 42vw, 90vw' : '(min-width: 1440px) 1280px, 90vw'} loading="lazy" />
      <span aria-hidden="true">↗</span>
    </a>
    <figcaption><h4>{asset.title}</h4><p>{asset.metadataLabel}</p></figcaption>
    {plan ? <div className="cinema-shot-plan"><p><strong>{ui.motion}</strong>{plan.motion}</p><p><strong>{ui.sound}</strong>{plan.sound}</p></div> : null}
    <ModelCinematicPrompt asset={asset} ui={ui} />
  </figure>;
}

export function ModelCinematicPrompt({ asset, ui }: { asset: CinematicAsset; ui: CinematicPresentation['ui'] }) {
  return <details className="cinema-prompt"><summary>{ui.prompt} — {asset.title}</summary><div>
      <p>{asset.metadataLabel}</p>
      <p className="cinema-eyebrow">{ui.sourcePrompt}</p><p lang="en">{asset.prompt}</p>
      <div className="cinema-actions"><ModelDecisionCopyButton copyText={asset.prompt} label={ui.copy} copiedLabel={ui.copied} /><a href={asset.original.url} target="_blank" rel="noopener noreferrer">{ui.original} ↗</a>
        {asset.source ? <a href={asset.source.original.url} target="_blank" rel="noopener noreferrer">{ui.source} ↗</a> : null}</div>
    </div></details>;
}
