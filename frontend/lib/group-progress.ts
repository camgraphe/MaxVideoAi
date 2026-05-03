import type { GroupMemberSummary, GroupSummary } from '@/types/groups';
import { isPlaceholderMediaUrl, normalizeMediaUrl } from '@/lib/media';

function hasRealVisualUrl(candidate?: string | null): boolean {
  const normalized = normalizeMediaUrl(candidate);
  return Boolean(normalized && !isPlaceholderMediaUrl(normalized));
}

function slotMember(group: GroupSummary, index: number) {
  const preview = group.previews[index];
  if (preview) {
    const matchedMember = group.members.find((member) => member.id === preview.id);
    if (matchedMember) {
      return matchedMember;
    }
  }
  return group.members[index];
}

export function groupMemberHasRealVisualMedia(member?: GroupMemberSummary | null): boolean {
  if (!member) return false;
  if (hasRealVisualUrl(member.thumbUrl) || hasRealVisualUrl(member.videoUrl)) {
    return true;
  }

  const job = member.job;
  if (!job) return false;

  if (
    hasRealVisualUrl(job.thumbUrl) ||
    hasRealVisualUrl(job.previewFrame) ||
    hasRealVisualUrl(job.heroRenderId) ||
    hasRealVisualUrl(job.videoUrl)
  ) {
    return true;
  }

  if (Array.isArray(job.renderIds) && job.renderIds.some((url) => hasRealVisualUrl(url))) {
    return true;
  }

  if (Array.isArray(job.renderThumbUrls) && job.renderThumbUrls.some((url) => hasRealVisualUrl(url))) {
    return true;
  }

  return false;
}

export function countResolvedVisualSlots(group: GroupSummary): number {
  const expectedCount = Math.max(1, Math.min(4, group.count || group.members.length || 1));
  let resolved = 0;

  for (let index = 0; index < expectedCount; index += 1) {
    const preview = group.previews[index];
    const member = slotMember(group, index);
    if (
      hasRealVisualUrl(preview?.thumbUrl) ||
      hasRealVisualUrl(preview?.videoUrl) ||
      groupMemberHasRealVisualMedia(member)
    ) {
      resolved += 1;
    }
  }

  return resolved;
}

function pickSlotMember(
  activeGroup: GroupSummary,
  historicalGroup: GroupSummary,
  index: number
): GroupMemberSummary | undefined {
  const historicalMember = slotMember(historicalGroup, index);
  if (groupMemberHasRealVisualMedia(historicalMember)) {
    return historicalMember;
  }
  return slotMember(activeGroup, index) ?? historicalMember;
}

export function mergeImageProgressGroup(
  activeGroup: GroupSummary,
  historicalGroup: GroupSummary
): GroupSummary {
  const expectedCount = Math.max(
    1,
    Math.min(4, activeGroup.count || historicalGroup.count || activeGroup.members.length || historicalGroup.members.length || 1)
  );

  const mergedMembers = Array.from({ length: expectedCount }, (_, index) => pickSlotMember(activeGroup, historicalGroup, index))
    .filter((member): member is GroupMemberSummary => Boolean(member));

  const mergedPreviews = mergedMembers.slice(0, expectedCount).map((member, index) => {
    const historicalPreview = historicalGroup.previews[index];
    const activePreview = activeGroup.previews[index];
    const useHistorical = groupMemberHasRealVisualMedia(slotMember(historicalGroup, index));
    const fallbackPreview = useHistorical ? historicalPreview ?? activePreview : activePreview ?? historicalPreview;

    return {
      id: member.id,
      thumbUrl: member.thumbUrl ?? fallbackPreview?.thumbUrl ?? null,
      videoUrl: member.videoUrl ?? fallbackPreview?.videoUrl ?? null,
      previewVideoUrl: member.previewVideoUrl ?? fallbackPreview?.previewVideoUrl ?? null,
      aspectRatio: member.aspectRatio ?? fallbackPreview?.aspectRatio ?? null,
      source: fallbackPreview?.source ?? member.source ?? null,
    };
  });

  const hero = mergedMembers.find((member) => groupMemberHasRealVisualMedia(member)) ?? mergedMembers[0] ?? activeGroup.hero;

  return {
    ...activeGroup,
    source: 'active',
    totalPriceCents: historicalGroup.totalPriceCents ?? activeGroup.totalPriceCents,
    currency: historicalGroup.currency ?? activeGroup.currency,
    createdAt: historicalGroup.createdAt ?? activeGroup.createdAt,
    hero,
    count: expectedCount,
    members: mergedMembers,
    previews: mergedPreviews,
  };
}
