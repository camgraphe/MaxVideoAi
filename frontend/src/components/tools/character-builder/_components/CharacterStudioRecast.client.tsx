'use client';
/* eslint-disable @next/next/no-img-element */
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { Clapperboard, Plus, Download, Upload, X } from 'lucide-react';
import type { StudioCopy } from '../_lib/character-studio-copy';
import type { StudioRecastSelection } from '@/types/character-studio';
import { buildRecastBrief, isRecastAudioFile } from '@/lib/character-studio-recast';
import { CharacterStudioRecastDirection } from './CharacterStudioRecastDirection.client';
import { getRecastTiming } from '@/lib/character-studio-recast-timing';
import { CharacterStudioRecastTiming } from './CharacterStudioRecastTiming.client';
import {
  CharacterStudioRecastPassage,
  RecastPassageDialog,
  RecastPassagePlayer,
} from './CharacterStudioRecastPassage.client';
import { passageSeconds, useRecastTrack } from './useRecastTrack';
import { useRecastDraft } from '../_hooks/useRecastDraft';
import { draftImage, draftTrack, hasRecastDraft, restoreDraftImage, type RecastDraft } from '../_lib/recast-draft-store';
import { getRecastSessionCopy } from '../_lib/recast-session-copy';
import { CharacterStudioRecastResetDialog } from './CharacterStudioRecastResetDialog.client';

import { CharacterStudioRecastSubmit } from './CharacterStudioRecastSubmit.client';
import { CharacterStudioRecastPortrait } from './CharacterStudioRecastPortrait.client';
import { CharacterStudioRecastReadiness } from './CharacterStudioRecastReadiness.client';
import type { RecastCharacterLibraryAccess } from './CharacterStudioRecastCharacterPicker.client';
import type { RecastImage as LocalMedia, UploadCache } from '../_lib/recast-submit';
import {
  RECAST_RESOLUTIONS,
  RECAST_FRAMINGS,
  type RecastFraming,
  type RecastResolution,
} from '@/lib/character-studio-recast-format';

type RecastProps = {
  copy: StudioCopy;
  navigation: ReactNode;
  active: boolean;
  selection?: StudioRecastSelection | null;
  characterLibrary?: RecastCharacterLibraryAccess;
  accountId?: string | null;
};

export function CharacterStudioRecast(props: RecastProps) {
  return <RecastSession key={props.accountId ?? 'guest'} {...props} />;
}

function RecastSession(props: RecastProps) {
  const copy = getRecastSessionCopy(props.copy.recastLocale);
  const draft = useRecastDraft(props.accountId ?? null, copy.leave);
  const ignoredSelection = useRef<StudioRecastSelection | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  useEffect(() => {
    if (!props.active || draft.locked) setConfirmReset(false);
  }, [props.active, draft.locked]);
  async function resetScene() {
    if (draft.locked || draft.clearing) return;
    ignoredSelection.current = props.selection ?? null;
    await draft.reset();
  }
  if (draft.initial === undefined) return <div>{props.navigation}<p role="status">{copy.loading}</p></div>;
  return <><RecastScene {...props} key={draft.epoch}
    selection={props.selection === ignoredSelection.current ? null : props.selection}
    initialDraft={draft.initial} onDraft={draft.change} locked={draft.locked} onLock={draft.setLocked}
    clearing={draft.clearing} storageError={draft.status === 'error'}
    onNew={(dirty) => {
      if (draft.locked || draft.clearing) return;
      if (dirty) setConfirmReset(true);
      else void resetScene();
    }} />
    {confirmReset && props.active && !draft.locked && <CharacterStudioRecastResetDialog copy={copy}
      onClose={() => setConfirmReset(false)}
      onConfirm={() => { setConfirmReset(false); void resetScene(); }} />}
  </>;
}

