'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authFetch } from '@/lib/authFetch';
import { AppGlyph } from '@/components/app/AppGlyph';
import { stageMediaHandoff, supportsMediaDestination, MEDIA_TOOL_DESTINATIONS, type MediaDestination } from '@/lib/media-handoff';
import { mediaActionCopy } from './media-action-copy';
import type { AssetBrowserAsset } from './AssetLibraryBrowser';
export function MediaDestinationActions({ asset, userId, locale, onNavigate, sourceEngineId }: { asset: AssetBrowserAsset; userId?: string | null; locale: string; onNavigate?: () => void; sourceEngineId?: string | null }) {
  const router = useRouter();
  const copy = mediaActionCopy(locale);
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(false);
  const scope = JSON.stringify([userId, asset.id, asset.url]);
  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  if (!userId) return null;
  const open = async (destination: MediaDestination, extend = false) => {
    setPending(true); setError(false);
    try {
      let original = asset;
      if (asset.source === 'gallery') {
        const params = new URLSearchParams({ kind: asset.kind, jobId: asset.jobId ?? '', limit: '60' });
        const response = await authFetch(`/api/media-library/recent-outputs?${params}`, { signal: AbortSignal.timeout(10_000) });
        const payload = await response.json();
        const found = response.ok && payload?.ok && Array.isArray(payload.outputs) ? payload.outputs.find((entry: AssetBrowserAsset & { status?: string }) => entry.url === asset.url && entry.kind === asset.kind && ['ready', 'completed', 'succeeded'].includes(entry.status ?? '')) : null;
        if (!found) throw new Error('Original is not ready');
        original = { ...asset, ...found, url: asset.url, sourceOutputId: found.id, source: 'recent' };
      }
      if (!active.current || scopeRef.current !== scope) return;
      let suffix = '';
      if (extend) {
        const [{ listFalEngines }, { resolveRuntimeEngineInput }] = await Promise.all([import('@/config/falEngines'), import('@/config/model-runtime')]);
        const available = listFalEngines().filter(entry => {
          const runtime = resolveRuntimeEngineInput(entry.id);
          // Veo extension expects a Veo source. Unknown uploads use a general clip extender.
          return entry.engine.modes.includes('extend') && entry.engine.availability !== 'paused' && runtime?.lifecycle === 'current' && runtime.publication.app.published && (!entry.id.startsWith('veo-') || sourceEngineId?.startsWith('veo-'));
        });
        const model = available.find(entry => entry.id === sourceEngineId) ?? available.find(entry => entry.id === 'seedance-2-5') ?? available[0];
        if (!model) throw new Error('No extension model available');
        suffix = `&engine=${encodeURIComponent(model.id)}&mode=extend`;
      }
      if (!active.current || scopeRef.current !== scope) return;
      router.push(stageMediaHandoff(window.sessionStorage, userId, original, destination, crypto.randomUUID()) + suffix); onNavigate?.();
    } catch { if (active.current && scopeRef.current === scope) setError(true); }
    finally { if (active.current && scopeRef.current === scope) setPending(false); }
  };
  const fr = locale.startsWith('fr'), es = locale.startsWith('es');
  const toolLabels = fr ? ['Agrandir', 'Changer l’angle', 'Retirer le fond', 'Restaurer', 'Réduire le bruit', 'Corriger le flou', 'Fluidifier'] : es ? ['Ampliar', 'Cambiar ángulo', 'Quitar fondo', 'Restaurar', 'Reducir ruido', 'Corregir desenfoque', 'Suavizar movimiento'] : ['Upscale', 'Change angle', 'Remove background', 'Restore video', 'Denoise', 'Fix motion blur', 'Smooth motion'];
  const toolButton = (destination: typeof MEDIA_TOOL_DESTINATIONS[number]) => <button key={destination} type="button" disabled={pending} onClick={() => void open(destination)}><AppGlyph name="tools" /><span>{toolLabels[MEDIA_TOOL_DESTINATIONS.indexOf(destination)]}</span></button>;
  return <div className="app-media-destinations">
    <button type="button" disabled={pending} onClick={() => void open('video')}><AppGlyph name="video" /><span>{asset.kind === 'image' ? copy.animate : (fr ? 'Utiliser comme référence' : es ? 'Usar como referencia' : 'Use as reference')}</span></button>
    {asset.kind === 'video' ? <button type="button" disabled={pending} onClick={() => void open('video', true)}><AppGlyph name="video" /><span>{fr ? 'Prolonger la vidéo' : es ? 'Extender vídeo' : 'Extend video'}</span></button> : null}
    {supportsMediaDestination(asset, 'image') ? <button type="button" disabled={pending} onClick={() => void open('image')}><AppGlyph name="image" /><span>{fr ? 'Créer à partir de cette image' : es ? 'Crear con esta imagen' : 'Create with this image'}</span></button> : null}
    {supportsMediaDestination(asset, 'upscale') ? toolButton('upscale') : null}
    {asset.kind !== 'audio' ? <details><summary>{fr ? 'Plus d’outils' : es ? 'Más herramientas' : 'More tools'}</summary><div>{MEDIA_TOOL_DESTINATIONS.filter(destination => destination !== 'upscale' && supportsMediaDestination(asset, destination)).map(toolButton)}</div></details> : null}
    {pending ? <span role="status">{fr ? 'Préparation…' : es ? 'Preparando…' : 'Preparing…'}</span> : null}
    {error ? <p role="alert">{copy.error}</p> : null}
  </div>;
}
