import type { ResponseCreateParamsNonStreaming, ResponseInputItem } from 'openai/resources/responses/responses';
import type { ImageConversationHistoryTurn } from '@/lib/studio/image-conversation-contract';
import { projectStudioReply } from '@/lib/studio/conversation-reply';
import { studioHistoryMessage } from './conversation-reference-mentions';

const historyCompactionFraction = 0.75;

function excerpt(text: string): string {
  if (text.length <= 1_200) return text;
  return text.slice(0, 800) + '\n[… excerpt …]\n' + text.slice(-360);
}

/** Keep turns in order and keep original roles. Old attachment labels survive verbatim. */
export function studioRecentHistoryInput(turns: ImageConversationHistoryTurn[], compact = false): ResponseInputItem[] {
  return turns.flatMap((turn, index) => {
    const shorten = compact && index < turns.length - 2;
    const message = shorten ? excerpt(turn.message) : turn.message;
    const user: ResponseInputItem = { role: 'user', content: studioHistoryMessage({ ...turn, message }) };
    if (!turn.reply) return [user];
    const reply = projectStudioReply(turn.reply);
    const assistant: ResponseInputItem = { role: 'assistant', content: shorten ? excerpt(reply) : reply };
    return [user, assistant];
  });
}

/** Change just the history portion of the active request. Includes stateless cross-model replay. */
export function compactStudioRequestHistory(
  params: ResponseCreateParamsNonStreaming, turns: ImageConversationHistoryTurn[], original: ResponseInputItem[],
): boolean {
  if (!Array.isArray(params.input) || !original.length) return false;
  const start = params.input.indexOf(original[0]);
  if (start < 0 || !turns.slice(0, -2).some(turn => turn.message.length > 1_200 || (turn.reply?.length ?? 0) > 1_200)) return false;
  params.input = [...params.input.slice(0, start), ...studioRecentHistoryInput(turns, true), ...params.input.slice(start + original.length)];
  return true;
}

/** Reserve and dispatch exactly the payload that was counted, including after a fallback. */
export async function measureStudioRequest(
  params: ResponseCreateParamsNonStreaming,
  count: (params: ResponseCreateParamsNonStreaming) => Promise<number>,
  policy?: { targetInputTokens: number; compact?: () => boolean },
): Promise<number> {
  const initial = await count(params);
  const original = params.input;
  if (!Number.isSafeInteger(initial) || !policy || initial < policy.targetInputTokens * historyCompactionFraction || !policy.compact?.()) return initial;
  const reduced = await count(params);
  if (!Number.isSafeInteger(reduced) || reduced < 0) return reduced;
  if (reduced < initial) return reduced;
  params.input = original;
  return initial;
}
