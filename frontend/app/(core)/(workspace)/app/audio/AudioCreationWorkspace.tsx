'use client';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { buildLoginHref } from '@/lib/auth-entry-href';
import { runAudioGenerate, useInfiniteJobs } from '@/lib/api';
import { AUDIO_CREATION_INTENTS, AUDIO_INTENT_PACK, buildAudioCreationRequest, isAudioDraftReady, isAudioIntent, type AudioCreationIntent } from '@/lib/audio-creation';
import { audioCreationCopy } from './_lib/audio-creation-copy';
import { fetchJobDetail, uploadAsset } from './_lib/audio-workspace-helpers';
import type { AudioJobDetail } from './_lib/audio-workspace-types';
import { useAudioCreationDraft } from './_hooks/useAudioCreationDraft';
import { useAudioCreationQuote } from './_hooks/useAudioCreationQuote';
import { useAudioCreationPolling } from './_hooks/useAudioCreationPolling';
import { AudioCreationEditor } from './_components/AudioCreationEditor';
import { AudioCreationResults } from './_components/AudioCreationResults';
import styles from './_components/audio-creation.module.css';
const ReferenceLibrary = dynamic(() => import('./_components/AudioReferenceLibrary'));
const VideoSoundtrack = dynamic(() => import('./AudioWorkspace'));

