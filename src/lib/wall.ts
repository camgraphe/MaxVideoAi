import type { ClipItem, CollectionDefinition } from "@/data/wall";

export function getClipEffectivePrice(clip: ClipItem): number {
  if (clip.cost.billing === "per_second") {
    const perSecond = clip.pricePerSecondUsd ?? clip.cost.amount;
    return Number((perSecond * clip.durationSeconds).toFixed(2));
  }
  return Number(clip.cost.amount.toFixed(2));
}

export function filterClipsForCollection(collection: CollectionDefinition, clips: ClipItem[]): ClipItem[] {
  return clips.filter((clip) => {
    if (collection.filter.tiers && !collection.filter.tiers.includes(clip.tier)) {
      return false;
    }

    if (collection.filter.engines && !collection.filter.engines.includes(clip.engineVersion)) {
      return false;
    }

    if (collection.filter.aspects && !collection.filter.aspects.includes(clip.aspect)) {
      return false;
    }

    if (collection.filter.tags && !collection.filter.tags.some((tag) => clip.tags.includes(tag))) {
      return false;
    }

    if (
      typeof collection.filter.priceCeilingUsd === "number" &&
      getClipEffectivePrice(clip) > collection.filter.priceCeilingUsd
    ) {
      return false;
    }

    return true;
  });
}
