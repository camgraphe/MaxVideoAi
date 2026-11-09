'use client';

import Uppy, { type UppyFile } from '@uppy/core';
import { useUppyState } from '@uppy/react';
import { useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowRight, Check, FileImage, Film, FlaskConical, HardDrive, LoaderCircle, Music2, Plus, RotateCcw, Upload, X } from 'lucide-react';
import type { ImportProps, MediaItem, MediaKind } from './types';
import './import.css';

type QueueMeta = { demoFailureOnce?: boolean; demo?: boolean };
type QueueBody = { media?: MediaItem };
type LocalFile = UppyFile<QueueMeta, QueueBody>;
type Phase = 'queued' | 'preparing' | 'simulating' | 'ready' | 'error' | 'paused';
type Facts = { width: number; height: number; durationSec?: number; thumbnail?: Blob };
type Entry = { mediaId: string; originalUrl: string; byteSize: number; kind: MediaKind; phase: Phase; attempt: number; result?: MediaItem; message?: string };

const MAX_FILES = 16;
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const MAX_BATCH_BYTES = 200 * 1024 * 1024;
const phases: Record<Phase, string> = { queued: 'En attente', preparing: 'Préparation locale', simulating: 'Transfert simulé', ready: 'Prêt', error: 'Essai interrompu', paused: 'En pause' };
const isAbort = (error: unknown) => error instanceof Error && error.name === 'AbortError';
const bytes = (value: number) => {
  const size = Number.isFinite(value) && value > 0 ? value : 0;
  const unit = size < 1024 ? 'B' : size < 1024 * 1024 ? 'Ko' : 'Mo';
  const divisor = unit === 'B' ? 1 : unit === 'Ko' ? 1024 : 1024 * 1024;
  return `${new Intl.NumberFormat('fr', { maximumFractionDigits: unit === 'B' ? 0 : 1 }).format(size / divisor)} ${unit}`;
};

function mediaKind(type: string, name: string): MediaKind | null {
  if (type.startsWith('image/') || /\.(png|jpe?g|webp|gif|avif|svg|heic|heif)$/i.test(name)) return 'image';
  if (type.startsWith('video/') || /\.(mp4|mov|webm|m4v)$/i.test(name)) return 'video';
  if (type.startsWith('audio/') || /\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(name)) return 'audio';
  return null;
}

function delay(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(new DOMException('Simulation arrêtée', 'AbortError')); };
    const timer = window.setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
  });
}

/** A failed/unsupported local decoder leaves facts unknown; it never supplies guessed duration. */
function measureLocal(kind: MediaKind, url: string, signal: AbortSignal): Promise<Facts> {
  return new Promise((resolve, reject) => {
    const media = kind === 'image' ? new Image() : document.createElement(kind);
    let settled = false;
    const finish = (facts: Facts, failure = false) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      // Settle first: releasing a native decoder must never leave its queue receipt pending.
      if (failure) reject(new DOMException('Simulation arrêtée', 'AbortError')); else resolve(facts);
      try {
        media.onload = null;
        media.onerror = null;
        if (media instanceof HTMLMediaElement) { media.onloadedmetadata = null; media.removeAttribute('src'); media.load(); }
        else media.removeAttribute('src');
      } catch { /* Decoder cleanup is best effort after this measurement has settled. */ }
    };
    const abort = () => finish({ width: 0, height: 0 }, true);
    const timer = window.setTimeout(() => finish({ width: 0, height: 0 }), 5000);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) { abort(); return; }
    media.onerror = () => finish({ width: 0, height: 0 });
    if (media instanceof HTMLImageElement) {
      media.onload = () => {
        const facts = { width: media.naturalWidth, height: media.naturalHeight };
        try {
          const canvas = document.createElement('canvas');
          const scale = Math.min(1, 240 / Math.max(facts.width, facts.height));
          canvas.width = Math.max(1, Math.round(facts.width * scale));
          canvas.height = Math.max(1, Math.round(facts.height * scale));
          const context = canvas.getContext('2d');
          if (!context) { finish(facts); return; }
          context.drawImage(media, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(blob => { finish({ ...facts, ...(blob ? { thumbnail: blob } : {}) }); canvas.width = 0; canvas.height = 0; }, 'image/webp', 0.8);
        } catch { finish(facts); }
      };
    } else {
      media.preload = 'metadata';
      media.onloadedmetadata = () => finish({
        width: media instanceof HTMLVideoElement ? media.videoWidth : 0,
        height: media instanceof HTMLVideoElement ? media.videoHeight : 0,
        ...(Number.isFinite(media.duration) && media.duration > 0 ? { durationSec: media.duration } : {}),
      });
    }
    media.src = url;
    if (media instanceof HTMLMediaElement) media.load();
  });
}

