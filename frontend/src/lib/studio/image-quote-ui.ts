import type { ImageConversationTurn } from "./image-conversation-contract";
export function canConfirmImageQuote(
  quote: NonNullable<ImageConversationTurn["quote"]>,
  now: number,
  busy: boolean,
): boolean {
  return (
    !busy && quote.state === "prepared" && Date.parse(quote.expiresAt) > now
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
