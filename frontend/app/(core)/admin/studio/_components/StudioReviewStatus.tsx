import type { ReviewTurn } from '@/server/admin-studio-review/contracts';

export function reviewStateLabel(state: string): string {
  return state === 'ready' ? 'Reply saved (ready)' : state === 'thinking' ? 'In progress (thinking)' : state === 'failed' ? 'Turn failed (failed)' : state;
}

export function reviewProgressLabel(turn: ReviewTurn): string {
  if (!turn.incomplete) return 'No continuation recorded';
  const reason = turn.continuationReason === 'action_limit' ? 'action limit' : turn.continuationReason === 'output_limit' ? 'output limit' : null;
  return `Needs continuation${reason ? ` · ${reason}` : ''}`;
}
