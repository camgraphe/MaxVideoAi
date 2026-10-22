'use client';

import type { GroupSummary } from '@/types/groups';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { galleryMediaAssets } from './gallery-media-assets';
import { MediaDestinationActions } from './MediaDestinationActions.client';

export function GalleryVideoContinuationActions({ group }: { group: GroupSummary }) {
  const { user } = useRequireAuth({ redirectIfLoggedOut: false });
  const { locale } = useI18n();
  const assets = galleryMediaAssets(group, 'video');
  // A grouped card keeps its existing output picker instead of silently choosing a render.
  if (!user || group.count !== 1 || assets.length !== 1 || group.hero.job?.curated) return null;
  const asset = assets[0];
  const member = group.members.find(entry => entry.id === asset.id);
  return <MediaDestinationActions
    asset={asset}
    sourceEngineId={member?.engineId}
    userId={user.id}
    locale={locale}
    presentation="gallery"
  />;
}
