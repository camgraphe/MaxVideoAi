import {assistanceNextActionSchema,type AssistanceNextAction} from './conversation-assistance';
export type ConversationIssue = {
  operation: "read" | "submit" | "confirm";
  code?: string;
  assistance?: AssistanceNextAction;
};

export class ConversationRequestError extends Error {
  readonly code: string | undefined;
  readonly assistance: AssistanceNextAction | undefined;
  constructor(code: unknown,nextAction?:unknown) {
    super("Studio conversation request failed");
    this.code = typeof code === "string" ? code : undefined;
    const parsed=assistanceNextActionSchema.safeParse(nextAction);
    this.assistance=this.code==='SPENDING_LIMIT_EXCEEDED'&&parsed.success?parsed.data:undefined;
  }
}

export function conversationIssue(
  operation: ConversationIssue["operation"],
  failure: unknown,
): ConversationIssue {
  return {
    operation,
    ...(operation==='submit'&&failure instanceof ConversationRequestError&&failure.assistance?{assistance:failure.assistance}:{}),
    ...(failure instanceof ConversationRequestError && failure.code
      ? { code: failure.code }
      : {}),
  };
}

/** Present stable guidance; backend diagnostics never become customer copy. */
export function conversationErrorMessage(
  issue: ConversationIssue,
  locale: "en" | "fr",
): string {
  const t = (en: string, fr: string) => locale === "fr" ? fr : en;
  switch (issue.code) {
    case "SPENDING_LIMIT_EXCEEDED":
      if(issue.assistance?.reason==='call_limit')return t('This message reached its working limit. Your completed work is saved; continue with a follow-up.','Cet échange a atteint sa limite de travail. Le travail effectué est enregistré ; continuez avec un nouveau message.');
      return issue.assistance?.reason==='usage_unresolved' ? t("A previous assistance charge is still being checked. Keep this request saved while we verify it.","Le coût d’un échange précédent est en cours de vérification. Gardez cette demande enregistrée.") : t("Choose how to continue your Studio assistance. Media generation is charged separately.","Choisissez comment continuer avec Studio. La génération de médias est facturée séparément.");
    case "AUTH_REQUIRED":
    case "UNAUTHORIZED":
      return t("Your session has expired. Sign in again to continue.", "Votre session a expiré. Reconnectez-vous pour continuer.");
    case "INSUFFICIENT_FUNDS":
      return t(
        "Your balance is insufficient for this creation. Check the quote balance, then refresh it.",
        "Votre solde est insuffisant pour cette création. Consultez le solde du devis, puis actualisez-le.",
      );
    case "QUOTE_EXPIRED":
      return t("This quote has expired. Request a new quote and review it before confirming.", "Ce devis a expiré. Demandez un nouveau devis et vérifiez-le avant de confirmer.");
    case "PRICING_REFRESH_REQUIRED":
      return t("Refresh and review the current quote before confirming.", "Actualisez et vérifiez le devis actuel avant de confirmer.");
    case "QUOTE_ALREADY_CLAIMED":
      return t("This quote is already being processed. Refresh to check its status.", "Ce devis est déjà en cours de traitement. Actualisez pour vérifier son état.");
    case "RATE_LIMITED":
      return t("Studio is handling too many requests right now. Wait a moment, then try again.", "Studio traite trop de demandes pour le moment. Patientez un instant, puis réessayez.");
    default:
      if (issue.operation === "read")
        return t("The conversation is temporarily unavailable. Refresh to try again.", "La conversation est momentanément indisponible. Actualisez pour réessayer.");
      if (issue.operation === "confirm")
        return t("The confirmation could not be verified. Refresh to check its status before trying again.", "La confirmation n’a pas pu être vérifiée. Actualisez pour vérifier son état avant de réessayer.");
      return t("Studio could not finish preparing this request. Refresh to check its status or resume the saved request.", "Studio n’a pas pu terminer la préparation de cette demande. Actualisez pour vérifier son état ou reprenez la demande enregistrée.");
  }
}