function RecastScene({ copy, navigation, active, selection, characterLibrary,
  initialDraft, onDraft, onNew, locked, onLock, clearing, storageError,
}: RecastProps & {
  initialDraft: RecastDraft | null;
  onDraft: (value: RecastDraft | null) => void;
  onNew: (dirty: boolean) => void;
  locked: boolean;
  onLock: (value: boolean) => void;
  clearing: boolean;
  storageError: boolean;
}) {
  const sessionCopy = getRecastSessionCopy(copy.recastLocale);
  const [outputOpen, setOutputOpen] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const readerRoot = useRef<HTMLDivElement>(null);
  const readinessId = useId();
  const portraitSection = useRef<HTMLDivElement>(null);
  const directionSection = useRef<HTMLDivElement>(null);
  const videoControl = useRecastTrack('video', initialDraft?.video);
  const audioControl = useRecastTrack('audio', initialDraft?.audio);
  const video = videoControl.track;
  const audio = audioControl.track;
  const editing = videoControl.editing || audioControl.editing;
  useEffect(() => {
    if (!active || editing)
      readerRoot.current
        ?.querySelectorAll<HTMLMediaElement>('video, audio')
        .forEach((video) => video.pause());
  }, [active, editing]);
  const [portrait, setPortrait] = useState<LocalMedia | null>(null);
  const [product, setProduct] = useState<LocalMedia | null>(null);
  const selectionLocked = useRef(locked);
  selectionLocked.current = locked;
  const [blockedSelection, setBlockedSelection] = useState(false);
  useEffect(() => {
    const identity = restoreDraftImage(initialDraft?.portrait ?? null);
    const object = restoreDraftImage(initialDraft?.product ?? null);
    setPortrait(identity);
    setProduct(object);
    return () => {
      if (identity?.file) URL.revokeObjectURL(identity.url);
      if (object?.file) URL.revokeObjectURL(object.url);
    };
  }, [initialDraft]);
  useEffect(() => {
    if (!selection) return;
    // A Character handoff must not remount the recovery action for an uncertain purchase.
    // Only a new selection triggers this effect; unlocking must not apply a blocked handoff.
    setBlockedSelection(selectionLocked.current);
    if (!selectionLocked.current) setPortrait({ url: selection.imageUrl, name: selection.name, jobId: selection.jobId });
  }, [selection]);
  const [dialogue, setDialogue] = useState(initialDraft?.dialogue ?? '');
  const productInput = useRef<HTMLInputElement>(null);
  const audioInput = useRef<HTMLInputElement>(null);
  useEffect(
    () => () => {
      if (product) URL.revokeObjectURL(product.url);
    },
    [product],
  );
  const [prompt, setPrompt] = useState(initialDraft?.prompt ?? '');
  const [error, setError] = useState('');
  const [manualSeconds, setManualSeconds] = useState<number | null>(initialDraft?.manualSeconds ?? null);
  const [resolution, setResolution] = useState<RecastResolution>(initialDraft?.resolution ?? '720p');
  const [aspectRatio, setAspectRatio] = useState<RecastFraming>(initialDraft?.aspectRatio ?? 'auto');
  const snapshot = useMemo<RecastDraft>(() => ({ version: 1,
    portrait: draftImage(portrait), product: draftImage(product), video: draftTrack(video), audio: draftTrack(audio),
    prompt, dialogue, manualSeconds, resolution, aspectRatio,
  }), [portrait, product, video, audio, prompt, dialogue, manualSeconds, resolution, aspectRatio]);
  const dirty = hasRecastDraft(snapshot);
  useEffect(() => onDraft(dirty ? snapshot : null), [snapshot, dirty, onDraft]);
  const uploads = useRef<UploadCache>(new WeakMap());
  const timing = getRecastTiming({
    sourceSeconds: passageSeconds(video),
    audioSeconds: passageSeconds(audio),
    dialogue,
    manualSeconds,
  });
  const mode = video ? 'v2v' : audio || product ? 'ref2v' : 'i2v';
  const hasDirection = Boolean(video || prompt.trim() || dialogue.trim() || audio);
  const unresolved = [video, audio].find((track) => track && !track.range);
  const canEstimate = !unresolved && !editing;
  const canExport = Boolean(portrait && hasDirection && canEstimate && timing.valid);
  const videoInput = useRef<HTMLInputElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  function focusRequired(target: HTMLElement | null | undefined) {
    target?.scrollIntoView?.({ block: 'nearest' });
    target?.focus({ preventScroll: true });
  }
  useEffect(
    () => () => {
      if (portrait?.url.startsWith('blob:')) URL.revokeObjectURL(portrait.url);
    },
    [portrait],
  );
  function select(file: File | undefined, kind: 'video' | 'image' | 'product') {
    if (!file) return;
    if (
      (kind === 'video'
        ? !(
            file.size > 0 &&
            /\.(mp4|mov)$/i.test(file.name) &&
            (!file.type || file.type.startsWith('video/'))
          )
        : !(file.size > 0 && file.type.startsWith('image/'))) ||
      file.size > (kind === 'video' ? 100 : 20) * 1024 * 1024
    ) {
      setError(kind === 'video' ? copy.invalidVideo : copy.invalidImage);
      return;
    }
    setError('');
    if (kind === 'video') {
      videoControl.select(file);
      return;
    }
    const asset = { file, url: URL.createObjectURL(file), name: file.name };
    if (kind === 'product') setProduct(asset);
    else setPortrait(asset);
  }
  function selectAudio(file?: File) {
    if (!file) return;
    if (!isRecastAudioFile(file)) {
      setError(copy.invalidAudio);
      return;
    }
    setError('');
    audioControl.select(file);
  }
  function downloadBrief() {
    if (!canExport || !portrait) return;
    const brief = buildRecastBrief({
      resolution,
      aspectRatio,
      source: video?.name,
      durationSec: timing.seconds,
      sourceDurationSec: passageSeconds(video) ?? undefined,
      videoPassage: video?.range && { ...video.range, originalDurationSec: video.originalSeconds! },
      audioPassage: audio?.range && { ...audio.range, originalDurationSec: audio.originalSeconds! },
      character: portrait.name,
      product: product?.name,
      direction: prompt,
      dialogue,
      audio: audio?.name,
    });
    const url = URL.createObjectURL(new Blob([JSON.stringify(brief, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'maxvideoai-recast.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div ref={readerRoot} className="grid h-full min-h-0 gap-3 lg:grid-cols-[340px_minmax(0,1fr)]">
      <aside className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-surface">
        {navigation}
        <fieldset
          disabled={locked}
          className="min-h-0 min-w-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 pb-4"
        >
          <div className="pt-1">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">MaxVideoAI Recast</h2>
              <button type="button" data-recast-new disabled={locked || clearing} onClick={() => onNew(dirty)}
                className="flex min-h-9 shrink-0 items-center gap-1 rounded-lg border border-border px-2 text-xs disabled:opacity-50">
                <Plus size={13} aria-hidden="true" />{sessionCopy.newScene}
              </button>
            </div>
            {initialDraft && <p data-recast-restored role="status" className="mt-2 text-xs text-text-secondary">{sessionCopy.restored}</p>}
            {storageError && <p data-recast-storage-error role="alert" className="mt-2 text-xs text-text-secondary">{sessionCopy.storageError}</p>}
            {locked && blockedSelection && <p data-recast-locked-selection role="alert" className="mt-2 text-xs text-text-secondary">{sessionCopy.lockedSelection}</p>}
            <p className="mt-2 text-xs leading-relaxed text-text-secondary">{copy.recastDraft}</p>
          </div>
          <section>
            <h3 className="mb-2 text-xs font-medium text-text-secondary">
              01 · {copy.sourceVideo} · {copy.optional}
            </h3>
            {video ? (
              <CharacterStudioRecastPassage
                kind="video"
                control={videoControl}
                copy={copy}
                label={copy.sourceVideo}
              />
            ) : (
              <button
                type="button"
                onClick={() => videoInput.current?.click()}
                className="flex min-h-32 w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-bg text-sm hover:border-brand"
              >
                <Upload size={24} />
                {copy.addVideo}
              </button>
            )}
          </section>
          <div ref={portraitSection}>
            <CharacterStudioRecastPortrait
              portrait={portrait} copy={copy} active={active} access={characterLibrary}
              onUpload={() => imageInput.current?.click()}
              onSelect={value => { setPortrait(value); setError(''); }}
            />
          </div>
          <section>
            <h3 className="mb-2 text-xs font-medium text-text-secondary">03 · {copy.product}</h3>
            {product ? (
              <div className="flex items-center gap-3 rounded-xl border border-border p-2">
                <img
                  src={product.url}
                  alt={product.name}
                  className="h-14 w-14 rounded-lg bg-bg object-contain"
                />
                <span className="min-w-0 flex-1 truncate text-xs">{product.name}</span>
                <button
                  type="button"
                  aria-label={copy.remove + ' · ' + copy.product}
                  onClick={() => setProduct(null)}
                  className="p-2"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => productInput.current?.click()}
                className="flex w-full items-center gap-3 rounded-xl border border-dashed border-border bg-bg p-3 text-sm"
              >
                <Plus size={18} />
                {copy.addProduct}
              </button>
            )}
            <p className="mt-2 text-xs text-text-secondary">{copy.productHint}</p>
          </section>
          <div ref={directionSection}>
            <CharacterStudioRecastDirection
              copy={copy}
              prompt={prompt}
              onPrompt={setPrompt}
              dialogue={dialogue}
              onDialogue={setDialogue}
              audioControl={audioControl}
              hasVideo={Boolean(video)}
              addAudio={() => audioInput.current?.click()}
            />
          </div>
          <input
            ref={productInput}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/bmp"
            className="hidden"
            onChange={(e) => {
              select(e.target.files?.[0], 'product');
              e.target.value = '';
            }}
          />
          <input
            ref={audioInput}
            type="file"
            accept=".mp3,.wav,audio/mpeg,audio/wav"
            className="hidden"
            onChange={(e) => {
              selectAudio(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          {canExport && (
            <div>
              <button
                type="button"
                onClick={downloadBrief}
                className="flex items-center gap-2 text-xs font-medium underline underline-offset-4"
              >
                <Download size={14} />
                {copy.exportBrief}
              </button>
              <p className="mt-1 text-xs text-text-secondary">{copy.exportHint}</p>
            </div>
          )}
          {(error || videoControl.invalid || audioControl.invalid) && (
            <p role="alert" className="text-xs text-text-secondary">
              {error || (videoControl.invalid ? copy.invalidVideo : copy.invalidAudio)}
            </p>
          )}
        </fieldset>
        <div data-recast-footer className="shrink-0 space-y-2 border-t border-border p-3">
          <button type="button" aria-expanded={outputOpen} aria-controls="recast-output-settings" disabled={locked}
            onClick={() => setOutputOpen(value => !value)}
            className="flex min-h-9 w-full items-center justify-between gap-2 text-xs lg:hidden">
            <span>{sessionCopy.settings}</span><span>{resolution} · {aspectRatio} · {timing.seconds} s {outputOpen ? '−' : '+'}</span>
          </button>
          <fieldset disabled={locked} className="space-y-2">
            <div id="recast-output-settings" className={`grid-cols-2 gap-2 lg:grid ${outputOpen ? 'grid' : 'hidden'}`}>
              <label className="text-xs">
                {copy.outputResolution}
                <select
                  className="block w-full rounded-md border border-border bg-surface p-1"
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value as RecastResolution)}
                >
                  {RECAST_RESOLUTIONS.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs">
                {copy.outputFraming}
                <select
                  className="block w-full rounded-md border border-border bg-surface p-1"
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(e.target.value as RecastFraming)}
                >
                  {RECAST_FRAMINGS.map((r) => (
                    <option key={r} value={r}>
                      {r === 'auto' ? 'Auto' : r}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <CharacterStudioRecastTiming
              settingsVisible={outputOpen || !timing.valid}
              showPrice={!reviewed}
              resolution={resolution}
              aspectRatio={aspectRatio}
              copy={copy}
              timing={timing}
              hasVideo={Boolean(video)}
              pendingHint={
                unresolved ? (unresolved.originalSeconds ? copy.passageNeeded : copy.readDuration) : editing ? copy.passageNeeded : null
              }
              sourceSeconds={passageSeconds(video)}
              hasAudio={Boolean(audio || dialogue.trim())}
              manual={manualSeconds}
              onManual={setManualSeconds}
              mode={mode}
              ready={active && canEstimate}
            />
          </fieldset>
          <CharacterStudioRecastReadiness
            id={readinessId}
            locale={copy.recastLocale}
            missingCharacter={!portrait}
            missingDirection={!hasDirection}
            pending={unresolved && !unresolved.originalSeconds ? 'reading' : unresolved || editing ? 'passage' : null}
            invalidDuration={!timing.valid}
            onCharacter={() => focusRequired(portraitSection.current?.querySelector('button'))}
            onDirection={() => focusRequired(directionSection.current?.querySelector('textarea'))}
            onPassage={() => (videoControl.editing || video && !video.range ? videoControl : audioControl).setEditing(true)}
            onDuration={() => focusRequired(readerRoot.current?.querySelector('#recast-duration'))}
          />
          <CharacterStudioRecastSubmit
            key={JSON.stringify([
              portrait?.url,
              portrait?.jobId,
              product?.url,
              video?.url,
              video?.range,
              audio?.url,
              audio?.range,
              prompt,
              dialogue,
              timing.seconds,
              resolution,
              aspectRatio,
            ])}
            copy={copy}
            blockedReasonId={active && !canExport ? readinessId : undefined}
            cache={uploads.current}
            onLock={onLock}
            onReviewed={setReviewed}
            setup={
              active && canExport && portrait
                ? {
                    portrait,
                    product,
                    video,
                    audio,
                    direction: prompt,
                    dialogue,
                    seconds: timing.seconds,
                    resolution,
                    aspectRatio,
                  }
                : null
            }
          />
        </div>
        <input
          ref={videoInput}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => {
            select(e.target.files?.[0], 'video');
            e.target.value = '';
          }}
        />
        <input
          ref={imageInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            select(e.target.files?.[0], 'image');
            e.target.value = '';
          }}
        />
      </aside>
      <section className="hidden min-h-0 flex-col rounded-2xl border border-border bg-surface lg:flex">
        <h2 className="border-b border-border p-4 text-sm font-medium">{copy.recastPreview}</h2>
        <div className="flex min-h-0 flex-1 items-center justify-center p-6">
          {video?.range ? (
            <RecastPassagePlayer
              kind="video"
              track={video}
              label={copy.recastPreview}
              className="max-h-full max-w-full rounded-xl bg-black"
            />
          ) : (
            <div className="max-w-xs text-center">
              <Clapperboard size={36} className="mx-auto mb-4 text-text-secondary" />
              <p className="text-sm leading-relaxed text-text-secondary">
                {video
                  ? video.originalSeconds
                    ? copy.passageNeeded
                    : copy.readDuration
                  : copy.recastPreviewHint}
              </p>
            </div>
          )}
        </div>
      </section>
      {active && editing && (
        <RecastPassageDialog
          kind={videoControl.editing ? 'video' : 'audio'}
          control={videoControl.editing ? videoControl : audioControl}
          copy={copy}
        />
      )}
    </div>
  );
}
