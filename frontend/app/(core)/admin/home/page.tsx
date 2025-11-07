import { notFound } from 'next/navigation';
import { HomepageVideoManager } from '@/components/admin/HomepageVideoManager';
import { requireAdmin } from '@/server/admin';
import { getHomepageSlots, type HomepageSlotWithVideo } from '@/server/homepage';

export const dynamic = 'force-dynamic';

export default async function AdminHomepagePage() {
  try {
    await requireAdmin();
  } catch (error) {
    console.warn('[admin/home] access denied', error);
    notFound();
  }

  const { hero, gallery } = await getHomepageSlots();

  const mapSlot = (slot: HomepageSlotWithVideo) => ({
    sectionId: slot.sectionId,
    key: slot.key,
    type: slot.type,
    title: slot.title,
    subtitle: slot.subtitle,
    videoId: slot.videoId,
    orderIndex: slot.orderIndex,
    video: slot.video
      ? {
          id: slot.video.id,
          engineLabel: slot.video.engineLabel,
          durationSec: slot.video.durationSec,
          thumbUrl: slot.video.thumbUrl,
          videoUrl: slot.video.videoUrl,
          createdAt: slot.video.createdAt,
        }
      : null,
  });

  const heroSlots = hero.map(mapSlot);
  const gallerySlots = gallery.map(mapSlot);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-text-primary">Homepage programming</h1>
        <p className="mt-2 text-sm text-text-secondary">
          Pick the hero highlights and featured gallery clips shown on the marketing homepage.
        </p>
      </header>
      <HomepageVideoManager initialHero={heroSlots} initialGallery={gallerySlots} />
    </div>
  );
}
