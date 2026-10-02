"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Sparkles, Sun, Moon } from "lucide-react";
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
  const studio = useImageConversation(projectId, accountKey, projectName);
  const exports = useConversationExports(projectId,exportsEnabled);
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
    if (follow.current)
      bottom.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [studio.conversation, studio.busy,exports.jobs]);
  const images = studio.conversation.turns
    .flatMap((turn) =>
      turn.generation?.result?.surface === "image"
        ? turn.generation.result.imageUrls
        : [],
    )
    .slice(-6);
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
    if (!text.trim() || studio.busy || studio.pending) return;
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
          <h1>Studio</h1>
          <span>{projectName}</span>
        </div>
        <div className={styles.headerActions}>
          <Link href="/app/studio/projects">{t('My projects', 'Mes projets')}</Link>
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
        <aside className={styles.visuals} aria-label={t('Project images','Images du projet')}>
          {images
            .filter((_, index) => index % 2 === 0)
            .map((url, index) => (
              <img
                key={`${url}:${index}`}
                src={url}
                alt={t('Image created in this conversation','Image créée dans cette conversation')}
              />
            ))}
        </aside>
        <div className={styles.conversation}>
          <div
            ref={log}
            className={styles.log}
            role="log"
            aria-label={t('Conversation with Studio', 'Conversation avec Studio')}
            aria-live="polite"
            onScroll={() => {
              const el = log.current;
              if (el)
                follow.current =
                  el.scrollHeight - el.scrollTop - el.clientHeight < 60;
            }}
          >
            {!studio.conversation.turns.length && !studio.pending && (
              <div className={styles.welcome}>
                <Sparkles size={24} />
                <h2>{t('Your idea takes shape.', 'Votre idée prend forme.')}</h2>
                <p>
                  {mediaEnabled ? t('Tell me about your film.', 'Parlez-moi de votre film.') : t('Tell me about the first image.', 'Parlez-moi de la première image.')}
                  <br />
                  {t('Attach your references. I’ll find a direction.', 'Joignez vos références, je m’occupe de la direction.')}
                </p>
                <small>{mediaEnabled ? t('Images · video · voice · music', 'Images · vidéo · voix · musique') : t('Connected image pilot', 'Premier essai connecté · création d’image')}</small>
              </div>
            )}
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
                    <p>
                      {turn.reply
                        .split(/(\*\*[^*\n]+\*\*)/g)
                        .map((part, index) =>
                          part.startsWith("**") && part.endsWith("**") ? (
                            <strong key={index}>{part.slice(2, -2)}</strong>
                          ) : (
                            part
                          ),
                        )}
                    </p>
                  </div>
                )}
                {turn.state === "thinking" && (
                  <p className={styles.muted}>{t('Studio is preparing a direction…', 'Studio prépare une direction…')}</p>
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
                    <img src={ref.thumbUrl ?? ref.url} alt="Référence jointe" />
                  ) : (
                    <span>{ref.kind ?? 'image'}</span>
                  )}
                  <span>×</span>
                </button>
              ))}
            </div>
          )}
          <ImageConversationComposer
            text={text}
            onTextChange={setText}
            onSend={() => void send()}
            blocked={studio.busy || !!studio.pending}
            libraryTrigger={libraryTrigger}
            onOpenLibrary={() => {setLibraryPurpose('reference');setLibrary(true);}}
            locale={locale}
          />
          <p className={styles.footnote}>
            {t('A quote before each creation. You stay in control.', 'Un devis avant chaque création. Vous gardez la main.')}
          </p>
        </div>
        <aside className={styles.visuals} aria-label={t('More project images','Autres images du projet')}>
          {images
            .filter((_, index) => index % 2 === 1)
            .map((url, index) => (
              <img
                key={`${url}:${index}`}
                src={url}
                alt={t('Image created in this conversation','Image créée dans cette conversation')}
              />
            ))}
        </aside>
      </div>
      {editingEnabled && <ConversationTimeline projectId={projectId} projectName={projectName} refreshKey={studio.conversation} insertion={timelineInsertion} onOpenLibrary={() => {setLibraryPurpose('timeline');setLibrary(true);}} exportAvailable={exportAvailable} exportPending={exports.working} exportJobs={exports.jobs} onExportChange={exports.refresh}/>}
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
