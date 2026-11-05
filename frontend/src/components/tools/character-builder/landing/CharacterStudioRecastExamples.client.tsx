'use client';

import { ArrowUpRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { useOptionalI18n } from '@/lib/i18n/I18nProvider';
import { PublicVideoPlayer } from '@/components/media/PublicVideoPlayer.client';
import type { CharacterStudioMarketingFilm } from './character-studio-marketing-assets';

const copy = {
  en: {
    title: 'Characters in motion.',
    body: 'Meet Dixie and Vesper in two videos generated with Recast.',
    dixie: 'Dixie · dance',
    vesper: 'Vesper · character comedy',
    dixieBody: 'A pink-and-white look, carried into a dance sequence.',
    vesperBody: 'An insect fashion designer in a sports-car scene.',
    cta: 'Open Recast',
    note: 'Start with your own character and motion reference. Each generation creates a new result.',
  },
  fr: {
    title: 'Des personnages en mouvement.',
    body: 'Retrouvez Dixie et Vesper dans deux vidéos générées avec Recast.',
    dixie: 'Dixie · danse',
    vesper: 'Vesper · comédie de personnage',
    dixieBody: 'Un look rose et blanc, repris dans une séquence de danse.',
    vesperBody: 'Un créateur de mode insecte dans une scène en voiture de sport.',
    cta: 'Ouvrir Recast',
    note: 'Partez de votre personnage et de votre référence de mouvement. Chaque génération crée un nouveau résultat.',
  },
  es: {
    title: 'Personajes en movimiento.',
    body: 'Descubre a Dixie y Vesper en dos vídeos generados con Recast.',
    dixie: 'Dixie · baile',
    vesper: 'Vesper · comedia de personaje',
    dixieBody: 'Un look rosa y blanco, llevado a una secuencia de baile.',
    vesperBody: 'Un diseñador de moda insecto en una escena con un coche deportivo.',
    cta: 'Abrir Recast',
    note: 'Empieza con tu personaje y tu referencia de movimiento. Cada generación crea un resultado nuevo.',
  },
} as const;

/** Reviewed public films only. This reader never applies an example to a private draft. */
export function CharacterStudioRecastExamples({ films, locale, showLink = false }: {
  films: CharacterStudioMarketingFilm[];
  locale?: string;
  showLink?: boolean;
}) {
  const currentLocale = useOptionalI18n()?.locale;
  const language = locale ?? currentLocale ?? 'en';
  const c = copy[language as keyof typeof copy] ?? copy.en;
  if (!films.length) return null;

  return <section data-character-studio-recast-examples className="rounded-2xl border border-border bg-surface-2 p-4 sm:p-6">
    <header className="mb-5 max-w-xl">
      <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-text-secondary">Character Studio / Recast</p>
      <h2 className="mt-2 text-xl font-medium tracking-tight text-text-primary sm:text-2xl">{c.title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-text-secondary">{c.body}</p>
    </header>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {films.map(film => <figure key={film.key} className="min-w-0 overflow-hidden rounded-xl border border-border bg-surface">
        <div className="relative flex h-[320px] items-center justify-center overflow-hidden bg-black sm:h-[360px]">
          <PublicVideoPlayer src={film.video} poster={film.poster} title={c[film.key]} locale={language} deferPoster className="h-full w-full object-contain" />
        </div>
        <figcaption className="p-4">
          <h3 className="text-sm font-semibold text-text-primary">{c[film.key]}</h3>
          <p className="mt-1 text-xs leading-relaxed text-text-secondary">{c[`${film.key}Body`]}</p>
        </figcaption>
      </figure>)}
    </div>
    {showLink ? <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
      <p className="max-w-lg text-xs leading-relaxed text-text-secondary">{c.note}</p>
      <Link href="/app/tools/character-builder?mode=recast" prefetch={false} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-surface px-5 text-sm font-medium text-text-primary hover:bg-surface-2" data-analytics-event="tool_cta_click" data-analytics-cta-location="examples_character_studio" data-analytics-tool-name="character_builder" data-analytics-tool-surface="public">
        {c.cta}<ArrowUpRight size={16} aria-hidden="true" />
      </Link>
    </div> : null}
  </section>;
}
