'use client';
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useAccessibleModal } from '@/components/ui/useAccessibleModal';
import { authFetch } from '@/lib/authFetch';
import type { AudioCreationDraft } from '@/lib/audio-creation';
import type { AudioCreationCopy } from '../_lib/audio-creation-copy';
import styles from './audio-creation.module.css';

type Asset = { id: string; url: string; kind: string; mime?: string; durationSec?: number; size?: number; createdAt?: string };
export default function AudioReferenceLibrary({ copy, onClose, onSelect }: { copy: AudioCreationCopy; onClose: () => void; onSelect: (reference: NonNullable<AudioCreationDraft['reference']>) => void }) {
  const { dialogRef, onDialogKeyDown } = useAccessibleModal({ onClose });
  const [assets, setAssets] = useState<Asset[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setState('loading');
    void authFetch('/api/media-library/assets?kind=audio&limit=50', { signal: controller.signal }).then(async response => {
      const data = await response.json();
      if (!response.ok || !data.ok || !Array.isArray(data.assets)) throw new Error('library');
      if (!controller.signal.aborted) { setAssets(data.assets.filter((asset: Asset) => asset.kind === 'audio')); setState('ready'); }
    }).catch(() => { if (!controller.signal.aborted) setState('error'); });
    return () => controller.abort();
  }, [attempt]);
  return <div className={styles.libraryBackdrop}>
    <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="audio-reference-library-title" tabIndex={-1} onKeyDown={onDialogKeyDown} className={styles.libraryDialog}>
      <header><h2 id="audio-reference-library-title">{copy.library}</h2><button type="button" onClick={onClose} aria-label={copy.close}><X size={18} aria-hidden /></button></header>
      <p>{copy.referenceHint}</p>
      {state === 'loading' ? <p role="status">{copy.loading}</p> : state === 'error' ? <button type="button" onClick={() => setAttempt(value => value + 1)}>{copy.retry}</button> : !assets.length ? <p>{copy.emptyLibrary}</p> : assets.map((asset, index) => {
        const compatible = /^(audio\/(mpeg|mp3|wav|x-wav|wave))$/.test(asset.mime ?? '') && typeof asset.durationSec === 'number' && asset.durationSec > 0 && asset.durationSec <= 30 && typeof asset.size === 'number' && asset.size <= 10 * 1024 * 1024;
        const name = `${copy.reference} ${index + 1}`;
        return <article key={asset.id}><div><strong>{name}</strong><small>{asset.durationSec ? `${asset.durationSec.toFixed(1)} s` : copy.details}</small></div><audio controls preload="none" src={asset.url} aria-label={name} /><button type="button" disabled={!compatible} title={!compatible ? copy.uploadError : undefined} onClick={() => onSelect({ url: asset.url, name, ref: { type: 'asset', assetId: asset.id, kind: 'audio' } })}>{copy.select}</button></article>;
      })}
    </section>
  </div>;
}
