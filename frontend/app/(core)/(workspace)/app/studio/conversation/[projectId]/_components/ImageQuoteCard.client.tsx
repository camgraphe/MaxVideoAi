"use client";
import {videoWorkflowNotices} from '@/lib/video-workflow-capabilities';
import { useEffect, useState } from "react";
import {StudioShotPlanEditor} from "./StudioShotPlanEditor.client";
import type {CanonicalGenerationMultiPromptScene} from "@/server/agent-api/generation-types";
import type { ImageConversationTurn } from "@/lib/studio/image-conversation-contract";
import {
  canConfirmImageQuote,
  imageQuoteWalletState,
} from "@/lib/studio/image-quote-ui";
import styles from "../image-conversation.module.css";
import {conversationFailurePresentation, conversationGoogleSafetyHelp, conversationQuotePresentation, type ConversationLocale} from '@/lib/studio/conversation-quote-presentation';
import {formatCustomerAmount} from '@/lib/customer-price-presentation';
export function ImageQuoteCard({
  assemblyError,onRetryAssembly,
  turn,
  busy,
  onConfirm,
  onRenew,
  onRefresh,
  onEditShotPlan,
  localQa = false,
  locale = 'fr',
}: {
  assemblyError?:string;
  onRetryAssembly?:()=>void;
  turn: ImageConversationTurn;
  busy: boolean;
  onConfirm: () => void;
  onRenew: () => void;
  onRefresh: () => void;
  onEditShotPlan?: (shots:CanonicalGenerationMultiPromptScene[])=>void;
  localQa?: boolean;
  locale?: ConversationLocale;
}) {
  const [editingShots,setEditingShots]=useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(()=>setEditingShots(false),[turn.quote?.quoteId]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);
  const quote = turn.quote;
  if (!quote) return null;
  const failed = turn.generation?.status === 'failed';
  const safetyHelp = conversationGoogleSafetyHelp(turn.generation, locale);
  const t = (en: string, fr: string, es: string) => locale === 'fr' ? fr : locale === 'es' ? es : en;
  const presentation = conversationQuotePresentation(quote.summary, locale, quote.outputDurationSec, quote.summary.surface === 'video' ? quote.sourceVideoOutput : undefined);
  const referenceCount = quote.summary.references.length;
  const ready = !failed && !editingShots && canConfirmImageQuote(quote, now, busy);
  const walletState = imageQuoteWalletState(quote);
  const expired =
    quote.state === "expired" ||
    (quote.state === "prepared" && Date.parse(quote.expiresAt) <= now);
  const formatMoney = (amountCents: number, currency: string) =>
    formatCustomerAmount(amountCents,currency,locale==='fr'?'fr':'en') ?? t('unavailable','indisponible', "no disponible");
  const price = formatMoney(quote.price.amountCents, quote.price.currency);
  return (
    <div className={styles.quote} aria-label={t('Creation quote', 'Devis de création', "Presupuesto de creación")}>
      <div className={styles.quoteTop}>
        <span>{presentation.title}</span>
        <strong>{price}</strong>
      </div>
      <p className={styles.muted}>
        {quote.modelLabel} · {presentation.settings} ·{" "}
        {referenceCount
          ? presentation.referenceSummary || `${referenceCount} ${t('reference', 'référence', "referencia")}${referenceCount > 1 ? "s" : ""}`
          : t('Original creation', 'Création originale', "Creación original")}
      </p>
      {videoWorkflowNotices(quote.summary.engineId,quote.summary.mode,locale).map(note=><p key={note.code} role="note" className={styles.muted}>{note.message}</p>)}
      {presentation.operation && <p className={styles.muted}>{presentation.operation}</p>}
      {turn.extensionAssembly && turn.generation?.status!=='failed' && <p className={styles.muted} role="status">
        {turn.extensionAssembly.state==='saved'
          ? t(`Sequence assembled · ${turn.extensionAssembly.durationSec} s. Open the timeline to play it.`,`Séquence assemblée · ${turn.extensionAssembly.durationSec} s. Ouvrez la timeline pour la lire.`,`Secuencia montada · ${turn.extensionAssembly.durationSec} s. Abre la línea de tiempo para reproducirla.`)
          : turn.extensionAssembly.state==='blocked'||assemblyError==='STUDIO_REVISION_CONFLICT'
            ? t('The timeline changed. Ask Studio to assemble the continuation while preserving your edits.','La timeline a changé. Demandez à Studio d’assembler la prolongation en conservant vos modifications.', "La línea de tiempo ha cambiado. Pide a Studio que una la continuación conservando tus cambios.")
            : assemblyError==='EXTENSION_SOURCE_CHANGED'?t('The original media changed. Ask Studio to review the source before assembling.','Le média d’origine a changé. Demandez à Studio de vérifier la source avant l’assemblage.', "El archivo original ha cambiado. Pide a Studio que revise el original antes de unir los clips.")
            : assemblyError?t('Assembly did not finish. Your two clips are saved.','L’assemblage n’a pas abouti. Vos deux clips sont conservés.', "No se ha completado el montaje. Tus dos clips están guardados.")
              : t('The original and continuation will be assembled in the timeline after creation, provided your edit has not changed.','L’original et la prolongation seront assemblés dans la timeline après création, si votre montage n’a pas changé.', "El original y la continuación se unirán en la línea de tiempo después de la creación, siempre que no hayas cambiado el montaje.")}
      </p>}
      {assemblyError&&!['STUDIO_REVISION_CONFLICT','EXTENSION_SOURCE_CHANGED'].includes(assemblyError)&&turn.extensionAssembly?.state==='pending'&&onRetryAssembly&&<button onClick={onRetryAssembly}>{t('Retry assembly','Reprendre l’assemblage', "Reintentar montaje")}</button>}
      <details>
        <summary>{t('View direction and settings', 'Voir la direction et les réglages', "Ver dirección y ajustes")}</summary>
        <p style={{whiteSpace:'pre-wrap'}}>{presentation.direction}</p>
      </details>
      {!failed&&quote.summary.surface==='video'&&quote.summary.engineId==='kling-v4'&&Array.isArray(quote.summary.settings.multiPrompt)&&onEditShotPlan&&quote.state==='prepared'&&<StudioShotPlanEditor
        key={quote.quoteId} engineId={quote.summary.engineId} shots={quote.summary.settings.multiPrompt} locale={locale==='fr'?'fr':'en'} busy={busy}
        onEditing={()=>setEditingShots(true)} onDraft={onEditShotPlan}/>}
      {!failed && (quote.state === 'prepared' || expired) && (
        <p className={styles.muted}>
          {t('Want a different model, resolution, duration or budget? Ask for a new quote to compare prices and possible savings.',
            'Envie d’un autre modèle, d’une autre résolution ou durée, ou d’un autre budget ? Demandez un nouveau devis pour comparer les tarifs et les économies possibles.', "¿Quieres otro modelo, resolución, duración o presupuesto? Pide un nuevo presupuesto para comparar precios y posibles ahorros.")}
        </p>
      )}
      {!failed && quote.state === "prepared" && !expired && (
        <p className={styles.muted}>
          {localQa ? t('Test balance', 'Solde de test', "Saldo de prueba") : t('Available balance', 'Solde disponible', "Saldo disponible")} :{" "}
          {walletState === "unavailable"
            ? t('unavailable', 'indisponible', "no disponible")
            : formatMoney(quote.wallet!.amountCents, quote.wallet!.currency)}
        </p>
      )}
      {failed ? <>
        <p className={styles.muted} role="status">{conversationFailurePresentation(turn.generation, locale)}</p>
        {safetyHelp && <details data-safety-guidance>
          <summary>{safetyHelp.label}</summary>
          <p>{safetyHelp.explanation}</p>
          <p>{safetyHelp.examples}</p>
          <p>{safetyHelp.next}</p>
          <a href={safetyHelp.policyUrl} target="_blank" rel="noopener noreferrer">{safetyHelp.policy}</a>
        </details>}
      </> : editingShots ? <p className={styles.muted}>{t('Send the revised request to prepare a new quote before confirming.','Envoyez la demande révisée pour préparer un nouveau devis avant de confirmer.', "Envía la solicitud revisada para preparar un nuevo presupuesto antes de confirmar.")}</p> : ready ? (
        <>
          <button className={styles.primary} onClick={onConfirm}>
            {presentation.create} · {price}
          </button>
          <small>{t('Charged only when you confirm.', 'Ce montant est débité uniquement à la confirmation.', "Solo se cobra cuando confirmas.")}</small>
        </>
      ) : expired ? (
        <>
          <span className={styles.muted}>
            {t('This quote expired or the request changed.', 'Ce devis a expiré ou la demande a changé.', "Este presupuesto ha caducado o la solicitud ha cambiado.")}
          </span>
          <button onClick={onRenew} disabled={busy}>
            {t('Renew quote', 'Redemander un devis', "Renovar presupuesto")}
          </button>
        </>
      ) : quote.state === "prepared" && !busy && walletState !== "ready" ? (
        <>
          <p className={styles.muted}>
            {walletState === "unavailable"
              ? t('Your balance could not be verified. Refresh before confirming.', 'Le solde n’a pas pu être vérifié. Actualisez-le avant de confirmer.', "No se ha podido verificar tu saldo. Actualízalo antes de confirmar.")
              : localQa
                ? t('The local test wallet has insufficient funds. Funding the live account does not fund this test.', 'Le wallet local est vide ou insuffisant. Une recharge du compte réel n’alimente pas ce test.', "El monedero local de prueba no tiene fondos suficientes. Recargar la cuenta real no añade fondos a esta prueba.")
                : t('Insufficient balance. Add funds to your wallet, then refresh this quote.', 'Votre solde est insuffisant. Rechargez votre wallet, puis actualisez ce devis.', "Saldo insuficiente. Añade fondos a tu monedero y actualiza este presupuesto.")}
          </p>
          <div className={styles.walletActions}>
            {walletState === "insufficient" && (
              <a
                href={localQa ? "https://maxvideoai.com/billing" : "/billing"}
                target="_blank"
                rel="noopener noreferrer"
              >
                {localQa ? t('View live wallet', 'Voir mon wallet réel', "Ver monedero real") : t('Add funds', 'Recharger mon wallet', "Añadir fondos")}
              </a>
            )}
            <button onClick={onRefresh}>{t('Refresh balance', 'Actualiser le solde', "Actualizar saldo")}</button>
          </div>
        </>
      ) : (
        <span className={styles.muted}>
          {turn.generation?.status === "completed"
            ? t('Creation ready', 'Création prête', "Creación lista")
            : busy
                ? t('Studio is working…', 'Studio travaille…', "Studio está trabajando…")
                : t('Creation started.', 'La création a commencé.', "La creación ha comenzado.")}
        </span>
      )}
    </div>
  );
}