function demoFiles() {
  const drawing = (title: string, a: string, b: string, width: number, height: number) => new File([
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="${a}"/><circle cx="${width * 0.66}" cy="${height * 0.36}" r="${width * 0.24}" fill="${b}"/><path d="M0 ${height * 0.8} Q${width * 0.45} ${height * 0.35} ${width} ${height * 0.8} V${height} H0Z" fill="#332c26" opacity=".7"/><text x="${width * 0.08}" y="${height * 0.9}" fill="#fffaf2" font-family="sans-serif" font-size="${width * 0.04}">${title}</text></svg>`,
  ], `${title}.svg`, { type: 'image/svg+xml' });
  const rate = 16000, count = Math.round(rate * 1.25), buffer = new ArrayBuffer(44 + count * 2), view = new DataView(buffer);
  const text = (offset: number, value: string) => [...value].forEach((letter, index) => view.setUint8(offset + index, letter.charCodeAt(0)));
  text(0, 'RIFF'); view.setUint32(4, 36 + count * 2, true); text(8, 'WAVE'); text(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); text(36, 'data'); view.setUint32(40, count * 2, true);
  for (let i = 0; i < count; i++) {
    const fade = Math.min(1, i / 800, (count - i) / 1600);
    view.setInt16(44 + i * 2, Math.sin(2 * Math.PI * 220 * i / rate) * 1600 * fade, true);
  }
  return [drawing('Étude de lumière', '#d8cbb7', '#a9784e', 1200, 800), new File([buffer], 'Ambiance courte.wav', { type: 'audio/wav' }), drawing('Essai à reprendre', '#c1c8bd', '#f0dfbc', 900, 1200)];
}

function KindIcon({ kind }: { kind: MediaKind }) {
  const Icon = kind === 'image' ? FileImage : kind === 'video' ? Film : Music2;
  return <Icon size={21} aria-hidden="true" />;
}

/** Only the local upload queue belongs to Uppy. No API, cloud or generation transport is installed. */
export function ImportQueue({ open, onClose, onImported }: ImportProps) {
  const [uppy] = useState(() => new Uppy<QueueMeta, QueueBody>({
    id: 'media-prototype-local-import', autoProceed: false,
    restrictions: { maxNumberOfFiles: MAX_FILES, maxFileSize: MAX_FILE_BYTES, maxTotalFileSize: MAX_BATCH_BYTES, allowedFileTypes: ['image/*', 'video/*', 'audio/*'] },
  }));
  const files = useUppyState(uppy, state => state.files);
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [tab, setTab] = useState<'local' | 'demo'>('local');
  const [notice, setNotice] = useState('');
  const [dragging, setDragging] = useState(false);
  const [starting, setStarting] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null), input = useRef<HTMLInputElement>(null);
  const current = useRef<Record<string, Entry>>({}), opened = useRef(open), alive = useRef(true), lifetime = useRef(0);
  const ownerRevision = useRef(0);
  const requests = useRef(new Map<string, AbortController>());
  const urls = useRef(new Map<string, Set<string>>());
  const transferred = useRef(new Set<string>());
  opened.current = open;
  // React is a view of this owner. An urgent Uppy notification can render an older
  // React snapshot, so a render must never copy that snapshot back into the owner.
  const publish = (next: Record<string, Entry>) => {
    current.current = next;
    ownerRevision.current += 1;
    if (alive.current) setEntries(next);
  };
  const update = (id: string, patch: Partial<Entry>) => {
    if (!alive.current || !uppy.getFile(id) || !current.current[id]) return;
    publish({ ...current.current, [id]: { ...current.current[id], ...patch } });
  };

  useEffect(() => {
    alive.current = true;
    const epoch = ++lifetime.current;
    const add = (file: LocalFile) => {
      if (!(file.data instanceof Blob)) { uppy.removeFile(file.id); return; }
      const originalUrl = URL.createObjectURL(file.data);
      urls.current.set(file.id, new Set([originalUrl]));
      const kind = mediaKind(file.type, file.name ?? '') ?? 'image';
      publish({ ...current.current, [file.id]: { mediaId: `local_${crypto.randomUUID()}`, originalUrl, byteSize: file.data.size, kind, phase: 'queued', attempt: 0 } });
    };
    const remove = (file: LocalFile) => {
      requests.current.get(file.id)?.abort();
      requests.current.delete(file.id);
      if (!transferred.current.has(file.id)) urls.current.get(file.id)?.forEach(url => URL.revokeObjectURL(url));
      urls.current.delete(file.id);
      transferred.current.delete(file.id);
      const next = { ...current.current }; delete next[file.id]; publish(next);
    };
    const runFile = async (id: string) => {
      const file = uppy.getFile(id), entry = current.current[id];
      if (!file || !entry || !opened.current || requests.current.has(id) || entry.phase === 'ready') return;
      const request = new AbortController(); requests.current.set(id, request);
      const valid = () => alive.current && !request.signal.aborted && uppy.getFile(id) && requests.current.get(id) === request;
      const attempt = entry.attempt + 1;
      uppy.emit('upload-start', [file]);
      update(id, { phase: 'preparing', attempt, message: undefined });
      try {
        await delay(200, request.signal);
        const facts = await measureLocal(entry.kind, entry.originalUrl, request.signal);
        if (!valid()) return;
        update(id, { phase: 'simulating' });
        // This is a labelled local delay, not a network transfer or byte-progress measurement.
        await delay(850, request.signal);
        if (file.meta.demoFailureOnce && attempt === 1) throw new Error('Échec de test volontaire. Réessayez : le prochain essai aboutira.');
        if (!valid()) return;
        const thumbnail = facts.thumbnail ? URL.createObjectURL(facts.thumbnail) : null;
        if (thumbnail) urls.current.get(id)?.add(thumbnail);
        const result: MediaItem = {
          id: entry.mediaId, ref: { type: 'asset', assetId: entry.mediaId, kind: entry.kind }, name: file.name ?? 'Fichier local', kind: entry.kind,
          width: facts.width, height: facts.height, ...(facts.durationSec ? { durationSec: facts.durationSec } : {}),
          size: entry.byteSize, mime: file.type || 'application/octet-stream', thumbUrl: thumbnail,
          previewUrl: entry.originalUrl, originalUrl: entry.originalUrl, source: 'upload', createdAt: new Date().toISOString(), collectionIds: [], favorite: false,
        };
        update(id, { phase: 'ready', result });
        uppy.emit('upload-success', file, { status: 200, body: { media: result }, uploadURL: entry.originalUrl });
      } catch (error) {
        if (!alive.current || !uppy.getFile(id)) return;
        const message = isAbort(error) ? 'Fichier conservé. Reprenez la simulation quand vous le souhaitez.' : error instanceof Error ? error.message : 'La simulation a échoué. Vous pouvez réessayer.';
        uppy.emit('upload-error', file, new Error(message));
        update(id, { phase: isAbort(error) ? 'paused' : 'error', message });
      } finally {
        if (requests.current.get(id) === request) requests.current.delete(id);
      }
    };
    const uploader = async (ids: string[]) => {
      // Decode and simulate at most two files at a time within a batch.
      let next = 0;
      await Promise.all(Array.from({ length: Math.min(2, ids.length) }, async () => { while (next < ids.length) await runFile(ids[next++]); }));
    };
    uppy.on('file-added', add); uppy.on('file-removed', remove); uppy.addUploader(uploader);
    return () => {
      alive.current = false;
      requests.current.forEach(request => request.abort());
      uppy.off('file-added', add); uppy.off('file-removed', remove); uppy.removeUploader(uploader);
      // StrictMode immediately reinstalls this effect; only a real owner unmount retires resources.
      queueMicrotask(() => {
        if (lifetime.current !== epoch || alive.current) return;
        uppy.destroy();
        urls.current.forEach((values, id) => { if (!transferred.current.has(id)) values.forEach(url => URL.revokeObjectURL(url)); });
        urls.current.clear();
      });
    };
  }, [uppy]);

  useEffect(() => {
    if (!open) { requests.current.forEach(request => request.abort()); setDragging(false); return; }
    const element = dialog.current;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    element?.showModal();
    return () => { if (element?.open) element.close(); if (previous?.isConnected) previous.focus(); };
  }, [open]);

  const addFiles = (items: File[], demo = false) => {
    setNotice('');
    let skipped = 0;
    for (const [index, file] of items.entries()) {
      if (!file.size || !mediaKind(file.type, file.name)) { skipped++; continue; }
      try { uppy.addFile({ name: file.name, type: file.type, data: file, source: 'device', meta: { demo, demoFailureOnce: demo && index === 2 } }); }
      catch { skipped++; }
    }
    if (skipped) setNotice(`${skipped} fichier${skipped > 1 ? 's' : ''} non ajouté${skipped > 1 ? 's' : ''} : doublon, format ou limite du lot.`);
  };
  const list = Object.values(files);
  const active = Object.values(entries).some(entry => entry.phase === 'preparing' || entry.phase === 'simulating');
  const ready = list.filter(file => entries[file.id]?.phase === 'ready' && !transferred.current.has(file.id));
  const waiting = list.filter(file => ['queued', 'paused'].includes(entries[file.id]?.phase));
  const errors = list.filter(file => entries[file.id]?.phase === 'error');
  const start = async () => {
    if (starting || active || !waiting.length) return;
    setStarting(true); setNotice('');
    for (const file of waiting) if (entries[file.id]?.phase === 'paused') {
      uppy.setFileState(file.id, { error: null, progress: { uploadStarted: null, bytesUploaded: false, bytesTotal: file.size, uploadComplete: false } });
      update(file.id, { phase: 'queued', message: undefined });
    }
    try { await uppy.upload(); } catch { if (alive.current) setNotice('Simulation interrompue. Les fichiers restent dans la file.'); }
    finally { if (alive.current) setStarting(false); }
  };
  const retry = async (id: string) => {
    if (active || starting) return;
    setStarting(true); setNotice('');
    try { await uppy.retryUpload(id); } catch { if (alive.current) setNotice('Cet essai n’a pas abouti. Le fichier reste disponible.'); }
    finally { if (alive.current) setStarting(false); }
  };
  const deliver = () => {
    const successful = ready.flatMap(file => entries[file.id]?.result ? [entries[file.id].result!] : []);
    if (!successful.length) return;
    ready.forEach(file => transferred.current.add(file.id));
    try { onImported(successful); }
    catch {
      ready.forEach(file => transferred.current.delete(file.id));
      setNotice('Les fichiers sont toujours prêts. Leur ajout à la bibliothèque n’a pas abouti.');
      return;
    }
    ready.forEach(file => uppy.removeFile(file.id));
    onClose();
  };

  if (!open) return null;
  return <dialog ref={dialog} className="ml-import" aria-labelledby="ml-import-title" aria-describedby="ml-import-description"
    data-import-starting={starting} data-import-request-count={requests.current.size}
    data-import-pipeline-count={Object.keys(uppy.getState().currentUploads).length}
    data-import-active={active} data-import-owner-revision={ownerRevision.current}
    onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => {
    if (event.target !== event.currentTarget) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
  }}>
    <header className="ml-import-header"><div className="ml-import-heading-icon"><Upload size={20} aria-hidden="true" /></div><div><span className="ml-import-eyebrow">VOTRE BIBLIOTHÈQUE</span><h2 id="ml-import-title">Importer des médias</h2></div><button type="button" className="ml-import-icon-button" aria-label="Fermer l’import, conserver la file" onClick={onClose}><X size={20} /></button></header>
    <div className="ml-import-body">
      <p id="ml-import-description" className="ml-import-description">Ajoutez vos images, vidéos et sons. Dans ce prototype, tout reste sur votre appareil.</p>
      <div className="ml-import-tabs" role="tablist" aria-label="Source de l’import"><button type="button" role="tab" id="ml-import-tab-local" aria-controls="ml-import-local" aria-selected={tab === 'local'} tabIndex={tab === 'local' ? 0 : -1} onClick={() => setTab('local')} onKeyDown={event => { if (event.key === 'ArrowRight') { setTab('demo'); document.getElementById('ml-import-tab-demo')?.focus(); } }}><HardDrive size={15} aria-hidden="true" />Fichiers locaux</button><button type="button" role="tab" id="ml-import-tab-demo" aria-controls="ml-import-demo" aria-selected={tab === 'demo'} tabIndex={tab === 'demo' ? 0 : -1} onClick={() => setTab('demo')} onKeyDown={event => { if (event.key === 'ArrowLeft') { setTab('local'); document.getElementById('ml-import-tab-local')?.focus(); } }}><FlaskConical size={15} aria-hidden="true" />Tester le parcours</button></div>
      {tab === 'local' ? <section role="tabpanel" id="ml-import-local" aria-labelledby="ml-import-tab-local" className={`ml-import-drop ${dragging ? 'is-dragging' : ''}`} onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }} onDrop={event => { event.preventDefault(); setDragging(false); addFiles(Array.from(event.dataTransfer.files)); }}>
        <span className="ml-import-drop-icon"><Plus size={25} aria-hidden="true" /></span><strong>Glissez vos fichiers ici</strong><span>ou choisissez-les sur votre appareil</span><button type="button" className="ml-import-secondary" onClick={() => input.current?.click()}>Choisir des fichiers</button><small>Images, vidéos et audio · 16 fichiers · 50 Mo par fichier</small>
      </section> : <section role="tabpanel" id="ml-import-demo" aria-labelledby="ml-import-tab-demo" className="ml-import-demo"><div><FlaskConical size={25} aria-hidden="true" /><strong>Un petit lot pour explorer</strong><p>Deux images SVG et un son WAV créés localement. Un fichier échoue volontairement au premier essai pour tester « Réessayer ».</p></div><button type="button" className="ml-import-secondary" disabled={list.length > MAX_FILES - 3} onClick={() => { addFiles(demoFiles(), true); setTab('local'); }}>Ajouter 3 fichiers démo</button></section>}
      <input ref={input} type="file" accept="image/*,video/*,audio/*" multiple hidden onChange={event => { addFiles(Array.from(event.target.files ?? [])); event.currentTarget.value = ''; }} />
      {notice ? <p className="ml-import-notice" role="alert"><AlertCircle size={16} aria-hidden="true" />{notice}</p> : null}
      {list.length ? <section className="ml-import-queue" aria-labelledby="ml-import-queue-title"><div className="ml-import-queue-heading"><h3 id="ml-import-queue-title">Votre sélection <span>{list.length}</span></h3><small>{bytes(list.reduce((sum, file) => sum + (file.size ?? 0), 0))} / 200 Mo</small></div><ul>
        {list.map(file => {
          const entry = entries[file.id];
          if (!entry) return null;
          const processing = entry.phase === 'preparing' || entry.phase === 'simulating';
          const dimensions = entry.result?.width && entry.result?.height ? `${entry.result.width} × ${entry.result.height}` : entry.kind === 'image' && entry.result ? 'Dimensions non qualifiées' : '';
          const duration = entry.result?.durationSec ? `${new Intl.NumberFormat('fr', { maximumFractionDigits: 2 }).format(entry.result.durationSec)} s mesurées` : entry.kind !== 'image' && entry.result ? 'Durée non qualifiée' : '';
          return <li key={file.id} className={`ml-import-file is-${entry.phase}`}
            data-import-file-id={file.id} data-import-phase={entry.phase} data-import-owner-phase={current.current[file.id]?.phase ?? ''}
            data-import-attempt={entry.attempt} data-import-uppy-complete={Boolean(file.progress.uploadComplete)}
            data-import-uppy-error={file.error ?? ''} data-import-request-active={requests.current.has(file.id)}
          ><div className="ml-import-file-cover">{entry.result?.thumbUrl ? <img src={entry.result.thumbUrl} alt="" decoding="async" /> : <KindIcon kind={entry.kind} />}</div><div className="ml-import-file-info"><strong title={file.name}>{file.name}</strong><span>{[bytes(file.size ?? 0), dimensions, duration].filter(Boolean).join(' · ')}</span>{entry.message ? <small className="ml-import-file-message">{entry.message}</small> : null}</div><div className="ml-import-file-state">{processing ? <LoaderCircle className="ml-import-spinner" size={15} aria-hidden="true" /> : entry.phase === 'ready' ? <Check size={15} aria-hidden="true" /> : entry.phase === 'error' ? <AlertCircle size={15} aria-hidden="true" /> : null}<span>{phases[entry.phase]}</span></div><div className="ml-import-file-actions">{entry.phase === 'error' ? <button type="button" className="ml-import-retry" disabled={active || starting} onClick={() => void retry(file.id)} aria-label={`Réessayer ${file.name}`}><RotateCcw size={16} aria-hidden="true" /><span>Réessayer</span></button> : null}<button type="button" className="ml-import-icon-button" onClick={() => uppy.removeFile(file.id)} aria-label={`Retirer ${file.name}`}><X size={17} /></button></div></li>;
        })}
      </ul></section> : <p className="ml-import-empty">Votre file d’import est vide.</p>}
      <p className="ml-import-simulation" role="status" aria-live="polite"><span />{active ? 'Simulation locale en cours. Aucun fichier n’est envoyé.' : `${ready.length} fichier${ready.length > 1 ? 's' : ''} prêt${ready.length > 1 ? 's' : ''}${errors.length ? ` · ${errors.length} à réessayer` : ''}. Aucun envoi vers le cloud.`}</p>
    </div>
    <footer className="ml-import-footer"><button type="button" className="ml-import-later" onClick={onClose}>Fermer et garder la file</button><div>{waiting.length ? <button type="button" className="ml-import-secondary" disabled={active || starting} onClick={() => void start()}>{active ? <LoaderCircle size={15} className="ml-import-spinner" aria-hidden="true" /> : <Upload size={15} aria-hidden="true" />}{list.some(file => entries[file.id]?.phase === 'paused') ? 'Reprendre la simulation' : 'Démarrer la simulation'}</button> : null}<button type="button" className="ml-import-primary" disabled={!ready.length || active || starting} onClick={deliver}>Ajouter {ready.length || ''} fichier{ready.length > 1 ? 's' : ''} prêt{ready.length > 1 ? 's' : ''}<ArrowRight size={16} aria-hidden="true" /></button></div></footer>
  </dialog>;
}

export default ImportQueue;
