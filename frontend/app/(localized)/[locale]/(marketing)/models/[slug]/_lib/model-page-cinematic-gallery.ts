import { findGalleryVideoPreset } from '@/lib/video/gallery-presets';
import type { ModelExamplesGalleryItem } from './model-page-examples-view-model';
import { cinematicVideoPromptLinks } from './model-page-workflow-proofs';
import type { AppLocale } from '@/i18n/locales';

/** Curation still owns membership; this only enriches the already selected cards. */
export function buildCinematicGalleryItems(items: ModelExamplesGalleryItem[], modelSlug: string, locale?: AppLocale) {
  return items.map(item => {
    const preset = item.prompt ? findGalleryVideoPreset(modelSlug, item.prompt) : null;
    let creation: { href: string; refineHref: string } | undefined;
    if (item.recreateHref) {
      const entry = new URL(item.recreateHref, 'https://maxvideoai.com');
      entry.searchParams.set('lang', locale ?? entry.searchParams.get('lang') ?? 'en');
      if (preset) {
        entry.searchParams.delete('from');
        entry.searchParams.delete('job');
        creation = cinematicVideoPromptLinks(entry.pathname + entry.search, preset.id);
      } else {
        const href = entry.pathname + entry.search;
        entry.searchParams.set('assistant', 'milo');
        entry.searchParams.set('refine', 'example');
        creation = { href, refineHref: entry.pathname + entry.search };
      }
    }
    return { ...item, title: preset?.title ?? item.title, creation,
      metadata: [item.durationLabel, preset?.resolution, item.aspectRatio].filter(Boolean).join(' · ') };
  });
}
