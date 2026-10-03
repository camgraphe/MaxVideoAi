"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Sparkles, Sun, Moon, HelpCircle, ArrowDown, FolderOpen } from "lucide-react";
import { useImageConversation } from "./_hooks/useImageConversation";
import {ConversationExportQuote} from "./_components/ConversationExportQuote.client";
import { ImageQuoteCard } from "./_components/ImageQuoteCard.client";
import { ImageConversationComposer } from "./_components/ImageConversationComposer.client";
import {
  ImageReferenceLibrary,
  type ImageLibraryAsset,
} from "./_components/ImageReferenceLibrary.client";
import styles from "./image-conversation.module.css";
import {useI18n} from '@/lib/i18n/I18nProvider';
import {ConversationMedia} from './_components/ConversationMedia.client';
import {ConversationTimeline} from './_components/ConversationTimeline.client';
import {useConversationExports} from './_hooks/useConversationExports';
import {ConversationRenderCards} from './_components/ConversationRenderCards.client';
import {imageTurnRetryInput} from '@/lib/studio/image-conversation-contract';
import {useThemePreference} from '@/hooks/useThemePreference';
import {ConversationWelcome} from './_components/ConversationWelcome.client';
import {ConversationHelp} from './_components/ConversationHelp.client';
import {ConversationReply} from './_components/ConversationReply';
export default function StudioImageConversation({
  projectId,
  accountKey,
  projectName,
  localQa = false,
  mediaEnabled = false,
  editingEnabled = false,
  exportsEnabled = false,
  exportAvailable = false,
}: {
  projectId: string;
  accountKey: string;
  projectName: string;
  localQa?: boolean;
  mediaEnabled?: boolean;
  editingEnabled?: boolean;
  exportsEnabled?: boolean;
  exportAvailable?: boolean;
}) {
  const {locale: appLocale} = useI18n();
  const locale = appLocale === 'fr' ? 'fr' : 'en';
  const t = (en: string, fr: string) => locale === 'fr' ? fr : en;
  const studio = useImageConversation(projectId, accountKey, projectName, locale);
  const exports = useConversationExports(projectId,exportsEnabled);
  const [help, setHelp] = useState(false);
  const [following, setFollowing] = useState(true);
  const helpTrigger = useRef<HTMLButtonElement>(null);
  const composerRegion = useRef<HTMLDivElement>(null);
  const [text, setText] = useState("");
  const [references, setReferences] = useState<ImageLibraryAsset[]>([]);
  const [library, setLibrary] = useState(false);
  const [libraryPurpose,setLibraryPurpose] = useState<'reference'|'timeline'>('reference');
  const [timelineInsertion,setTimelineInsertion] = useState<{key: string;asset: ImageLibraryAsset} | null>(null);
  const {resolvedTheme,toggleTheme} = useThemePreference();
  const tone = resolvedTheme === 'light' ? 'olive' : 'charcoal';
  const libraryTrigger = useRef<HTMLButtonElement>(null);
  const libraryWasOpen = useRef(false);
  useEffect(() => {
    if (library) libraryWasOpen.current = true;
    else if (libraryWasOpen.current) {
      libraryTrigger.current?.focus();
      libraryWasOpen.current = false;
    }
  }, [library]);
  const log = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (follow.current && (studio.conversation.turns.length || studio.pending))
      bottom.current?.scrollIntoView({ block: "end", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }, [studio.conversation, studio.pending, studio.busy,exports.jobs]);
  function openReferences() {setLibraryPurpose('reference');setLibrary(true);}
  function startDraft(value: string) {
    setText(value);
    composerRegion.current?.querySelector('textarea')?.focus();
  }
  function select(asset: ImageLibraryAsset) {
    if (libraryPurpose === 'timeline') {setTimelineInsertion({key: crypto.randomUUID(),asset});setLibrary(false);return;}
    setReferences((current) =>
      current.some((ref) => ref.assetId === asset.assetId)
        ? current
        : [...current, asset].slice(0, 8),
    );
    setLibrary(false);
  }
  async function send() {
    if (!text.trim() || studio.loading || studio.busy || studio.pending) return;
    const input = {
      requestId: crypto.randomUUID(),
      message: text,
      references: references.filter(ref => !ref.kind || ref.kind === 'image').map((ref) => ref.assetId),
      ...(mediaEnabled ? {attachments: references.filter(ref => ref.kind === 'video' || ref.kind === 'audio').map(ref => ({type: 'asset' as const, assetId: ref.assetId, kind: ref.kind as 'video' | 'audio'}))} : {}),
    };
    setText("");
    setReferences([]);
    follow.current = true;
    await studio.submit(input);
  }
  return (
    <section
      className={styles.studio}
      data-tone={tone}
      aria-label={t('Conversational Studio', 'Studio conversationnel')}
    >
      <header className={styles.header}>
        <div>
          <h1>Studio<span className={styles.headerDot}>.</span></h1>
          <span>{projectName}</span>
        </div>
        <div className={styles.headerActions}>
          <Link href="/app/studio/projects" aria-label={t('My projects','Mes projets')} className={styles.projectsLink}><FolderOpen size={16} aria-hidden="true"/><span>{t('My projects', 'Mes projets')}</span></Link>
          <button ref={helpTrigger} aria-label={t('Studio help','Aide Studio')} onClick={() => setHelp(true)}><HelpCircle size={18}/></button>
          <button
            aria-label={
              tone === "charcoal" ? t('Switch to Olive', 'Passer en Olive') : t('Switch to Charcoal', 'Passer en Charbon')
            }
            onClick={toggleTheme}
          >
            {tone === "charcoal" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </header>
      <div className={styles.canvas}>
        <div className={styles.conversation}>
          <div
            ref={log}
            className={styles.log}
            role="log"
            aria-label={t('Conversation with Studio', 'Conversation avec Studio')}
            aria-live="polite"
            onScroll={() => {
              const el = log.current;
              if (el) {
                follow.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
                setFollowing(follow.current);
              }
            }}
          >
            {studio.loading && <div className={styles.loading} role="status"><span className={styles.loadingMark}/>{t('Opening your workspace…','Ouverture de votre espace…')}</div>}
            {!studio.loading && !studio.error && !studio.conversation.turns.length && !studio.pending && <ConversationWelcome locale={locale} onDraft={startDraft} onReference={openReferences}/>}
            {studio.conversation.turns.map((turn) => (
              <article key={turn.requestId} className={styles.turn}>
                <p className={styles.userMessage}>{turn.message}</p>
                {!!(turn.references.length + (turn.attachments?.length ?? 0)) && (
                  <span className={styles.referenceNote}>
                    {turn.references.length + (turn.attachments?.length ?? 0)} {t('attached references', 'références jointes')}
                  </span>
                )}
                {turn.reply && (
                  <div className={styles.reply}>
                    <Sparkles size={16} />
                    <ConversationReply text={turn.reply} className={styles.replyBody}/>
                  </div>
                )}
                {turn.state === "thinking" && (
                  <p className={styles.muted}>{t('Thinking through your request…', 'Réflexion sur votre demande…')}</p>
                )}
                {turn.state === "failed" && (
                  <button
                    disabled={studio.busy}
                    onClick={() =>
                      void studio.submit(imageTurnRetryInput(turn))
                    }
                  >
                    {t('Resume this exchange', 'Reprendre cet échange')}
                  </button>
                )}
                <ImageQuoteCard
                  turn={turn}
                  busy={studio.busy}
                  localQa={localQa}
                  locale={locale}
                  onRefresh={() => void studio.refresh()}
                  onConfirm={() =>
                    void studio.confirm(turn.requestId, turn.quote!.quoteId)
                  }
                  onRenew={() =>
                    void studio.submit({
                      requestId: crypto.randomUUID(),
                      message: turn.message,
                      references: turn.references,
                      ...(turn.attachments ? {attachments: turn.attachments} : {}),
                      renewedFromRequestId: turn.requestId,
                    })
                  }
                />
                {exportsEnabled && turn.exportQuote && <ConversationExportQuote quote={turn.exportQuote} jobs={exports.jobs} busy={studio.busy} locale={locale} onChange={exports.refresh} onRenew={()=>void studio.submit({requestId:crypto.randomUUID(),message:locale==='fr'?`Prépare un nouveau devis d’export ${turn.exportQuote!.qualityPreset} pour le montage actuel, ${turn.exportQuote!.includeAudio?'avec':'sans'} audio.`:`Prepare a fresh ${turn.exportQuote!.qualityPreset} export quote for the current cut, ${turn.exportQuote!.includeAudio?'with':'without'} audio.`,references:[]})}/>}
                {turn.generation?.result && <ConversationMedia result={turn.generation.result} locale={locale} />}
                {turn.generation &&
                  ["accepted", "running"].includes(turn.generation.status) && (
                    <p className={styles.muted} role="status">
                      {t('Creating your media', 'Le média se crée')}
                      {turn.generation.progress === null
                        ? "…"
                        : ` · ${turn.generation.progress}%`}
                    </p>
                  )}
              </article>
            ))}
            {studio.pending &&
              !studio.conversation.turns.some(
                (turn) => turn.requestId === studio.pending?.requestId,
              ) && (
                <p className={styles.userMessage}>{studio.pending.message}</p>
              )}
            {exportsEnabled && <ConversationRenderCards jobs={exports.jobs} locale={locale}/>}
            {exports.error && <p className={styles.muted}>{t('Film results are temporarily unavailable. Your conversation is saved.','Les rendus sont temporairement indisponibles. Votre conversation est conservée.')}</p>}
            {studio.busy && (
              <p className={styles.thinking} role="status">
                <span />
                {t('Studio is working…', 'Studio travaille…')}
              </p>
            )}
            <div ref={bottom} />
          </div>
          {!following && <button className={styles.jumpLatest} onClick={() => {follow.current = true;setFollowing(true);bottom.current?.scrollIntoView({block:'end',behavior:'instant'});}}><ArrowDown size={14}/>{t('Latest message','Dernier message')}</button>}
          {(studio.error || studio.canResumePending) && (
            <div className={styles.error} role="alert">
              <p>
                {studio.error ??
                  t('An exchange is pending. Resume it or edit your request.', 'Un échange est resté en attente. Vous pouvez le reprendre ou le modifier.')}
              </p>
              {studio.pending ? (
                <>
                  <button
                    disabled={studio.busy}
                    onClick={() => void studio.submit(studio.pending!)}
                  >
                    {t('Resume exchange', 'Reprendre l’échange')}
                  </button>
                  <button
                    disabled={studio.busy}
                    onClick={() => {
                      const saved = studio.pending!;
                      setText(saved.message);
                      setReferences(
                        [...saved.references.map((assetId) => ({
                          assetId,
                          url: "",
                        })), ...(saved.attachments ?? []).flatMap(ref => ref.type === 'asset' ? [{assetId: ref.assetId, url: '', kind: ref.kind}] : [])],
                      );
                      studio.discardPending();
                    }}
                  >
                    {t('Edit request', 'Modifier la demande')}
                  </button>
                </>
              ) : (
                <button
                  disabled={studio.busy}
                  onClick={() => void studio.refresh()}
                >
                  {studio.needsFunds ? t('Refresh balance', 'Actualiser le solde') : t('Check result', 'Vérifier le résultat')}
                </button>
              )}
            </div>
          )}
          {!!references.length && (
            <div className={styles.attachments}>
              {references.map((ref) => (
                <button
                  key={ref.assetId}
                  onClick={() =>
                    setReferences((current) =>
                      current.filter((asset) => asset.assetId !== ref.assetId),
                    )
                  }
                  aria-label={t('Remove reference', 'Retirer la référence')}
                >
                  {ref.url && (!ref.kind || ref.kind === 'image' || ref.thumbUrl) ? (
                    <img src={ref.thumbUrl ?? ref.url} alt={t('Attached reference','Référence jointe')} />
                  ) : (
                    <span>{ref.kind ?? 'image'}</span>
                  )}
                  <span>×</span>
                </button>
              ))}
            </div>
          )}
          <div ref={composerRegion} className={styles.composerRegion}>
          <ImageConversationComposer
            text={text}
            onTextChange={setText}
            onSend={() => void send()}
            blocked={studio.loading || studio.busy || !!studio.pending}
            libraryTrigger={libraryTrigger}
            onOpenLibrary={openReferences}
            locale={locale}
          />
          </div>
          <p className={styles.footnote}>
            {t('Your direction. Your decision. Review the price before you create.', 'Votre direction. Vos décisions. Vérifiez le prix avant de créer.')}
          </p>
        </div>
      </div>
      {editingEnabled && <ConversationTimeline projectId={projectId} projectName={projectName} refreshKey={studio.conversation} insertion={timelineInsertion} onOpenLibrary={() => {setLibraryPurpose('timeline');setLibrary(true);}} exportAvailable={exportAvailable} exportPending={exports.working} exportJobs={exports.jobs} onExportChange={exports.refresh}/>}
      {help && <ConversationHelp locale={locale} editingEnabled={editingEnabled} onClose={() => setHelp(false)} trigger={helpTrigger}/>}
      {library && (
        <ImageReferenceLibrary
          onClose={() => setLibrary(false)}
          onSelect={select}
          mediaEnabled={mediaEnabled}
          locale={locale}
        />
      )}
    </section>
  );
}
