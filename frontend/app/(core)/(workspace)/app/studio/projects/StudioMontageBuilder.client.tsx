'use client';

/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ArrowDown, ArrowUp, Film, Plus, Trash2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAccessibleModal } from '@/components/ui/useAccessibleModal';
import { authFetch } from '@/lib/authFetch';
import {
  MONTAGE_ASPECT_RATIOS,
  MONTAGE_FPS,
  MONTAGE_MAX_CLIPS,
  MONTAGE_RESOLUTIONS,
  type MontageSettings,
} from '@/lib/studio/montage-contract';
import type { StudioCopy } from '../_lib/studio-copy';
import { normalizeWorkspaceUserLibraryPage } from '../workspace/_lib/workspace-library-assets';
import {
  createStudioMontageClipDraft,
  retimeStudioMontageClips,
  studioMontageBusinessPayload,
  studioMontageLibraryAsset,
  validateStudioMontageDraft,
  type StudioMontageClipDraft,
} from './studio-montage-builder';
import styles from './studio-projects.module.css';

type StudioMontageLibraryChoice = {
  key: string;
  name: string;
  thumbnailUrl: string | null;
  eligible: NonNullable<ReturnType<typeof studioMontageLibraryAsset>> | null;
};

export const STUDIO_MONTAGE_CREATE_TIMEOUT_MS = 20_000;

function attemptId(): string {
  return globalThis.crypto?.randomUUID
    ? `studio-ui-${globalThis.crypto.randomUUID()}`
    : `studio-ui-${Date.now().toString(36)}-${Math.random().toString(16).slice(2)}`;
}

