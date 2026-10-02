"use client";
import { useEffect, useState } from "react";
import type { ImageConversationTurn } from "@/lib/studio/image-conversation-contract";
import {
  canConfirmImageQuote,
  imageQuoteWalletState,
} from "@/lib/studio/image-quote-ui";
import styles from "../image-conversation.module.css";
import {conversationFailurePresentation, conversationQuotePresentation, type ConversationLocale} from '@/lib/studio/conversation-quote-presentation';
export function ImageQuoteCard({
  turn,
  busy,
  onConfirm,
  onRenew,
  onRefresh,
  localQa = false,
  locale = 'fr',
}: {
  turn: ImageConversationTurn;
  busy: boolean;
  onConfirm: () => void;
  onRenew: () => void;
  onRefresh: () => void;
  localQa?: boolean;
  locale?: ConversationLocale;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);
  const quote = turn.quote;
  if (!quote) return null;
  const t = (en: string, fr: string) => locale === 'fr' ? fr : en;
  const presentation = conversationQuotePresentation(quote.summary, locale);
  const referenceCount = quote.summary.references.length;
  const ready = canConfirmImageQuote(quote, now, busy);
  const walletState = imageQuoteWalletState(quote);
  const expired =
    quote.state === "expired" ||
    (quote.state === "prepared" && Date.parse(quote.expiresAt) <= now);
  const formatMoney = (amountCents: number, currency: string) =>
    new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-US', { style: "currency", currency }).format(
      amountCents / 100,
    );
  const price = formatMoney(quote.price.amountCents, quote.price.currency);
  return (
    <div className={styles.quote} aria-label={t('Creation quote', 'Devis de création')}>
      <div className={styles.quoteTop}>
        <span>{presentation.title}</span>
        <strong>{price}</strong>
      </div>
      <p className={styles.muted}>
        {quote.modelLabel} · {presentation.settings} ·{" "}
        {referenceCount
          ? `${referenceCount} ${t('reference', 'référence')}${referenceCount > 1 ? "s" : ""}`
          : t('Original creation', 'Création originale')}
      </p>
      <details>
        <summary>{t('View direction and settings', 'Voir la direction et les réglages')}</summary>
        <p>{presentation.direction}</p>
      </details>
      {quote.state === "prepared" && !expired && (
        <p className={styles.muted}>
          {localQa ? t('Test balance', 'Solde de test') : t('Available balance', 'Solde disponible')} :{" "}
          {walletState === "unavailable"
            ? t('unavailable', 'indisponible')
            : formatMoney(quote.wallet!.amountCents, quote.wallet!.currency)}
        </p>
      )}
      {ready ? (
        <>
          <button className={styles.primary} onClick={onConfirm}>
            {presentation.create} · {price}
          </button>
          <small>{t('Charged only when you confirm.', 'Ce montant est débité uniquement à la confirmation.')}</small>
        </>
      ) : expired ? (
        <>
          <span className={styles.muted}>
            {t('This quote expired or the request changed.', 'Ce devis a expiré ou la demande a changé.')}
          </span>
          <button onClick={onRenew} disabled={busy}>
            {t('Renew quote', 'Redemander un devis')}
          </button>
        </>
      ) : quote.state === "prepared" && !busy && walletState !== "ready" ? (
        <>
          <p className={styles.muted}>
            {walletState === "unavailable"
              ? t('Your balance could not be verified. Refresh before confirming.', 'Le solde n’a pas pu être vérifié. Actualisez-le avant de confirmer.')
              : localQa
                ? t('The local test wallet has insufficient funds. Funding the live account does not fund this test.', 'Le wallet local est vide ou insuffisant. Une recharge du compte réel n’alimente pas ce test.')
                : t('Insufficient balance. Add funds to your wallet, then refresh this quote.', 'Votre solde est insuffisant. Rechargez votre wallet, puis actualisez ce devis.')}
          </p>
          <div className={styles.walletActions}>
            {walletState === "insufficient" && (
              <a
                href={localQa ? "https://maxvideoai.com/billing" : "/billing"}
                target="_blank"
                rel="noopener noreferrer"
              >
                {localQa ? t('View live wallet', 'Voir mon wallet réel') : t('Add funds', 'Recharger mon wallet')}
              </a>
            )}
            <button onClick={onRefresh}>{t('Refresh balance', 'Actualiser le solde')}</button>
          </div>
        </>
      ) : (
        <span className={styles.muted}>
          {busy
            ? t('Studio is working…', 'Studio travaille…')
            : turn.generation?.status === "completed"
              ? t('Creation ready', 'Création prête')
              : turn.generation?.status === "failed"
                ? conversationFailurePresentation(turn.generation, locale)
                : t('Creation started.', 'La création a commencé.')}
        </span>
      )}
    </div>
  );
}
