'use client';
import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { ChevronDown } from 'lucide-react';
import { FEATURES } from '@/content/feature-flags';
import { useRouter } from 'next/navigation';
import { authFetch } from '@/lib/authFetch';
import { AppGlyph } from '@/components/app/AppGlyph';
import { stageMediaHandoff, supportsMediaDestination, discoverableMediaToolDestinations, MEDIA_TOOL_DESTINATIONS, type MediaDestination } from '@/lib/media-handoff';
import { creatorCopy } from '@/components/tools/creator/creator-copy';
import { getVideoContinuationEngine, resolveMediaContinuationOriginal, type VideoContinuationMode } from '@/lib/video-continuation';
import { useVideoContinuationEngines } from './useVideoContinuationEngines';
import { mediaActionCopy } from './media-action-copy';
import type { AssetBrowserAsset } from './AssetLibraryBrowser';
const StudioMediaAction = dynamic(() => import('./StudioMediaAction.client').then(module => module.StudioMediaAction));
export function MediaDestinationActions({ asset, userId, locale, onNavigate, sourceEngineId, presentation = 'default' }: { asset: AssetBrowserAsset; userId?: string | null; locale: string; onNavigate?: () => void; sourceEngineId?: string | null; presentation?: 'default' | 'creator' }) {
  const router = useRouter();
  const copy = mediaActionCopy(locale);
  const [action, setAction] = useState<{ scope: string; pending: boolean; error: boolean } | null>(null);
  const engines = useVideoContinuationEngines(userId, asset.kind === 'video');
  const extendEngine = getVideoContinuationEngine(engines, asset, 'extend', sourceEngineId);
  const modifyEngine = getVideoContinuationEngine(engines, asset, 'v2v', sourceEngineId);
  const scope = JSON.stringify([userId, asset.id, asset.url, sourceEngineId]);
  const pending = action?.scope === scope && action.pending;
  const error = action?.scope === scope && action.error;
  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  if (!userId) return null;
  const open = async (destination: MediaDestination, continuation?: VideoContinuationMode) => {
    setAction({ scope, pending: true, error: false });
    try {
      const original = await resolveMediaContinuationOriginal(asset, authFetch);
      if (!active.current || scopeRef.current !== scope) return;
      let suffix = '';
      if (continuation) {
        const model = getVideoContinuationEngine(engines, original, continuation, sourceEngineId);
        if (!model) throw new Error('No continuation model available');
        suffix = `&engine=${encodeURIComponent(model.id)}&mode=${continuation}`;
      }
      if (!active.current || scopeRef.current !== scope) return;
      router.push(stageMediaHandoff(window.sessionStorage, userId, original, destination, crypto.randomUUID()) + suffix); onNavigate?.();
    } catch { if (active.current && scopeRef.current === scope) setAction({ scope, pending: false, error: true }); }
    finally { if (active.current && scopeRef.current === scope) setAction(current => current?.scope === scope ? { ...current, pending: false } : current); }
  };
  const fr = locale.startsWith('fr'), es = locale.startsWith('es');
  const toolLabels = fr ? ['Agrandir', 'Changer l’angle', 'Retirer le fond', 'Restaurer', 'Réduire le bruit', 'Corriger le flou', 'Fluidifier'] : es ? ['Ampliar', 'Cambiar ángulo', 'Quitar fondo', 'Restaurar', 'Reducir ruido', 'Corregir desenfoque', 'Suavizar movimiento'] : ['Upscale', 'Change angle', 'Remove background', 'Restore video', 'Denoise', 'Fix motion blur', 'Smooth motion'];
  const creatorLabels = creatorCopy(locale).titles;
  const destinations = discoverableMediaToolDestinations(asset).filter(destination => destination !== 'upscale');
  const toolButton = (destination: typeof MEDIA_TOOL_DESTINATIONS[number]) => <button key={destination} type="button" disabled={pending} onClick={() => void open(destination)}><AppGlyph name="tools" /><span>{destination in creatorLabels ? creatorLabels[destination as keyof typeof creatorLabels] : toolLabels[MEDIA_TOOL_DESTINATIONS.indexOf(destination)]}</span></button>;
  const primaryTransforms = <>
    <button type="button" disabled={pending} onClick={() => void open('video')}><AppGlyph name="video" /><span>{asset.kind === 'image' ? copy.animate : (fr ? 'Utiliser comme référence' : es ? 'Usar como referencia' : 'Use as reference')}</span></button>
    {extendEngine ? <button type="button" disabled={pending} onClick={() => void open('video', 'extend')}><AppGlyph name="video" /><span>{fr ? 'Prolonger la vidéo' : es ? 'Extender vídeo' : 'Extend video'}</span></button> : null}
    {modifyEngine ? <button type="button" disabled={pending} onClick={() => void open('video', 'v2v')}><AppGlyph name="video" /><span>{fr ? 'Modifier la vidéo' : es ? 'Modificar vídeo' : 'Modify video'}</span></button> : null}
    {supportsMediaDestination(asset, 'image') ? <button type="button" disabled={pending} onClick={() => void open('image')}><AppGlyph name="image" /><span>{fr ? 'Créer à partir de cette image' : es ? 'Crear con esta imagen' : 'Create with this image'}</span></button> : null}
    {supportsMediaDestination(asset, 'upscale') ? toolButton('upscale') : null}
  </>;
  const studio = FEATURES.studio.maxVideoAiEditor && /^ma_[a-f0-9]{32}$/.test(asset.id)
    ? <StudioMediaAction key={scope} locale={locale} reference={{type:'asset',assetId:asset.id,kind:asset.kind}} /> : null;
  const feedback = <>{pending ? <span role="status">{fr ? 'Préparation…' : es ? 'Preparando…' : 'Preparing…'}</span> : null}{error ? <p role="alert">{copy.error}</p> : null}</>;
  if (presentation === 'creator') return <div className="creator-media-destinations">
    {studio ? <div className="creator-studio-action">{studio}</div> : null}
    <details className="creator-other-tools"><summary>{fr ? 'Autres outils' : es ? 'Otras herramientas' : 'Other tools'}<ChevronDown size={16} aria-hidden="true" /></summary>
      <div>{primaryTransforms}{destinations.map(toolButton)}</div>
    </details>
    <div className="creator-media-feedback">{feedback}</div>
  </div>;
  return <div className="app-media-destinations">
    {primaryTransforms}
    {destinations.length ? <details><summary>{fr ? 'Plus d’outils' : es ? 'Más herramientas' : 'More tools'}</summary><div>{destinations.map(toolButton)}</div></details> : null}
    {studio}
    {feedback}
  </div>;
}
