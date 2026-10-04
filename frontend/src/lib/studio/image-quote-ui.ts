import type { ImageConversationTurn } from "./image-conversation-contract";
export function imageQuoteWalletState(
  quote: NonNullable<ImageConversationTurn["quote"]>,
): "ready" | "insufficient" | "unavailable" {
  const wallet = quote.wallet;
  if (
    !wallet ||
    !Number.isSafeInteger(wallet.amountCents) ||
    wallet.amountCents < 0 ||
    !Number.isSafeInteger(quote.price.amountCents) ||
    quote.price.amountCents < 0 ||
    wallet.currency !== quote.price.currency
  )
    return "unavailable";
  return wallet.amountCents >= quote.price.amountCents
    ? "ready"
    : "insufficient";
}
export function canConfirmImageQuote(
  quote: NonNullable<ImageConversationTurn["quote"]>,
  now: number,
  busy: boolean,
): boolean {
  return (
    !busy &&
    quote.state === "prepared" &&
    Date.parse(quote.expiresAt) > now &&
    imageQuoteWalletState(quote) === "ready"
  );
}
export function imageConfirmationPayload(requestId: string, quoteId: string) {
  return { requestId, quoteId, confirmed: true as const };
}
export function acceptsImageConversationResponse(
  requestScope: string,
  activeScope: string,
  responseProjectId: string,
  activeProjectId: string,
) {
  return requestScope === activeScope && responseProjectId === activeProjectId;
}
