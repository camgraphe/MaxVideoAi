import type { GroupSummary, GroupMemberSummary } from '@/types/groups';

function normalizeMember(member: GroupMemberSummary): GroupMemberSummary {
  const hasMedia = Boolean(member.videoUrl || member.thumbUrl);
  const status = member.status ?? (hasMedia ? 'completed' : 'pending');
  return {
    ...member,
    status,
  };
}

function resolveDisplayCount(group: GroupSummary, members: GroupMemberSummary[]): number {
  const baseCount = typeof group.count === 'number' && group.count > 0 ? group.count : members.length || 1;
  return Math.max(1, Math.min(4, baseCount));
}

export function normalizeGroupSummary(group: GroupSummary): GroupSummary {
  const members = group.members.map(normalizeMember);
  const heroCandidate = members.find((member) => member.id === group.hero.id) ?? members[0];
  const hero = heroCandidate
    ? heroCandidate
    : normalizeMember(group.hero);

  const previewLookup = new Map(group.previews.map((preview) => [preview.id, preview]));
  const displayCount = resolveDisplayCount(group, members);
  const previews = members.slice(0, displayCount).map((member) => {
    const preview = previewLookup.get(member.id);
    const videoUrl = preview?.videoUrl ?? member.videoUrl ?? null;
    const thumbUrl = preview?.thumbUrl ?? member.thumbUrl ?? null;
    const aspectRatio = preview?.aspectRatio ?? member.aspectRatio ?? null;
    const source = preview?.source ?? member.source ?? null;

    return {
      id: member.id,
      videoUrl,
      thumbUrl,
      aspectRatio,
      source,
    };
  });

  const splitMode = group.splitMode ?? (displayCount > 1 ? 'quad' : 'single');

  return {
    ...group,
    splitMode,
    members,
    hero,
    previews,
  };
}

export function normalizeGroupSummaries(groups: GroupSummary[]): GroupSummary[] {
  return groups.map((group) => normalizeGroupSummary(group));
}
