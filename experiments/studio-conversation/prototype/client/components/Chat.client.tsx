import { useEffect, useRef, useState } from "react";
import {
  Plus,
  ArrowUp,
  Sparkles,
  X,
  ArrowDown,
  LoaderCircle,
  RotateCcw,
} from "lucide-react";
import type {
  Asset,
  Project,
  Command,
  AssistantInfo,
} from "../../shared/types";
import { AssetResult } from "./AssetResult.client";
export function Chat({
  project,
  busy,
  assistant,
  onRetry,
  references,
  onSend,
  onLibrary,
  onSelect,
  onAdd,
  onCommand,
  onRemoveReference,
  onFocusComposer,
}: {
  project: Project;
  busy: boolean;
  assistant?: AssistantInfo;
  onRetry: () => void;
  references: Asset[];
  onSend: (s: string) => void;
  onLibrary: () => void;
  onSelect: (a: Asset) => void;
  onAdd: (a: Asset) => void;
  onCommand: (c: Command) => void;
  onRemoveReference: (id: string) => void;
  onFocusComposer: () => void;
}) {
  const [text, setText] = useState(""),
    [unread, setUnread] = useState(false),
    scroll = useRef<HTMLDivElement>(null),
    follow = useRef(true),
    userScrolling = useRef(false),
    input = useRef<HTMLTextAreaElement>(null);
  const latest = project.messages.at(-1),
    results = project.jobs.filter((j) => j.state === "ready").length;
  useEffect(() => {
    if (follow.current) {
      scroll.current?.scrollTo({
        top: scroll.current.scrollHeight,
        behavior: "auto",
      });
      setUnread(false);
    } else setUnread(true);
  }, [
    latest?.id,
    latest?.text,
    results,
    project.assistantRun?.label,
    project.assistantRun?.state,
  ]);
  useEffect(() => {
    const el = scroll.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      if (follow.current) el.scrollTop = el.scrollHeight;
    });
    observer.observe(el);
    for (const child of el.children) observer.observe(child);
    return () => observer.disconnect();
  }, [project.messages.length]);
  function send(s = text) {
    if (!s.trim() || busy || project.assistantRun) return;
    onSend(s.trim());
    setText("");
    follow.current = true;
    userScrolling.current = false;
    input.current?.focus();
  }
  const empty = !project.messages.length;
  return (
    <section
      className={"conversation " + (empty ? "is-empty" : "")}
      aria-label="Conversation avec Studio"
    >
      <div
        className="conversation-scroll"
        ref={scroll}
        tabIndex={0}
        aria-label="Messages de la conversation"
        onWheel={() => {
          userScrolling.current = true;
        }}
        onTouchMove={() => {
          userScrolling.current = true;
        }}
        onPointerDown={(e) => {
          if (e.target === e.currentTarget) userScrolling.current = true;
        }}
        onKeyDown={(e) => {
          if (
            [
              "PageUp",
              "PageDown",
              "Home",
              "End",
              "ArrowUp",
              "ArrowDown",
            ].includes(e.key) &&
            !(e.target as Element).closest(
              "button,input,textarea,video,audio,a",
            )
          )
            userScrolling.current = true;
        }}
        onScroll={() => {
          const el = scroll.current;
          if (!el) return;
          const atEnd = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
          if (atEnd) {
            follow.current = true;
            userScrolling.current = false;
          } else if (userScrolling.current) follow.current = false;
        }}
      >
        <div className="chat-intro">
          <span className="eyebrow">VOTRE IDÉE PREND FORME</span>
          <h2>
            {empty ? (
              <>
                Une idée.
                <br />
                <span>Un film.</span>
              </>
            ) : (
              <>
                Une idée. <span>Un film.</span>
              </>
            )}
          </h2>
          {empty && (
            <p>
              Parlez à Studio.
              <br />
              Regardez la création se dessiner.
            </p>
          )}
        </div>
        {empty ? (
          <div className="brief-suggestions">
            <button
              onClick={() => send("Fais une pub parfum lumineuse d’une minute")}
            >
              Un film parfum, lumineux et sensoriel <ArrowUp size={14} />
            </button>
            <button
              onClick={() => send("Créons les visuels du parfum par étapes")}
            >
              Commençons par une direction visuelle <ArrowUp size={14} />
            </button>
            <button onClick={onLibrary}>
              J’ai déjà des images, vidéos ou audios <Plus size={14} />
            </button>
          </div>
        ) : (
          <div className="messages">
            {project.messages.map((m) => {
              const job = project.jobs.find((j) => j.id === m.jobId),
                exported = job?.kind === "export";
              return (
                <article key={m.id} className={"message " + m.role}>
                  <div className="message-body">
                    {m.role === "assistant" && (
                      <span className="assistant-mark">
                        <Sparkles size={16} />
                      </span>
                    )}
                    <div className="message-copy">
                      <p>{m.text}</p>
                      {job && job.state !== "ready" && (
                        <div className={"job-state " + job.state}>
                          {job.state === "queued" || job.state === "running" ? (
                            <>
                              <LoaderCircle size={13} className="spin" />
                              <span>
                                {job.state === "queued"
                                  ? "En attente"
                                  : Math.round(job.progress * 100) + " %"}
                              </span>
                              <button
                                onClick={() =>
                                  onCommand({ type: "cancel", jobId: job.id })
                                }
                              >
                                Arrêter
                              </button>
                              <progress value={job.progress} max={1} />
                            </>
                          ) : (
                            <>
                              <span>
                                {job.state === "cancelled"
                                  ? "Traitement arrêté"
                                  : job.error?.slice(-240) ||
                                    "Le traitement a échoué."}
                              </span>
                              <button
                                onClick={() =>
                                  onCommand({ type: "retry", jobId: job.id })
                                }
                              >
                                <RotateCcw size={12} /> Réessayer
                              </button>
                            </>
                          )}
                        </div>
                      )}
                      {!!m.assets?.length && (
                        <button
                          className="chat-media-summary"
                          onClick={() => {
                            const a = project.assets.find(
                              (a) => a.id === m.assets?.[0],
                            );
                            if (a) onSelect(a);
                          }}
                        >
                          <span /> {m.assets.length}{" "}
                          {exported
                            ? "rendu disponible"
                            : "média" +
                              (m.assets.length > 1 ? "s" : "") +
                              " disponible" +
                              (m.assets.length > 1 ? "s" : "")}
                        </button>
                      )}
                      {!!m.assets?.length && (
                        <div
                          className={
                            "message-assets " +
                            (exported ? "render-assets" : "")
                          }
                        >
                          {m.assets.map((id) => {
                            const a = project.assets.find((a) => a.id === id);
                            return a ? (
                              <AssetResult
                                key={id}
                                asset={a}
                                project={project}
                                exported={exported}
                                onSelect={onSelect}
                                onAdd={onAdd}
                              />
                            ) : null;
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
            {project.assistantRun && (
              <article className="message assistant" aria-live="polite">
                <div className="message-body">
                  <span className="assistant-mark">
                    <Sparkles size={16} />
                  </span>
                  <div className="message-copy">
                    <p>
                      {project.assistantRun.state === "failed"
                        ? project.assistantRun.error
                        : project.assistantRun.label}
                    </p>
                    <div className={"job-state " + project.assistantRun.state}>
                      {project.assistantRun.state === "failed" ? (
                        <button onClick={onRetry} disabled={busy}>
                          <RotateCcw size={13} /> Reprendre l’échange
                        </button>
                      ) : (
                        <LoaderCircle size={13} className="spin" />
                      )}
                    </div>
                  </div>
                </div>
              </article>
            )}
          </div>
        )}
      </div>
      {unread && (
        <button
          className="new-message"
          onClick={() => {
            follow.current = true;
            userScrolling.current = false;
            scroll.current?.scrollTo({
              top: scroll.current.scrollHeight,
              behavior: "auto",
            });
            setUnread(false);
          }}
        >
          <ArrowDown size={13} /> Nouvelle réponse
        </button>
      )}
      <form
        className="composer-wrap"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        {!!references.length && (
          <div className="reference-chips">
            {references.map((a) => (
              <span key={a.id}>
                {a.name}
                <button
                  type="button"
                  aria-label={"Retirer la référence " + a.name}
                  onClick={() => onRemoveReference(a.id)}
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="composer">
          <button
            type="button"
            className="attach-button"
            onClick={onLibrary}
            disabled={busy}
            aria-label="Ouvrir la bibliothèque"
            aria-haspopup="dialog"
            title="Bibliothèque et import"
          >
            <Plus size={21} />
          </button>
          <textarea
            ref={input}
            rows={1}
            aria-label="Message à Studio"
            placeholder={
              project.assistantRun?.state === "failed"
                ? "Reprenez l’échange ci-dessus…"
                : busy
                  ? "Studio travaille…"
                  : "Décrivez votre idée…"
            }
            value={text}
            onFocus={onFocusComposer}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
          <button
            className="send-button"
            type="submit"
            disabled={busy || !!project.assistantRun || !text.trim()}
            aria-label="Envoyer à Studio"
          >
            <ArrowUp size={22} />
          </button>
        </div>
        <div className="composer-caption">
          Images, vidéos, sons. Une conversation.
          <span>
            {!assistant
              ? "Connexion au Studio…"
              : assistant.mode === "openai"
                ? assistant.configured
                  ? "GPT‑6.1 Sol · Médias de démo"
                  : "IA à connecter"
                : "Assistant simulé · Actions réelles"}
          </span>
        </div>
      </form>
    </section>
  );
}
