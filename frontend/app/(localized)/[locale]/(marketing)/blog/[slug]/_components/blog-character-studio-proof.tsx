import { Suspense } from 'react';
import Image from 'next/image';
import type { AppLocale } from '@/i18n/locales';
import { Link } from '@/i18n/navigation';
import { CHARACTER_STUDIO_ARTICLE_SLUGS } from '@/lib/character-studio-marketing';
import { CharacterStudioPublicFilms } from '@/components/tools/character-builder/landing/CharacterStudioPublicFilms';
import { CharacterStudioRecastExamples } from '@/components/tools/character-builder/landing/CharacterStudioRecastExamples.client';
import { CHARACTER_STUDIO_ART } from '@/components/tools/character-builder/landing/character-studio-marketing-assets';

const CHARACTER_ARTICLES = new Set(CHARACTER_STUDIO_ARTICLE_SLUGS);
export const isCharacterStudioArticle = (slug: string) => CHARACTER_ARTICLES.has(slug);
const ACTIONS = {
  en: { create: 'Create my character', watch: 'See Recast examples' },
  fr: { create: 'Créer mon personnage', watch: 'Voir les exemples Recast' },
  es: { create: 'Crear mi personaje', watch: 'Ver ejemplos Recast' },
};

export function BlogCharacterStudioPortraits({ locale }: { locale: AppLocale }) {
  const label = locale === 'fr' ? 'Personnages créés dans Character Studio' : locale === 'es' ? 'Personajes creados en Character Studio' : 'Characters created in Character Studio';
  return <div className="grid grid-cols-2 gap-3" aria-label={label}>
    {([{ name: 'Dixie', image: CHARACTER_STUDIO_ART.dixiePop }, { name: 'Vesper', image: CHARACTER_STUDIO_ART.vesper }]).map(person =>
      <figure key={person.name} className="overflow-hidden rounded-2xl border border-hairline bg-surface-2 shadow-card">
        <div className="relative h-36 lg:h-64"><Image src={person.image} alt={`${person.name} · Character Studio`} fill
          sizes="(min-width: 1024px) 180px, 44vw" className="object-cover object-top" loading="lazy" /></div>
        <figcaption className="border-t border-hairline px-3 py-2 text-xs font-semibold text-text-primary">{person.name}</figcaption>
      </figure>)}
  </div>;
}

export function BlogCharacterStudioActions({ canonicalSlug, locale }: { canonicalSlug: string; locale: AppLocale }) {
  if (!CHARACTER_ARTICLES.has(canonicalSlug)) return null;
  const copy = ACTIONS[locale];
  return <div className="flex flex-wrap items-center gap-3 pt-2">
    <Link href="/app/tools/character-builder" prefetch={false} className="inline-flex min-h-11 items-center rounded-full bg-text-primary px-5 py-3 text-sm font-semibold text-bg hover:opacity-90"
      data-analytics-event="tool_cta_click" data-analytics-cta-location="blog_character_studio_intro" data-analytics-tool-name="character_builder" data-analytics-tool-surface="public">{copy.create}<span aria-hidden="true" className="ml-2">↗</span></Link>
    <a href="#character-studio-in-motion" className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-link hover:underline">{copy.watch}<span aria-hidden="true" className="ml-2">↓</span></a>
  </div>;
}

/** Preserve the article's first poster and text stream; public playback is optional and keeps the still geometry. */
export function BlogCharacterStudioProof({ canonicalSlug, locale }: { canonicalSlug: string; locale: AppLocale }) {
  if (!CHARACTER_ARTICLES.has(canonicalSlug)) return null;
  return <div id="character-studio-in-motion" className="scroll-mt-24 border-b border-hairline px-6 py-6 sm:px-10" data-blog-character-studio-proof>
    <Suspense fallback={<CharacterStudioRecastExamples films={[]} locale={locale} showLink showStills ctaLocation="blog_character_studio" />}>
      <CharacterStudioPublicFilms locale={locale} showLink showStills ctaLocation="blog_character_studio" />
    </Suspense>
  </div>;
}
