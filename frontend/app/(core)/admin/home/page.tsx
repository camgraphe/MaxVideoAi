import { Clapperboard, Eye, LayoutTemplate, Sparkles } from 'lucide-react';
import { notFound } from 'next/navigation';
import { HomepageVideoManager } from '@/components/admin/HomepageVideoManager';
import { AdminNotice } from '@/components/admin-system/feedback/AdminNotice';
import { AdminInspectorPanel } from '@/components/admin-system/shell/AdminInspectorPanel';
import { AdminPageHeader } from '@/components/admin-system/shell/AdminPageHeader';
import { AdminSection } from '@/components/admin-system/shell/AdminSection';
import { AdminSectionMeta } from '@/components/admin-system/shell/AdminSectionMeta';
import { type AdminMetricItem, AdminMetricGrid } from '@/components/admin-system/surfaces/AdminMetricGrid';
import { AdminActionLink } from '@/components/admin-system/shell/AdminActionLink';
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
  const metrics = buildHomepageMetrics(hero, gallery);
  const assignedHeroCount = hero.filter((slot) => Boolean(slot.videoId)).length;
  const missingHeroCount = hero.length - assignedHeroCount;
  const galleryAssignedCount = gallery.filter((slot) => Boolean(slot.videoId)).length;

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        eyebrow="Curation"
        title="Homepage programming"
        description="Pilote les hero slots visibles sur la homepage marketing. Cette surface doit rester courte, visuelle et orientée couverture éditoriale."
        actions={
          <>
            <AdminActionLink href="/">
              Open site
            </AdminActionLink>
            <AdminActionLink href="/admin/moderation">
              Moderation
            </AdminActionLink>
            <AdminActionLink href="/admin/playlists">
              Playlists
            </AdminActionLink>
          </>
        }
      />

      <AdminSection
        title="Programming Pulse"
        description="Lecture rapide de la couverture hero et du niveau de preview prêt pour la homepage."
      >
        <AdminMetricGrid items={metrics} columnsClassName="sm:grid-cols-2 xl:grid-cols-4" density="compact" />
      </AdminSection>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_340px] xl:items-start">
        <AdminSection
          title="Hero Workspace"
          description="Assigne un rendu par slot, contrôle le titre affiché et valide immédiatement la preview."
          action={
            <AdminSectionMeta
              title={`${assignedHeroCount}/${hero.length} hero slots assigned`}
              lines={[
                `${galleryAssignedCount}/${gallery.length} gallery slots already configured`,
                missingHeroCount ? `${missingHeroCount} hero slot${missingHeroCount > 1 ? 's' : ''} still missing a video` : 'All hero slots are currently filled',
              ]}
            />
          }
        >
          <div className="space-y-4">
            {missingHeroCount ? (
              <AdminNotice tone="warning">
                {missingHeroCount} hero slot{missingHeroCount > 1 ? 's are' : ' is'} still unassigned. The homepage can render with gaps or weaker editorial signal until every slot has a video.
              </AdminNotice>
            ) : (
              <AdminNotice tone="success">All hero slots currently resolve to a video preview.</AdminNotice>
            )}
            <HomepageVideoManager initialHero={heroSlots} embedded />
          </div>
        </AdminSection>

        <AdminInspectorPanel
          title="Programming Notes"
          description="Repères rapides pour garder la homepage compacte, cohérente et éditorialement forte."
        >
          <div className="space-y-4">
            <div className="space-y-3 rounded-2xl border border-hairline bg-bg/40 px-4 py-4 text-sm text-text-secondary">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Selection logic</p>
                <p className="mt-1">Mix engines, durations and creative angles. Avoid repeating near-identical renders in adjacent slots.</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Copy discipline</p>
                <p className="mt-1">Titles should stay short and scannable. Use subtitles only when they add context, not to restate the obvious.</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Preview quality</p>
                <p className="mt-1">If a slot lacks preview media, return to moderation or the original job before publishing the change.</p>
              </div>
            </div>

            <div className="space-y-3">
              <AdminActionLink href="/admin/theme" className="w-full justify-center">
                Theme tokens
              </AdminActionLink>
              <AdminActionLink href="/admin/video-seo" className="w-full justify-center">
                Video SEO
              </AdminActionLink>
            </div>
          </div>
        </AdminInspectorPanel>
      </div>
    </div>
  );
}

function buildHomepageMetrics(hero: HomepageSlotWithVideo[], gallery: HomepageSlotWithVideo[]): AdminMetricItem[] {
  const heroAssignedCount = hero.filter((slot) => Boolean(slot.videoId)).length;
  const previewReadyCount = hero.filter((slot) => Boolean(slot.video?.thumbUrl || slot.video?.videoUrl)).length;
  const emptyHeroCount = hero.length - heroAssignedCount;
  const galleryAssignedCount = gallery.filter((slot) => Boolean(slot.videoId)).length;

  return [
    {
      label: 'Hero slots',
      value: String(hero.length),
      helper: `${heroAssignedCount} currently mapped to a video`,
      icon: LayoutTemplate,
    },
    {
      label: 'Preview ready',
      value: String(previewReadyCount),
      helper: 'Slots with poster or playable asset available',
      tone: previewReadyCount === hero.length ? 'success' : 'info',
      icon: Eye,
    },
    {
      label: 'Empty hero',
      value: String(emptyHeroCount),
      helper: emptyHeroCount ? 'Missing a job ID or saved section' : 'No uncovered hero placement',
      tone: emptyHeroCount ? 'warning' : 'success',
      icon: Clapperboard,
    },
    {
      label: 'Gallery coverage',
      value: `${galleryAssignedCount}/${gallery.length}`,
      helper: 'Secondary gallery slots already configured',
      icon: Sparkles,
    },
  ];
}
