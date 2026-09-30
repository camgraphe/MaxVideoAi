import type { GroupMemberSummary, GroupSummary } from '@/types/groups';

export type PendingGeneration = {
  id: string;
  engineLabel: string;
  prompt: string;
  durationSec: number;
};

function isPending(member: GroupMemberSummary): boolean {
  return member.status !== 'completed' && member.status !== 'failed'
    && member.observation?.stage !== 'completed' && member.observation?.stage !== 'failed';
}

/** Image outputs share one request; video iterations have separate jobs. */
export function buildPendingGenerations(
  groups: readonly GroupSummary[],
  unit: 'job' | 'group' = 'job'
): PendingGeneration[] {
  const entries = new Map<string, PendingGeneration>();
  for (const group of groups) {
    const pending = group.members.filter(isPending);
    for (const member of unit === 'group' ? pending.slice(0, 1) : pending) {
      const id = unit === 'group' ? group.id : member.jobId ?? member.localKey ?? member.id;
      if (entries.has(id)) continue;
      entries.set(id, { id, engineLabel: member.engineLabel, prompt: member.prompt ?? '', durationSec: member.durationSec });
    }
  }
  return [...entries.values()];
}