function StudioMontageDialog({ copy, idempotencyKeys, onClose }: {
  copy: StudioCopy['projects']['montage'];
  idempotencyKeys: Map<string, string>;
  onClose: () => void;
}) {
  const router = useRouter();
  const occurrenceRef = useRef(0);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assets, setAssets] = useState<StudioMontageLibraryChoice[]>([]);
  const [title, setTitle] = useState('');
  const [settings, setSettings] = useState<MontageSettings>({
    fps: 24, aspectRatio: '16:9', resolution: '1080p', audioMode: 'preserve',
  });
  const [clips, setClips] = useState<StudioMontageClipDraft[]>([]);
  const { dialogRef, onDialogKeyDown } = useAccessibleModal<HTMLFormElement>({
    onClose,
    closeDisabled: submitting,
  });

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setLoadError(null);
    void authFetch('/api/media-library/assets?limit=60&kind=video', {
      headers: { Accept: 'application/json' }, cache: 'no-store', signal: controller.signal,
    }).then(async (response) => {
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error('LOAD_FAILED');
      if (!active) return;
      setAssets(normalizeWorkspaceUserLibraryPage(payload, 'video').assets.map((asset) => {
        const eligible = studioMontageLibraryAsset(asset);
        return {
          key: eligible?.assetId ?? asset.id,
          name: asset.name,
          thumbnailUrl: asset.thumbUrl ?? null,
          eligible,
        };
      }));
    }).catch((cause) => {
      if (active && (cause as { name?: string })?.name !== 'AbortError') setLoadError(copy.errorLibrary);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
      controller.abort();
    };
  }, [copy.errorLibrary, loadAttempt]);

  const totalFrames = useMemo(() => clips.reduce((sum, clip) => sum + clip.durationFrames, 0), [clips]);
  const validationError = validateStudioMontageDraft({ title, settings, clips });
  const errorForValidation = (reason: typeof validationError) => reason === 'title' ? copy.errorTitle
    : reason === 'count' ? copy.errorCount : reason === 'trim' ? copy.errorTrim
      : reason === 'duration' ? copy.errorDuration : null;
  const validationCopy = errorForValidation(validationError);

  const addClip = (asset: NonNullable<StudioMontageLibraryChoice['eligible']>) => {
    if (clips.length >= MONTAGE_MAX_CLIPS) return;
    occurrenceRef.current += 1;
    setClips((current) => [...current, createStudioMontageClipDraft({
      asset, fps: settings.fps, occurrenceId: `montage-occurrence-${occurrenceRef.current}`,
    })]);
  };
  const moveClip = (index: number, direction: -1 | 1) => setClips((current) => {
    const target = index + direction;
    if (target < 0 || target >= current.length) return current;
    const next = [...current];
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  });
  const patchClip = (occurrenceId: string, patch: Partial<StudioMontageClipDraft>) => setClips((current) => (
    current.map((clip) => clip.occurrenceId === occurrenceId ? { ...clip, ...patch } : clip)
  ));
  const changeFps = (fps: MontageSettings['fps']) => {
    setClips((current) => retimeStudioMontageClips(current, settings.fps, fps));
    setSettings((current) => ({ ...current, fps }));
  };
  const retryLibrary = () => {
    setLoadAttempt((attempt) => attempt + 1);
    window.setTimeout(() => dialogRef.current?.focus(), 0);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const reason = validateStudioMontageDraft({ title, settings, clips });
    if (reason) { setError(errorForValidation(reason)); return; }
    const business = studioMontageBusinessPayload({ title, settings, clips });
    const identity = JSON.stringify(business);
    const idempotencyKey = idempotencyKeys.get(identity) ?? attemptId();
    idempotencyKeys.set(identity, idempotencyKey);
    setSubmitting(true);
    setError(null);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), STUDIO_MONTAGE_CREATE_TIMEOUT_MS);
    try {
      const response = await authFetch('/api/studio/montages', {
        method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...business, idempotencyKey }),
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok || typeof payload.montage?.studioUrl !== 'string') throw new Error('CREATE_FAILED');
      router.push(payload.montage.studioUrl);
    } catch {
      setError(copy.errorRequest);
      setSubmitting(false);
    } finally {
      window.clearTimeout(timeoutId);
    }
  };

  return (
    <div className={styles.dialogBackdrop}>
      <form ref={dialogRef} tabIndex={-1} className={`${styles.projectDialog} ${styles.montageDialog}`} role="dialog" aria-modal="true" aria-labelledby="studio-montage-title" aria-busy={submitting} onKeyDown={onDialogKeyDown} onSubmit={submit} data-studio-montage-dialog="true">
            <div className={styles.dialogTitleRow}>
              <div><h2 id="studio-montage-title">{copy.title}</h2><p>{copy.subtitle}</p></div>
              <button type="button" aria-label={copy.cancel} disabled={submitting} onClick={onClose}><X size={17} /></button>
            </div>
            <fieldset className={styles.montageFields} disabled={submitting}>
            <label className={styles.projectField}><span>{copy.projectTitle}</span>
              <input value={title} maxLength={80} onChange={(event) => setTitle(event.target.value)} data-modal-initial-focus="true" data-studio-montage-title-input="true" />
            </label>
            <div className={styles.montageSettings}>
              <label><span>{copy.fps}</span><select value={settings.fps} onChange={(event) => changeFps(Number(event.target.value) as MontageSettings['fps'])}>{MONTAGE_FPS.map((fps) => <option key={fps} value={fps}>{fps}</option>)}</select></label>
              <label><span>{copy.aspectRatio}</span><select value={settings.aspectRatio} onChange={(event) => setSettings((current) => ({ ...current, aspectRatio: event.target.value as MontageSettings['aspectRatio'] }))}>{MONTAGE_ASPECT_RATIOS.map((value) => <option key={value}>{value}</option>)}</select></label>
              <label><span>{copy.resolution}</span><select value={settings.resolution} onChange={(event) => setSettings((current) => ({ ...current, resolution: event.target.value as MontageSettings['resolution'] }))}>{MONTAGE_RESOLUTIONS.map((value) => <option key={value}>{value}</option>)}</select></label>
              <label><span>{copy.audio}</span><select value={settings.audioMode} onChange={(event) => setSettings((current) => ({ ...current, audioMode: event.target.value as MontageSettings['audioMode'] }))}><option value="preserve">{copy.preserveAudio}</option><option value="mute">{copy.muteAudio}</option></select></label>
            </div>
            <section className={styles.montageLibrary} aria-labelledby="studio-montage-library"><h3 id="studio-montage-library">{copy.library}</h3>
              {loadError ? <div className={styles.deleteWarning} role="alert" data-studio-montage-library-error="true"><span>{loadError}</span><button type="button" onClick={retryLibrary} data-studio-montage-library-retry="true">{copy.retryLibrary}</button></div>
                : loading ? <p>{copy.loading}</p> : assets.length ? <div className={styles.montageAssetList}>{assets.map((choice) => (
                <article key={choice.key} data-studio-montage-library-asset={choice.eligible?.assetId ?? choice.key} data-studio-montage-eligible={choice.eligible ? 'true' : 'false'}>{choice.thumbnailUrl ? <img src={choice.thumbnailUrl} alt="" /> : <span><Film size={18} /></span>}<strong>{choice.name}</strong><small>{choice.eligible ? `${choice.eligible.durationSec.toFixed(2)}s` : copy.ineligible}</small>
                  <button type="button" aria-label={`${choice.eligible ? copy.add : copy.ineligible}: ${choice.name}`} onClick={() => choice.eligible && addClip(choice.eligible)} disabled={!choice.eligible || clips.length >= MONTAGE_MAX_CLIPS} data-studio-montage-add={choice.eligible?.assetId}>{choice.eligible ? copy.add : copy.ineligible}</button>
                </article>
              ))}</div> : <p>{copy.empty}</p>}
            </section>
            <section className={styles.montageOrder} aria-labelledby="studio-montage-order"><h3 id="studio-montage-order">{copy.orderedClips}</h3>
              <ol>{clips.map((clip, index) => <li key={clip.occurrenceId} aria-label={`${copy.clip} ${index + 1} — ${clip.assetName}`} data-studio-montage-clip={clip.occurrenceId} data-studio-montage-asset-id={clip.assetId}>
                <span className={styles.montageClipIndex}>{index + 1}</span><strong>{clip.assetName}</strong>
                <label><span>{copy.sourceInFrame}</span><input type="number" min={0} step={1} value={clip.sourceInFrame} onChange={(event) => patchClip(clip.occurrenceId, { sourceInFrame: Number(event.target.value) })} /></label>
                <label><span>{copy.durationFrames}</span><input type="number" min={1} step={1} value={clip.durationFrames} onChange={(event) => patchClip(clip.occurrenceId, { durationFrames: Number(event.target.value) })} /></label>
                <span className={styles.montageClipActions}><button type="button" aria-label={`${copy.moveUp} ${index + 1}`} disabled={index === 0} onClick={() => moveClip(index, -1)} data-studio-montage-move-up={index}><ArrowUp size={16} /></button><button type="button" aria-label={`${copy.moveDown} ${index + 1}`} disabled={index === clips.length - 1} onClick={() => moveClip(index, 1)} data-studio-montage-move-down={index}><ArrowDown size={16} /></button><button type="button" aria-label={`${copy.remove} ${index + 1}`} onClick={() => setClips((current) => current.filter((item) => item.occurrenceId !== clip.occurrenceId))} data-studio-montage-remove={index}><Trash2 size={16} /></button></span>
              </li>)}</ol>
            </section>
            <div className={styles.montageSummary}>{copy.total.replace('{frames}', String(totalFrames)).replace('{seconds}', (totalFrames / settings.fps).toFixed(2))}</div>
            {validationCopy ? <div className={styles.deleteWarning} role="status" aria-live="polite" data-studio-montage-validation-error="true">{validationCopy}</div> : null}
            {error ? <div className={styles.deleteWarning} role="alert" aria-live="polite" data-studio-montage-error="true">{error}</div> : null}
            <div className={styles.dialogActions}><button type="button" className={styles.dialogSecondaryButton} disabled={submitting} onClick={onClose}>{copy.cancel}</button><button type="submit" className={styles.dialogPrimaryButton} disabled={submitting || Boolean(validationError)} data-studio-montage-submit="true">{submitting ? copy.creating : copy.create}</button></div>
            </fieldset>
      </form>
    </div>
  );
}

export function StudioMontageBuilder({ copy, enabled }: {
  copy: StudioCopy['projects']['montage'];
  enabled: boolean;
}) {
  const idempotencyKeysRef = useRef(new Map<string, string>());
  const [open, setOpen] = useState(false);
  if (!enabled) return null;
  return (
    <>
      <button type="button" className={styles.montageOpenButton} onClick={() => setOpen(true)} data-studio-montage-open="true">
        <Film size={18} aria-hidden="true" /><span>{copy.open}</span><Plus size={16} aria-hidden="true" />
      </button>
      {open ? <StudioMontageDialog copy={copy} idempotencyKeys={idempotencyKeysRef.current} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
