"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Sun, Moon, HelpCircle, ArrowDown, FolderOpen, X, ImagePlus } from "lucide-react";
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
import {ConversationMediaShelf} from './_components/ConversationMediaShelf.client';
import {useConversationMediaShelf} from './_hooks/useConversationMediaShelf';
import {insertMediaMention,removeMediaMention,readShelfDrag,MEDIA_SHELF_DRAG_TYPE,type ShelfMedia} from './_lib/conversation-media-shelf';
function StudioImageConversationWorkspace({
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
  const shelf = useConversationMediaShelf(studio.conversation.turns,locale,mediaEnabled);
  const references = shelf.references;
  const [dropping,setDropping] = useState(false);
  const dragDepth=useRef(0);
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
    if (!text.trim()) setText(value);
    composerRegion.current?.querySelector('textarea')?.focus();
  }
  function select(asset: ImageLibraryAsset) {
    if (libraryPurpose === 'timeline') {setTimelineInsertion({key: crypto.randomUUID(),asset});setLibrary(false);return;}
    shelf.attach(asset);
    setLibrary(false);
  }
  function mention(item:ShelfMedia) {
    const textarea=composerRegion.current?.querySelector('textarea');
    const inserted=insertMediaMention(text,item.label,textarea?.selectionStart??text.length,textarea?.selectionEnd??text.length);
    if(!inserted){shelf.setError(t('Make a little room in your message to add this reference.','Raccourcissez un peu votre message pour ajouter cette référence.'));return;}
    if(!shelf.attach(item))return;
    setText(inserted.text);
    requestAnimationFrame(()=>{textarea?.focus();textarea?.setSelectionRange(inserted.caret,inserted.caret);});
  }
  function detach(item:ShelfMedia) {shelf.detach(item.assetId);setText(current=>removeMediaMention(current,item.label));}
  async function send() {
    if (!text.trim() || studio.loading || studio.busy || studio.pending || shelf.uploading) return;
    const input = {
      requestId: crypto.randomUUID(),
      message: text,
      references: references.filter(ref => !ref.kind || ref.kind === 'image').map((ref) => ref.assetId),
      ...(references.length ? {referenceMentions:references.map(ref=>({assetId:ref.assetId,label:ref.label}))} : {}),
      ...(mediaEnabled ? {attachments: references.filter(ref => ref.kind === 'video' || ref.kind === 'audio').map(ref => ({type: 'asset' as const, assetId: ref.assetId, kind: ref.kind as 'video' | 'audio'}))} : {}),
    };
    setText("");
    shelf.clear();
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
      <div className={styles.canvas} data-has-media={shelf.items.length>0} data-dropping={dropping}
        onDragEnter={event=>{if(event.dataTransfer.types.includes('Files')){event.preventDefault();dragDepth.current++;setDropping(true);}}}
        onDragOver={event=>{if(event.dataTransfer.types.includes('Files')){event.preventDefault();event.dataTransfer.dropEffect='copy';}}}
        onDragLeave={event=>{if(event.dataTransfer.types.includes('Files')&&--dragDepth.current<=0){dragDepth.current=0;setDropping(false);}}}
        onDrop={event=>{if(event.dataTransfer.types.includes('Files')){event.preventDefault();dragDepth.current=0;setDropping(false);if(studio.loading){shelf.setError(t('Your workspace is opening. Try dropping your media again in a moment.','Votre espace s’ouvre. Déposez à nouveau vos médias dans un instant.'));return;}void shelf.upload(Array.from(event.dataTransfer.files));}}}>
        {dropping&&<div className={styles.dropSurface}><ImagePlus size={28}/><span>{t('Bring it into the conversation','Ajoutez-le à la conversation')}</span><small>{t('Drop your media here','Déposez vos médias ici')}</small></div>}
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
            {!studio.loading && !studio.error && !studio.conversation.turns.length && !studio.pending && <ConversationWelcome locale={locale} onDraft={startDraft} onReference={openReferences} hasDraft={!!text.trim()}/>}
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
                      ...(turn.referenceMentions ? {referenceMentions:turn.referenceMentions} : {}),
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
                      shelf.restore(saved);
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
            <div className={styles.attachments} aria-label={t('Attached to next message','Joints au prochain message')}>
              {references.map((ref) => (
                <div key={ref.assetId} className={styles.referenceChip}><button onClick={()=>{shelf.setSelectedId(ref.assetId);shelf.setExpanded(true);}} aria-label={t('Preview ','Aperçu de ')+ref.label}>{ref.label}</button><button onClick={()=>detach(ref)} aria-label={t('Remove ','Retirer ')+ref.label}><X size={12}/></button></div>
              ))}
            </div>
          )}
          {shelf.uploading&&<p className={styles.mediaStatus} role="status">{t('Importing your media…','Import de vos médias…')}</p>}
          {shelf.error&&<p className={styles.mediaStatus} role="alert">{shelf.error}</p>}
          <div ref={composerRegion} className={styles.composerRegion}
            onDragOver={event=>{if(event.dataTransfer.types.includes(MEDIA_SHELF_DRAG_TYPE)){event.preventDefault();event.dataTransfer.dropEffect='copy';}}}
            onDrop={event=>{const item=readShelfDrag(event.dataTransfer,shelf.items);if(item){event.preventDefault();event.stopPropagation();mention(item);}}}>
          <ImageConversationComposer
            text={text}
            onTextChange={setText}
            onSend={() => void send()}
            blocked={studio.loading || studio.busy || !!studio.pending || shelf.uploading}
            libraryTrigger={libraryTrigger}
            onOpenLibrary={openReferences}
            locale={locale}
          />
          </div>
          <p className={styles.footnote}>
            {t('Your direction. Your decision. Review the price before you create.', 'Votre direction. Vos décisions. Vérifiez le prix avant de créer.')}
          </p>
        </div>
        <ConversationMediaShelf projectId={projectId} items={shelf.items} selectedId={shelf.selectedId} expanded={shelf.expanded} attachedIds={references.map(ref=>ref.assetId)} locale={locale} onSelect={shelf.setSelectedId} onToggle={()=>shelf.setExpanded(current=>!current)} onMention={mention} onAttach={shelf.attach} onDetach={detach}/>
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

/** A new account/project must also discard unsent local drafts and preview grants. */
export default function StudioImageConversation(props:Parameters<typeof StudioImageConversationWorkspace>[0]) {
  return <StudioImageConversationWorkspace key={`${props.accountKey}:${props.projectId}`} {...props}/>;
}
