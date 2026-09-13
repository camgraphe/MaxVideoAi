'use client';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { AudioLines, CircleAlert, LoaderCircle, Play } from 'lucide-react';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { buildAuthReturnTarget, buildLoginHref } from '@/lib/auth-entry-href';
import { runAudioGenerate, useInfiniteJobs } from '@/lib/api';
import { AUDIO_CREATION_INTENTS, AUDIO_INTENT_PACK, buildAudioCreationRequest, isAudioDraftReady, isAudioIntent, type AudioCreationIntent } from '@/lib/audio-creation';
import type { Job } from '@/types/jobs';
import { audioCreationReusePatch } from './_lib/audio-creation-reuse';
import { audioCreationCopy } from './_lib/audio-creation-copy';
import { fetchJobDetail, uploadAsset } from './_lib/audio-workspace-helpers';
import type { AudioJobDetail } from './_lib/audio-workspace-types';
import { useAudioCreationDraft } from './_hooks/useAudioCreationDraft';
import { useAudioCreationQuote } from './_hooks/useAudioCreationQuote';
import { useAudioCreationPolling } from './_hooks/useAudioCreationPolling';
import { useAudioCreationScope } from './_hooks/useAudioCreationScope';
import { AudioCreationEditor } from './_components/AudioCreationEditor';
import { AudioCreationResults } from './_components/AudioCreationResults';
import styles from './_components/audio-creation.module.css';
import { StarterMediaShelf } from '@/components/starters/StarterMediaShelf.client';
const ReferenceLibrary = dynamic(() => import('./_components/AudioReferenceLibrary'));
const VideoSoundtrack = dynamic(() => import('./AudioWorkspace'));

export default function AudioCreationWorkspace() {
  const { user } = useRequireAuth({ redirectIfLoggedOut: false });
  const userId = user?.id ?? null;
  // Account transitions retire the entire observation surface before displaying the next account.
  return <OwnedAudioCreationWorkspace key={userId ?? 'guest'} userId={userId} />;
}

