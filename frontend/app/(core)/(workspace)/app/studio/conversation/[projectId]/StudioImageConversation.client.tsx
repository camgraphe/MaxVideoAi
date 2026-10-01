"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Plus, Sparkles, Sun, Moon } from "lucide-react";
import { useImageConversation } from "./_hooks/useImageConversation";
import { ImageQuoteCard } from "./_components/ImageQuoteCard.client";
import { ImageConversationComposer } from "./_components/ImageConversationComposer.client";
import {
  ImageReferenceLibrary,
  type ImageLibraryAsset,
} from "./_components/ImageReferenceLibrary.client";
import styles from "./image-conversation.module.css";
export default function StudioImageConversation({
  projectId,
  accountKey,
  projectName,
  localQa = false,
}: {
  projectId: string;
  accountKey: string;
  projectName: string;
  localQa?: boolean;
}) {
  const studio = useImageConversation(projectId, accountKey, projectName);
  const [text, setText] = useState("");
  const [references, setReferences] = useState<ImageLibraryAsset[]>([]);
  const [library, setLibrary] = useState(false);
  const [tone, setTone] = useState<"charcoal" | "olive">("charcoal");
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
  }, [studio.conversation, studio.busy]);
  const images = studio.conversation.turns
    .flatMap((turn) =>
      turn.generation?.result?.surface === "image"
        ? turn.generation.result.imageUrls
        : [],
    )
    .slice(-6);
  function select(asset: ImageLibraryAsset) {
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
      references: references.map((ref) => ref.assetId),
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
      aria-label="Studio conversationnel"
    >
      <header className={styles.header}>
        <div>
          <h1>Studio</h1>
          <span>{projectName}</span>
        </div>
        <div className={styles.headerActions}>
          <Link href="/app/studio/projects">Mes projets</Link>
          <button
            aria-label={
              tone === "charcoal" ? "Passer en Olive" : "Passer en Charbon"
            }
            onClick={() =>
              setTone((current) =>
                current === "charcoal" ? "olive" : "charcoal",
              )
            }
          >
            {tone === "charcoal" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </header>
      <div className={styles.canvas}>
        <aside className={styles.visuals} aria-label="Images du projet">
          {images
            .filter((_, index) => index % 2 === 0)
            .map((url, index) => (
              <img
                key={`${url}:${index}`}
                src={url}
                alt="Image créée dans cette conversation"
              />
            ))}
        </aside>
        <div className={styles.conversation}>
          <div
            ref={log}
            className={styles.log}
            role="log"
            aria-label="Conversation avec Studio"
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
                <h2>Votre idée prend forme.</h2>
                <p>
                  Parlez-moi de la première image.
                  <br />
                  Joignez vos références, je m’occupe de la direction.
                </p>
                <small>Premier essai connecté · création d’image</small>
              </div>
            )}
            {studio.conversation.turns.map((turn) => (
              <article key={turn.requestId} className={styles.turn}>
                <p className={styles.userMessage}>{turn.message}</p>
                {!!turn.references.length && (
                  <span className={styles.referenceNote}>
                    {turn.references.length} référence
                    {turn.references.length > 1 ? "s" : ""} jointe
                    {turn.references.length > 1 ? "s" : ""}
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
                  <p className={styles.muted}>Studio prépare une direction…</p>
                )}
                {turn.state === "failed" && (
                  <button
                    disabled={studio.busy}
                    onClick={() =>
                      void studio.submit({
                        requestId: turn.requestId,
                        message: turn.message,
                        references: turn.references,
                      })
                    }
                  >
                    Reprendre cet échange
                  </button>
                )}
                <ImageQuoteCard
                  turn={turn}
                  busy={studio.busy}
                  localQa={localQa}
                  onRefresh={() => void studio.refresh()}
                  onConfirm={() =>
                    void studio.confirm(turn.requestId, turn.quote!.quoteId)
                  }
                  onRenew={() =>
                    void studio.submit({
                      requestId: crypto.randomUUID(),
                      message: turn.message,
                      references: turn.references,
                    })
                  }
                />
                {turn.generation?.result?.surface === "image" && (
                  <div className={styles.results}>
                    {turn.generation.result.imageUrls.map((url) => (
                      <figure key={url}>
                        <img src={url} alt="Votre création" loading="lazy" />
                        <figcaption>
                          <span>Votre image</span>
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Ouvrir
                          </a>
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                )}
                {turn.generation &&
                  ["accepted", "running"].includes(turn.generation.status) && (
                    <p className={styles.muted} role="status">
                      L’image se crée
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
            {studio.busy && (
              <p className={styles.thinking} role="status">
                <span />
                Studio travaille…
              </p>
            )}
            <div ref={bottom} />
          </div>
          {(studio.error || studio.canResumePending) && (
            <div className={styles.error} role="alert">
              <p>
                {studio.error ??
                  "Un échange est resté en attente. Vous pouvez le reprendre ou le modifier."}
              </p>
              {studio.pending ? (
                <>
                  <button
                    disabled={studio.busy}
                    onClick={() => void studio.submit(studio.pending!)}
                  >
                    Reprendre l’échange
                  </button>
                  <button
                    disabled={studio.busy}
                    onClick={() => {
                      const saved = studio.pending!;
                      setText(saved.message);
                      setReferences(
                        saved.references.map((assetId) => ({
                          assetId,
                          url: "",
                        })),
                      );
                      studio.discardPending();
                    }}
                  >
                    Modifier la demande
                  </button>
                </>
              ) : (
                <button
                  disabled={studio.busy}
                  onClick={() => void studio.refresh()}
                >
                  {studio.needsFunds ? "Actualiser le solde" : "Vérifier le résultat"}
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
                  aria-label="Retirer la référence"
                >
                  {ref.url ? (
                    <img src={ref.thumbUrl ?? ref.url} alt="Référence jointe" />
                  ) : (
                    <Plus size={18} />
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
            onOpenLibrary={() => setLibrary(true)}
          />
          <p className={styles.footnote}>
            Un devis avant chaque création. Vous gardez la main.
          </p>
        </div>
        <aside className={styles.visuals} aria-label="Autres images du projet">
          {images
            .filter((_, index) => index % 2 === 1)
            .map((url, index) => (
              <img
                key={`${url}:${index}`}
                src={url}
                alt="Image créée dans cette conversation"
              />
            ))}
        </aside>
      </div>
      {library && (
        <ImageReferenceLibrary
          onClose={() => setLibrary(false)}
          onSelect={select}
        />
      )}
    </section>
  );
}
