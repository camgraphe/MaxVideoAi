"use client";
import { useEffect, useState } from "react";
import type { ImageConversationTurn } from "@/lib/studio/image-conversation-contract";
import { canConfirmImageQuote } from "@/lib/studio/image-quote-ui";
import styles from "../image-conversation.module.css";
export function ImageQuoteCard({
  turn,
  busy,
  onConfirm,
  onRenew,
}: {
  turn: ImageConversationTurn;
  busy: boolean;
  onConfirm: () => void;
  onRenew: () => void;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);
  const quote = turn.quote;
  if (!quote) return null;
  const ready = canConfirmImageQuote(quote, now, busy);
  const expired =
    quote.state === "expired" ||
    (quote.state === "prepared" && Date.parse(quote.expiresAt) <= now);
  const price = new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: quote.price.currency,
  }).format(quote.price.amountCents / 100);
  return (
    <div className={styles.quote} aria-label="Devis de l’image">
      <div className={styles.quoteTop}>
        <span>Une image · {String(quote.summary.settings.aspectRatio)}</span>
        <strong>{price}</strong>
      </div>
      <p className={styles.muted}>
        {quote.modelLabel} · haute qualité ·{" "}
        {turn.references.length
          ? `${turn.references.length} référence${turn.references.length > 1 ? "s" : ""}`
          : "Création originale"}
      </p>
      <details>
        <summary>Voir la direction et les réglages</summary>
        <p>{quote.summary.prompt}</p>
        <p className={styles.muted}>
          {String(quote.summary.settings.resolution)} · PNG
        </p>
      </details>
      {ready ? (
        <>
          <button className={styles.primary} onClick={onConfirm}>
            Créer l’image · {price}
          </button>
          <small>Ce montant est débité uniquement à la confirmation.</small>
        </>
      ) : expired ? (
        <>
          <span className={styles.muted}>
            Ce devis a expiré ou la demande a changé.
          </span>
          <button onClick={onRenew} disabled={busy}>
            Redemander un devis
          </button>
        </>
      ) : (
        <span className={styles.muted}>
          {busy
            ? "Studio travaille…"
            : turn.generation?.status === "completed"
              ? "Image créée"
              : turn.generation?.status === "failed"
                ? "La génération a échoué. Consultez son état dans la bibliothèque."
                : "La création a commencé."}
        </span>
      )}
    </div>
  );
}
