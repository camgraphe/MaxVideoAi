'use client';
import { useState } from 'react';
import { Download, BookmarkPlus } from 'lucide-react';
import { ToolEmptyPreview } from './ToolWorkbench';
import { toolboxCopy, type ToolboxVisualId } from './toolbox-copy';
export function ToolboxVideoPreview({ locale, sourceUrl, result, viewMode, onViewModeChange, onSave, onDownload, visual = 'background-removal', sourceThumbnailUrl }: { locale: string; sourceUrl: string; result: { output?: { url?: string; thumbnailUrl?: string | null } | null } | null; viewMode: 'source' | 'result'; onViewModeChange: (mode: 'source' | 'result') => void; onSave: () => void; onDownload: () => void; visual?: ToolboxVisualId; sourceThumbnailUrl?: string | null }) {
  const copy = toolboxCopy(locale);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const url = viewMode === 'result' ? result?.output?.url || sourceUrl : sourceUrl;
  if (!url) return <ToolEmptyPreview locale={locale} visual={visual} />;
  return <div className="overflow-hidden rounded-2xl border border-border bg-surface">
    <div className="flex flex-wrap items-center justify-between gap-2 p-3"><div className="flex gap-1">{(['source', 'result'] as const).map(mode => <button type="button" key={mode} aria-pressed={viewMode === mode} disabled={mode === 'result' ? !result?.output?.url : !sourceUrl} className={`rounded-lg px-4 text-xs ${viewMode === mode ? 'bg-brand text-on-brand' : 'text-text-secondary'}`} onClick={() => onViewModeChange(mode)}>{mode === 'source' ? copy.original : copy.result}</button>)}</div><div className="flex gap-1"><button type="button" disabled={!result?.output?.url} aria-label={locale === 'fr' ? 'Enregistrer' : locale === 'es' ? 'Guardar' : 'Save'} title={locale === 'fr' ? 'Enregistrer' : 'Save'} className="grid w-11 place-items-center rounded-lg border border-border" onClick={onSave}><BookmarkPlus className="h-4 w-4" /></button><button type="button" aria-label={locale === 'fr' ? 'Télécharger' : locale === 'es' ? 'Descargar' : 'Download'} title={locale === 'fr' ? 'Télécharger' : 'Download'} className="grid w-11 place-items-center rounded-lg border border-border" onClick={onDownload}><Download className="h-4 w-4" /></button></div></div>
    <div className="relative aspect-video bg-[conic-gradient(#b2b4ae_25%,#d6d7d0_0_50%,#b2b4ae_0_75%,#d6d7d0_0)] bg-[length:24px_24px]">
      <video key={url} src={url} poster={(viewMode === 'result' ? result?.output?.thumbnailUrl : sourceThumbnailUrl) ?? undefined} preload="none" controls playsInline className="absolute inset-0 h-full w-full object-contain" onError={() => setFailedUrl(url)} />
    </div>
    {failedUrl === url ? <p role="alert" className="p-4 text-xs text-text-secondary">{locale === 'fr' ? 'Ce format ne peut pas être lu ici. Téléchargez le fichier original pour l’ouvrir.' : locale === 'es' ? 'Este formato no se puede reproducir aquí. Descarga el archivo original.' : 'This format cannot be played here. Download the original file to open it.'}</p> : null}
  </div>;
}