function OwnedAudioCreationWorkspace({ userId }: { userId: string | null }) {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const { locale } = useI18n();
  const requestedIntent = params?.get('intent');
  const intent: AudioCreationIntent = isAudioIntent(requestedIntent) ? requestedIntent : 'voice';
  const copy = audioCreationCopy(locale);
  const { draft, update, saved } = useAudioCreationDraft(userId, intent);
  const body = useMemo(() => buildAudioCreationRequest(intent, draft, locale), [intent, draft, locale]);
  const { quote, loading, error: quoteError, retry, isCurrent: isCurrentQuote } = useAudioCreationQuote(body, userId, isAudioDraftReady(intent, draft) && requestedIntent !== 'video');
  const [selection, setSelection] = useState<{ owner: string | null; result: AudioJobDetail | null }>({ owner: null, result: null });
  const result = selection.owner === userId ? selection.result : null;
  const setResult = useCallback((job: AudioJobDetail | null) => setSelection({ owner: userId, result: job }), [userId]);
  useAudioCreationPolling(userId, result, setResult);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectingJobId, setSelectingJobId] = useState<string | null>(null);
  const [pending, setPending] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const scope = useAudioCreationScope(userId);
  const restoreSequence = useRef(0);
  const invalidateRestoreSequence = useCallback(() => {
    restoreSequence.current += 1;
  }, []);
  const submitting = useRef(new Set<string>());
  const { stableJobs: jobs, isLoading, error: historyError, mutate } = useInfiniteJobs(12, { surface: 'audio' });
  const stillOwned = scope.isCurrent;
  const selectJob = useCallback(async (jobId: string, preview?: Job) => {
    if (!userId || !stillOwned()) return;
    if (preview?.videoUrl && preview.surface !== 'audio') {
      router.replace(`${pathname}?intent=video&job=${encodeURIComponent(jobId)}`, { scroll: false });
      return;
    }
    const sequence = ++restoreSequence.current;
    setSelectingJobId(jobId);
    // The feed already owns the playable media URLs. Show that result immediately while
    // the detail request enriches settings and provider metadata in the background.
    if (preview?.audioUrl || preview?.videoUrl) {
      setResult({
        jobId: preview.jobId,
        surface: preview.surface,
        videoUrl: preview.videoUrl ?? null,
        audioUrl: preview.audioUrl ?? null,
        thumbUrl: preview.thumbUrl ?? null,
        aspectRatio: preview.aspectRatio ?? null,
        engineLabel: preview.engineLabel,
        durationSec: preview.durationSec,
        createdAt: preview.createdAt,
      });
    }
    try {
      const job = await fetchJobDetail(jobId);
      if (stillOwned() && sequence === restoreSequence.current) {
        if (job.videoUrl && job.surface !== 'audio') {
          router.replace(`${pathname}?intent=video&job=${encodeURIComponent(jobId)}`, { scroll: false });
          return;
        }
        setResult(job);
      }
    } catch { if (stillOwned() && sequence === restoreSequence.current) setNotice(copy.error); }
    finally {
      if (stillOwned() && sequence === restoreSequence.current) {
        setSelectingJobId(current => current === jobId ? null : current);
      }
    }
  }, [copy.error, stillOwned, userId, setResult, router, pathname]);
  const queryJob = params?.get('job');
  useEffect(() => {
    if (queryJob && requestedIntent !== 'video') void selectJob(queryJob);
    return invalidateRestoreSequence;
  }, [invalidateRestoreSequence, queryJob, requestedIntent, selectJob]);
  const chooseIntent = (next: AudioCreationIntent) => {
    // Next's native history integration updates useSearchParams without an RSC navigation.
    // Read the live URL so rapid choices cannot overwrite a newer history entry.
    const url = new URL(window.location.href);
    url.searchParams.set('intent', next);
    url.searchParams.delete('job');
    url.searchParams.delete('reuse');
    if (url.href !== window.location.href) window.history.pushState(null, '', url);
    invalidateRestoreSequence();
    setNotice(null);
    setSelectingJobId(null);
    setLibraryOpen(false);
  };

  const generate = async () => {
    if (!stillOwned() || !isCurrentQuote() || !quote || !userId || quote.expiresAt <= Date.now() || submitting.current.has(quote.inputKey)) return;
    const submitted = { ...body }; const inputKey = quote.inputKey;
    const sequence = ++restoreSequence.current;
    submitting.current.add(inputKey); setPending(previous => [...previous, inputKey]); setNotice(null);
    try {
      const response = await runAudioGenerate({ ...submitted, expectedQuote: { inputKey, totalCents: quote.pricing.totalCents, currency: quote.pricing.currency, expiresAt: quote.expiresAt } });
      if (!stillOwned()) return;
      if (sequence === restoreSequence.current) setResult({ ...response, engineLabel: copy.intents[intent][0], settingsSnapshot: { pack: submitted.pack, script: submitted.script, prompt: submitted.prompt, lyrics: submitted.lyrics, providers: response.providers, voiceModel: submitted.voiceModel, minimaxVoiceId: submitted.minimaxVoiceId, seedAudioVoice: submitted.seedAudioVoice, seedAudioOutputFormat: submitted.seedAudioOutputFormat, seedAudioSampleRate: Number(submitted.seedAudioSampleRate) || null, voiceDelivery: submitted.voiceDelivery, voiceProfile: submitted.voiceProfile, voiceGender: submitted.voiceGender, seedAudioSpeed: draft.speed, seedAudioVolume: draft.volume, seedAudioPitch: draft.pitch, language: draft.language, musicModel: submitted.musicModel, musicBpm: draft.bpm, refs: { voiceSampleUrl: draft.reference?.url }, measuredDurationSec: response.durationSec, requestedDurationSec: response.requestedDurationSec } });
      window.dispatchEvent(new CustomEvent('jobs:status', { detail: { ...response, finalPriceCents: response.pricing.totalCents } }));
      void mutate();
    } catch { if (stillOwned()) { setNotice(copy.error); retry(); } }
    finally { if (stillOwned()) { submitting.current.delete(inputKey); setPending(previous => previous.filter(key => key !== inputKey)); } }
  };
  const addReference = async (file: File) => {
    if (!userId) { setNotice(copy.signIn); return; }
    if (!stillOwned()) return;
    if (file.size > 10 * 1024 * 1024 || !/\.(mp3|wav)$/i.test(file.name)) { setNotice(copy.uploadError); return; }
    setUploading(true);
    try {
      const url = URL.createObjectURL(file);
      try {
        await new Promise<void>((resolve, reject) => {
          const audio = new Audio(); const timeout = setTimeout(() => finish(false), 8000);
          const finish = (ok: boolean) => { clearTimeout(timeout); audio.removeAttribute('src'); audio.load(); if (ok) resolve(); else reject(new Error('duration')); };
          audio.onloadedmetadata = () => finish(Number.isFinite(audio.duration) && audio.duration > 0 && audio.duration <= 30);
          audio.onerror = () => finish(false); audio.src = url;
        });
      } finally { URL.revokeObjectURL(url); }
      if (!stillOwned()) return;
      const reference = await uploadAsset(file, 'audio');
      if (stillOwned()) update({ reference });
    } catch { if (stillOwned()) setNotice(copy.uploadError); }
    finally { if (stillOwned()) setUploading(false); }
  };
  const reuse = () => {
    const snapshot = result?.settingsSnapshot;
    if (!snapshot) return;
    const next = AUDIO_CREATION_INTENTS.find(key => AUDIO_INTENT_PACK[key] === snapshot.pack);
    if (!next) { router.push(`${pathname}?intent=video&job=${encodeURIComponent(result!.jobId)}`); return; }
    // Reuse targets the actual intent before applying the snapshot through the dedicated link.
    if (next !== intent) {
      const url = new URL(window.location.href);
      url.searchParams.set('intent', next);
      url.searchParams.set('job', result!.jobId);
      url.searchParams.set('reuse', '1');
      window.history.pushState(null, '', url);
      return;
    }
    update(audioCreationReusePatch(snapshot, draft, copy.reference));
  };
  // Cross-intent reuse waits for navigation and an owned job read, then applies once.
  const reuseRef = useRef('');
  useEffect(() => {
    if (params?.get('reuse') === '1' && result?.jobId === queryJob && AUDIO_INTENT_PACK[intent] === result?.settingsSnapshot?.pack && reuseRef.current !== `${userId}:${queryJob}:${intent}`) {
      reuseRef.current = `${userId}:${queryJob}:${intent}`; reuse();
    }
  });
  if (requestedIntent === 'video') return <div className="flex min-w-0 flex-1 flex-col"><div className={styles.root} style={{ flex: 'none', paddingBottom: 0 }}><a href={`${pathname}?intent=voice`}>← {copy.back}</a></div><VideoSoundtrack key={userId ?? 'guest'} /></div>;
  const price = quote ? new Intl.NumberFormat(locale, { style: 'currency', currency: quote.pricing.currency }).format(quote.pricing.totalCents / 100) : null;
  return <main className={styles.root} data-audio-creation={intent}>
    <header className={styles.header}><h1 className="sr-only">{copy.title}</h1><a href={`${pathname}?intent=video`}>{copy.video}<span aria-hidden>↗</span></a></header>
    <nav className={styles.intents} aria-label={copy.title}>{AUDIO_CREATION_INTENTS.map((key, index) => <button type="button" className={styles.intent} key={key} aria-pressed={intent === key} onClick={() => chooseIntent(key)}><span className={styles.intentVisual} style={{ backgroundPositionX: `${index * 25}%` }} aria-hidden /><span className={styles.intentNumber} aria-hidden>0{index + 1}</span><span className={styles.intentCheck} aria-hidden>{intent === key ? '✓' : '↗'}</span><strong>{copy.intents[key][0]}</strong></button>)}</nav>
    {notice ? <div className={styles.status} role="alert">{notice}</div> : null}
    <div className={styles.layout}><div>
      <AudioCreationEditor intent={intent} draft={draft} copy={copy} onChange={update} onFile={file => void addReference(file)} uploading={uploading} onLibrary={() => userId ? setLibraryOpen(true) : setNotice(copy.signIn)} />
      <div className={styles.action}><div className={styles.price} aria-live="polite"><span>{loading ? copy.quoteLoading : quoteError ? quoteError.message : !quote ? copy.quoteIdle : saved ? copy.saved : copy.unsaved}</span>{quoteError ? <small>{quoteError.code}</small> : null}</div>
        {quoteError ? <button type="button" className={styles.retry} onClick={retry}>{copy.retry}</button> : null}
        {userId ? <button type="button" className={styles.generate} disabled={!quote || pending.includes(quote.inputKey) || uploading} onClick={() => void generate()}>{copy.generate}{price ? ` · ${price}` : ''}<span aria-hidden>↗</span></button> : <a className={styles.generate} href={buildLoginHref({ mode: 'signin', nextPath: buildAuthReturnTarget(pathname, params) })}>{copy.signIn}</a>}
      </div>
    </div><AudioCreationResults intent={intent} copy={copy} result={result} pending={pending.length} onReuse={reuse}>
      {!pending.length && !result && (!userId || (!isLoading && !historyError && !jobs.length)) ? <StarterMediaShelf surface="audio" /> : null}
      <section className={styles.history}><h2>{copy.history}</h2><p className={styles.historyHint}>{copy.historyHint}</p>
        {userId && isLoading ? <p>{copy.loadingHistory}</p> : null}
        {userId && historyError ? <button type="button" onClick={() => void mutate()}>{copy.retry}</button> : null}
        {!userId || (!isLoading && !jobs.length) ? <p>{copy.emptyHistory}</p> : null}
        {userId ? jobs.map(job => {
          const isSelected = result?.jobId === job.jobId;
          const isSelecting = selectingJobId === job.jobId;
          const isFailed = job.status === 'failed';
          const isPlayable = Boolean(job.audioUrl || job.videoUrl);
          const RowIcon = isSelecting ? LoaderCircle : isSelected ? AudioLines : isFailed ? CircleAlert : Play;
          const label = job.prompt || job.engineLabel;
          return <div className={styles.historyEntry} data-active={isSelected || undefined} key={job.jobId}>
            <button
              type="button"
              className={styles.historyItem}
              aria-pressed={isSelected}
              aria-busy={isSelecting}
              onClick={() => void selectJob(job.jobId, job)}
            >
              <span className={styles.historyIcon} aria-hidden><RowIcon size={17} /></span>
              <span className={styles.historyCopy}><strong>{label}</strong><small>{new Date(job.createdAt).toLocaleDateString(locale)} · {isFailed ? copy.failed : isPlayable ? copy.listen : copy.generating}</small></span>
              {isSelected ? <span className={styles.historySelected}>{copy.selected}</span> : <span className="sr-only">{copy.select}</span>}
            </button>
            {job.audioUrl && !isFailed ? <audio className={styles.historyAudio} controls preload="none" src={job.audioUrl} aria-label={`${copy.listen}: ${label}`} onPlay={() => { if (!isSelected) void selectJob(job.jobId, job); }} /> : null}
          </div>;
        }) : null}
      </section>
    </AudioCreationResults></div>
    {libraryOpen && userId ? <ReferenceLibrary key={userId} copy={copy} onClose={() => setLibraryOpen(false)} onSelect={reference => { update({ reference }); setLibraryOpen(false); }} /> : null}
  </main>;
}
