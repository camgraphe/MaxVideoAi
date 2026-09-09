'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { MediaActionPanel } from '@/components/library/MediaActionPanel.client';
import { MediaDialog } from '@/components/library/MediaDialog.client';
import { MediaDestinationActions } from '@/components/library/MediaDestinationActions.client';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { copyTextToClipboard } from '@/lib/clipboard';
import { suggestDownloadFilename, triggerAppDownload } from '@/lib/download';
import { MediaLightboxEntryCard } from '@/components/media-lightbox/MediaLightboxEntryCard';
import type {
  MediaLightboxEntry,
  MediaLightboxLibraryState,
  MediaLightboxLoadingState,
  MediaLightboxProps,
} from '@/components/media-lightbox/media-lightbox-types';

export type {
  MediaLightboxEntry,
  MediaLightboxProps,
} from '@/components/media-lightbox/media-lightbox-types';

export function MediaLightbox({
  title,
  subtitle,
  prompt,
  metadata = [],
  entries,
  onClose,
  onRefreshEntry,
  onSaveToLibrary,
  onRemixEntry,
  remixLabel,
  onUseTemplate,
  templateLabel,
}: MediaLightboxProps) {
  const { t, locale } = useI18n();
  const [selectedId, setSelectedId] = useState(entries[0]?.id);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [refreshStates, setRefreshStates] = useState<Record<string, MediaLightboxLoadingState>>({});
  const [downloadStates, setDownloadStates] = useState<Record<string, MediaLightboxLoadingState>>({});
  const [libraryStates, setLibraryStates] = useState<Record<string, MediaLightboxLibraryState>>({});

  const handleCopyLink = useCallback(
    async (entryId: string, url?: string | null) => {
      if (!url) return;
      const copied = await copyTextToClipboard(url);
      if (copied) {
        setCopiedId(entryId);
        window.setTimeout(() => setCopiedId((current) => (current === entryId ? null : current)), 1800);
      } else {
        setCopiedId((current) => (current === entryId ? null : current));
      }
    },
    []
  );

  const handleDownloadEntry = useCallback(async (entry: MediaLightboxEntry, url?: string | null) => {
    if (!url) return;
    setDownloadStates((prev) => ({
      ...prev,
      [entry.id]: { loading: true, error: null },
    }));
    try {
      const safeLabel =
        entry.label?.trim().replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') ||
        (entry.jobId ?? entry.id ?? 'download');
      triggerAppDownload(url, suggestDownloadFilename(url, safeLabel));
      setDownloadStates((prev) => {
        const next = { ...prev };
        delete next[entry.id];
        return next;
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to download file';
      setDownloadStates((prev) => ({
        ...prev,
        [entry.id]: { loading: false, error: message },
      }));
    }
  }, []);

  useEffect(() => {
    setRefreshStates((prev) => {
      const activeIds = new Set(entries.map((entry) => entry.id));
      let mutated = false;
      const next = { ...prev };
      Object.keys(next).forEach((key) => {
        if (!activeIds.has(key)) {
          delete next[key];
          mutated = true;
        }
      });
      return mutated ? next : prev;
    });
  }, [entries]);

  useEffect(() => {
    setDownloadStates((prev) => {
      const activeIds = new Set(entries.map((entry) => entry.id));
      let mutated = false;
      const next = { ...prev };
      Object.keys(next).forEach((key) => {
        if (!activeIds.has(key)) {
          delete next[key];
          mutated = true;
        }
      });
      return mutated ? next : prev;
    });
  }, [entries]);

  useEffect(() => {
    setLibraryStates((prev) => {
      const activeIds = new Set(entries.map((entry) => entry.id));
      let mutated = false;
      const next = { ...prev };
      Object.keys(next).forEach((key) => {
        if (!activeIds.has(key)) {
          delete next[key];
          mutated = true;
        }
      });
      return mutated ? next : prev;
    });
  }, [entries]);

  const handleRefreshEntry = useCallback(
    async (entry: MediaLightboxEntry) => {
      if (!onRefreshEntry) return;
      setRefreshStates((prev) => ({
        ...prev,
        [entry.id]: { loading: true, error: null },
      }));
      try {
        await onRefreshEntry(entry);
        setRefreshStates((prev) => {
          const next = { ...prev };
          delete next[entry.id];
          return next;
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to refresh status';
        setRefreshStates((prev) => ({
          ...prev,
          [entry.id]: { loading: false, error: message },
        }));
      }
    },
    [onRefreshEntry]
  );

  const handleSaveEntryToLibrary = useCallback(
    async (entry: MediaLightboxEntry, mediaUrl?: string | null) => {
      if (!onSaveToLibrary || !mediaUrl) return;
      setLibraryStates((prev) => ({
        ...prev,
        [entry.id]: { loading: true, success: false, error: null },
      }));
      try {
        await onSaveToLibrary(entry);
        setLibraryStates((prev) => ({
          ...prev,
          [entry.id]: { loading: false, success: true, error: null },
        }));
        window.setTimeout(() => {
          setLibraryStates((prev) => {
            const next = { ...prev };
            if (next[entry.id]?.success) {
              delete next[entry.id];
            }
            return next;
          });
        }, 2500);
      } catch (error) {
        setLibraryStates((prev) => ({
          ...prev,
          [entry.id]: {
            loading: false,
            success: false,
            error: error instanceof Error ? error.message : 'Unable to save image',
          },
        }));
      }
    },
    [onSaveToLibrary]
  );

  const specs = useMemo(() => {
    const next: Array<{ label: string; value: string }> = [];
    if (title) {
      next.push({ label: 'Group', value: title });
    }
    if (subtitle) {
      next.push({ label: 'Created', value: subtitle });
    }
    const existing = new Set(next.map((item) => item.label.toLowerCase()));
    metadata.forEach((item) => {
      const key = item.label.toLowerCase();
      if (!existing.has(key)) {
        next.push(item);
        existing.add(key);
      }
    });
    return next;
  }, [metadata, subtitle, title]);

  const entry = entries.find(item => item.id === selectedId) ?? entries[0];
  const fr = locale.startsWith('fr'), es = locale.startsWith('es');
  const outputLabel = fr ? 'Sortie' : es ? 'Resultado' : 'Output';
  const navigation = entries.length > 1 ? <div role="group" aria-label={outputLabel}>{entries.map((item, index) => <button type="button" key={item.id} aria-pressed={item.id === entry?.id} onClick={() => setSelectedId(item.id)}>{outputLabel} {index + 1}</button>)}</div> : null;
  const heading = entry?.engineLabel || t('workspace.result.title', 'Result') || 'Result';
  const closeLabel = t('workspace.result.close', 'Close') || 'Close';
  const url = entry?.videoUrl || entry?.audioUrl || entry?.imageUrl;
  if (entry && url && entry.status !== 'pending' && entry.status !== 'failed') {
    const kind = entry.videoUrl ? 'video' : entry.audioUrl ? 'audio' : 'image';
    const asset = { id: entry.id, jobId: entry.jobId, url, kind, thumbUrl: entry.thumbUrl, durationSec: entry.durationSec, source: entry.jobId ? 'gallery' : undefined } as const;
    const libraryState = libraryStates[entry.id];
    return <MediaActionPanel asset={asset} locale={locale} title={heading} onClose={onClose} navigation={navigation} details={<>
      {entry.prompt || prompt ? <p>{entry.prompt || prompt}</p> : null}
      <dl>{specs.filter(item => !['group', 'batch', 'render id'].includes(item.label.toLowerCase())).map(item => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>
    </>}>
      <LightboxDestinations key={entry.id} sourceEngineId={entry.engineId} asset={asset} locale={locale} onNavigate={onClose} />
      {onRemixEntry ? <button type="button" onClick={() => onRemixEntry(entry)}>{remixLabel || (fr ? 'Reprendre les paramètres' : es ? 'Reutilizar ajustes' : 'Reuse settings')}</button> : null}
      {onUseTemplate ? <button type="button" onClick={() => onUseTemplate(entry)}>{templateLabel || (fr ? 'Utiliser ce modèle' : es ? 'Usar plantilla' : 'Use template')}</button> : null}
      {onSaveToLibrary ? <button type="button" disabled={libraryState?.loading || libraryState?.success} onClick={() => void handleSaveEntryToLibrary(entry, url)}>{libraryState?.success ? (fr ? 'Enregistré' : es ? 'Guardado' : 'Saved') : libraryState?.loading ? '…' : (fr ? 'Enregistrer dans Médias' : es ? 'Guardar en Medios' : 'Save to Media')}</button> : null}
      {libraryState?.error ? <p role="alert">{libraryState.error}</p> : null}
    </MediaActionPanel>;
  }
  return <MediaDialog title={heading} closeLabel={closeLabel} onClose={onClose} navigation={navigation}>
    {entry ? <MediaLightboxEntryCard key={entry.id} entry={entry} index={0} title={title} subtitle={subtitle} prompt={prompt} detailSpecsBase={specs}
      copiedId={copiedId} downloadState={downloadStates[entry.id]} libraryState={libraryStates[entry.id]} refreshState={refreshStates[entry.id]}
      onCopyLink={(id, mediaUrl) => { void handleCopyLink(id, mediaUrl); }}
      onDownloadEntry={(target, mediaUrl) => { void handleDownloadEntry(target, mediaUrl); }}
      onRefreshEntry={onRefreshEntry ? target => { void handleRefreshEntry(target); } : undefined}
    /> : <p>{fr ? 'Aucun média disponible.' : es ? 'No hay medios disponibles.' : 'No media available.'}</p>}
  </MediaDialog>;
}

function LightboxDestinations(props: Omit<Parameters<typeof MediaDestinationActions>[0], 'userId'>) {
  const { user } = useRequireAuth({ redirectIfLoggedOut: false });
  return <MediaDestinationActions {...props} userId={user?.id} />;
}