export default function AudioCreationWorkspace() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const { locale } = useI18n();
  const { user } = useRequireAuth({ redirectIfLoggedOut: false });
  const requestedIntent = params?.get('intent');
  const intent: AudioCreationIntent = isAudioIntent(requestedIntent) ? requestedIntent : 'voice';
  const userId = user?.id ?? null;
  const copy = audioCreationCopy(locale);
  const { draft, update, saved } = useAudioCreationDraft(userId, intent);
  const body = useMemo(() => buildAudioCreationRequest(intent, draft, locale), [intent, draft, locale]);
  const { quote, loading, error: quoteError, retry } = useAudioCreationQuote(body, userId, isAudioDraftReady(intent, draft) && requestedIntent !== 'video');
  const [selection, setSelection] = useState<{ owner: string | null; result: AudioJobDetail | null }>({ owner: null, result: null });
  const result = selection.owner === userId ? selection.result : null;
  const setResult = useCallback((job: AudioJobDetail | null) => setSelection({ owner: userId, result: job }), [userId]);
  useAudioCreationPolling(userId, result, setResult);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const scope = useRef({ userId, alive: true }); scope.current.userId = userId;
  const restoreSequence = useRef(0);
  const submitting = useRef(new Set<string>());
  const { stableJobs: jobs, isLoading, error: historyError, mutate } = useInfiniteJobs(12, { surface: 'audio' });
  useEffect(() => { const current = scope.current; current.alive = true; return () => { current.alive = false; }; }, []);
  useEffect(() => { setResult(null); setLibraryOpen(false); setNotice(null); setPending([]); setUploading(false); submitting.current.clear(); restoreSequence.current++; }, [userId, setResult]);
  const stillOwned = useCallback((owner: string | null) => scope.current.alive && scope.current.userId === owner, []);
  const selectJob = useCallback(async (jobId: string) => {
    if (!userId) return;
    const sequence = ++restoreSequence.current;
    try {
      const job = await fetchJobDetail(jobId);
      if (stillOwned(userId) && sequence === restoreSequence.current) {
        if (job.videoUrl && job.surface !== 'audio') {
          router.replace(`${pathname}?intent=video&job=${encodeURIComponent(jobId)}`, { scroll: false });
          return;
        }
        setResult(job);
      }
    } catch { if (stillOwned(userId) && sequence === restoreSequence.current) setNotice(copy.error); }
  }, [copy.error, stillOwned, userId, setResult, router, pathname]);
  const queryJob = params?.get('job');
  useEffect(() => { if (queryJob && requestedIntent !== 'video') void selectJob(queryJob); }, [queryJob, requestedIntent, selectJob]);
  const chooseIntent = (next: AudioCreationIntent) => { router.replace(`${pathname}?intent=${next}`, { scroll: false }); setNotice(null); setLibraryOpen(false); };

  const generate = async () => {
    if (!quote || !userId || quote.expiresAt <= Date.now() || submitting.current.has(quote.inputKey)) return;
    const owner = userId; const submitted = { ...body }; const inputKey = quote.inputKey;
    const sequence = ++restoreSequence.current;
    submitting.current.add(inputKey); setPending(previous => [...previous, inputKey]); setNotice(null);
    try {
      const response = await runAudioGenerate({ ...submitted, expectedQuote: { inputKey, totalCents: quote.pricing.totalCents, currency: quote.pricing.currency, expiresAt: quote.expiresAt } });
      if (!stillOwned(owner)) return;
      if (sequence === restoreSequence.current) setResult({ ...response, engineLabel: copy.intents[intent][0], settingsSnapshot: { pack: submitted.pack, script: submitted.script, prompt: submitted.prompt, lyrics: submitted.lyrics, providers: response.providers, voiceModel: submitted.voiceModel, minimaxVoiceId: submitted.minimaxVoiceId, seedAudioVoice: draft.voice, seedAudioSpeed: draft.speed, seedAudioVolume: draft.volume, seedAudioPitch: draft.pitch, language: draft.language, musicModel: submitted.musicModel, musicBpm: draft.bpm, refs: { voiceSampleUrl: draft.reference?.url }, measuredDurationSec: response.durationSec, requestedDurationSec: response.requestedDurationSec } });
      window.dispatchEvent(new CustomEvent('jobs:status', { detail: { ...response, finalPriceCents: response.pricing.totalCents } }));
      void mutate();
    } catch { if (stillOwned(owner)) { setNotice(copy.error); retry(); } }
    finally { if (stillOwned(owner)) { submitting.current.delete(inputKey); setPending(previous => previous.filter(key => key !== inputKey)); } }
  };
  const addReference = async (file: File) => {
    if (!userId) { setNotice(copy.signIn); return; }
    const owner = userId;
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
      if (!stillOwned(owner)) return;
      const reference = await uploadAsset(file, 'audio');
      if (stillOwned(owner)) update({ reference });
    } catch { if (stillOwned(owner)) setNotice(copy.uploadError); }
    finally { if (stillOwned(owner)) setUploading(false); }
  };
  const reuse = () => {
    const snapshot = result?.settingsSnapshot;
    if (!snapshot) return;
    const next = AUDIO_CREATION_INTENTS.find(key => AUDIO_INTENT_PACK[key] === snapshot.pack);
    if (!next) { router.push(`${pathname}?intent=video&job=${encodeURIComponent(result!.jobId)}`); return; }
    // Reuse targets the actual intent before applying the snapshot through the dedicated link.
    if (next !== intent) { router.replace(`${pathname}?intent=${next}&job=${encodeURIComponent(result!.jobId)}&reuse=1`, { scroll: false }); return; }
    update({ prompt: snapshot.prompt ?? '', script: snapshot.script ?? '', lyrics: snapshot.lyrics ?? '',
      voiceModel: snapshot.voiceModel === 'minimax' ? 'minimax' : 'seed', minimaxVoiceId: snapshot.minimaxVoiceId ?? 'English_FriendlyPerson',
      voice: snapshot.seedAudioVoice ?? 'default', speed: snapshot.seedAudioSpeed ?? 1, volume: snapshot.seedAudioVolume ?? 1, pitch: snapshot.seedAudioPitch ?? 0,
      language: snapshot.language ?? 'auto', mood: snapshot.mood ?? 'dreamy',
      durationSec: snapshot.requestedDurationSec ?? snapshot.durationSec ?? draft.durationSec, musicModel: snapshot.musicModel === 'pro' ? 'pro' : 'clip', bpm: snapshot.musicBpm ?? 110,
      reference: snapshot.refs?.voiceSampleUrl ? { url: snapshot.refs.voiceSampleUrl, name: copy.reference } : null });
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
    <header className={styles.header}><div><h1>{copy.title}</h1></div><a href={`${pathname}?intent=video`}>{copy.video}<span aria-hidden>↗</span></a></header>
    <nav className={styles.intents} aria-label={copy.title}>{AUDIO_CREATION_INTENTS.map((key, index) => <button type="button" className={styles.intent} key={key} aria-pressed={intent === key} onClick={() => chooseIntent(key)}><span className={styles.intentVisual} style={{ backgroundPositionX: `${index * 25}%` }} aria-hidden /><span className={styles.intentNumber} aria-hidden>0{index + 1}</span><span className={styles.intentCheck} aria-hidden>{intent === key ? '✓' : '↗'}</span><strong>{copy.intents[key][0]}</strong></button>)}</nav>
    {notice ? <div className={styles.status} role="alert">{notice}</div> : null}
    <div className={styles.layout}><div>
      <AudioCreationEditor intent={intent} draft={draft} copy={copy} onChange={update} onFile={file => void addReference(file)} uploading={uploading} onLibrary={() => userId ? setLibraryOpen(true) : setNotice(copy.signIn)} />
      <div className={styles.action}><div className={styles.price} aria-live="polite"><span>{loading ? copy.quoteLoading : quoteError ? copy.quoteError : !quote ? copy.quoteIdle : saved ? copy.saved : copy.unsaved}</span></div>
        {quoteError ? <button type="button" className={styles.retry} onClick={retry}>{copy.retry}</button> : null}
        {userId ? <button type="button" className={styles.generate} disabled={!quote || pending.includes(quote.inputKey) || uploading} onClick={() => void generate()}>{copy.generate}{price ? ` · ${price}` : ''}<span aria-hidden>↗</span></button> : <a className={styles.generate} href={buildLoginHref({ mode: 'signin', nextPath: `${pathname}?intent=${intent}` })}>{copy.signIn}</a>}
      </div>
    </div><AudioCreationResults intent={intent} copy={copy} result={result} pending={pending.length} onReuse={reuse}>
      <section className={styles.history}><h2>{copy.history}</h2>
        {userId && isLoading ? <p>{copy.loadingHistory}</p> : null}
        {userId && historyError ? <button type="button" onClick={() => void mutate()}>{copy.retry}</button> : null}
        {!userId || (!isLoading && !jobs.length) ? <p>{copy.emptyHistory}</p> : null}
        {userId ? jobs.map(job => <button type="button" key={job.jobId} onClick={() => void selectJob(job.jobId)}><span><strong>{job.prompt || job.engineLabel}</strong><small>{new Date(job.createdAt).toLocaleDateString(locale)} · {job.status === 'failed' ? copy.failed : job.audioUrl || job.videoUrl ? copy.listen : copy.generating}</small></span><span aria-hidden>↗</span></button>) : null}
      </section>
    </AudioCreationResults></div>
    {libraryOpen && userId ? <ReferenceLibrary key={userId} copy={copy} onClose={() => setLibraryOpen(false)} onSelect={reference => { update({ reference }); setLibraryOpen(false); }} /> : null}
  </main>;
}
