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
import type { Asset, Project, Command } from "../../shared/types";
import { AssetResult } from "./AssetResult.client";
export function Chat({
  project,
  busy,
  references,
  onSend,
  onUpload,
  onSelect,
  onAdd,
  onCommand,
  onRemoveReference,
  onFocusComposer,
}: {
  project: Project;
  busy: boolean;
  references: Asset[];
  onSend: (s: string) => void;
  onUpload: () => void;
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
  }, [latest?.id, latest?.text, results]);
  useEffect(() => {
    const el = scroll.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      if (follow.current) el.scrollTop = el.scrollHeight;
    });
    for (const child of el.children) observer.observe(child);
    return () => observer.disconnect();
  }, [project.messages.length]);
  function send(s = text) {
    if (!s.trim() || busy) return;
    onSend(s.trim());
    setText("");
    follow.current = true;
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
        onScroll={() => {
          const el = scroll.current;
          if (el)
            follow.current =
              el.scrollHeight - el.scrollTop - el.clientHeight < 60;
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
            <button onClick={onUpload}>
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
          </div>
        )}
      </div>
      {unread && (
        <button
          className="new-message"
          onClick={() => {
            follow.current = true;
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
            onClick={onUpload}
            disabled={busy}
            aria-label="Ajouter des références"
          >
            <Plus size={21} />
          </button>
          <textarea
            ref={input}
            rows={1}
            aria-label="Message à Studio"
            placeholder={busy ? "Studio travaille…" : "Décrivez votre idée…"}
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
            disabled={busy || !text.trim()}
            aria-label="Envoyer à Studio"
          >
            <ArrowUp size={22} />
          </button>
        </div>
        <div className="composer-caption">
          Images, vidéos, sons. Une conversation.
          <span>Assistant simulé · Actions réelles</span>
        </div>
      </form>
    </section>
  );
}
