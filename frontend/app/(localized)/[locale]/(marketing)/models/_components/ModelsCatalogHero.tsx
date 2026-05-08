import Image from 'next/image';
import { Sparkles, Timer } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { UIIcon } from '@/components/ui/UIIcon';
import type { AppLocale } from '@/i18n/locales';
import { MODELS_HERO_IMAGE_URL } from '../_lib/models-catalog-utils';

type ModelsCatalogHeroProps = {
  activeLocale: AppLocale;
  heroAccentParts: {
    emphasis: string;
    prefix: string;
  };
  heroBullets: string[];
  heroSubhead: string;
  heroTitleParts: {
    accent: string;
    lead: string;
  };
  scopeTabs: Array<{
    active: boolean;
    href: string;
    id: string;
    label: string;
  }>;
};

export function ModelsCatalogHero({
  activeLocale,
  heroAccentParts,
  heroBullets,
  heroSubhead,
  heroTitleParts,
  scopeTabs,
}: ModelsCatalogHeroProps) {
  return (
    <section className="relative isolate overflow-hidden border-b border-hairline bg-[linear-gradient(180deg,#fbfdff_0%,#f7faff_68%,#f3f6fb_100%)] dark:bg-[linear-gradient(180deg,#070b12_0%,#0b111c_68%,#0f1724_100%)]">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <Image
          src={MODELS_HERO_IMAGE_URL}
          alt=""
          aria-hidden="true"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center opacity-[0.82] mix-blend-multiply dark:opacity-[0.38] dark:mix-blend-screen dark:invert"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(248,250,252,0.96)_0%,rgba(248,250,252,0.82)_39%,rgba(248,250,252,0.32)_72%,rgba(248,250,252,0.12)_100%)] dark:bg-[linear-gradient(90deg,rgba(7,11,18,0.96)_0%,rgba(7,11,18,0.82)_42%,rgba(7,11,18,0.38)_74%,rgba(7,11,18,0.18)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-28 bg-[linear-gradient(180deg,transparent_0%,var(--bg)_100%)]" />
      </div>
      <div className="container-page relative z-10 max-w-[1248px] py-14 sm:py-16 lg:min-h-[520px] lg:py-20">
        <nav
          aria-label={activeLocale === 'fr' ? 'Vues du catalogue modèles' : activeLocale === 'es' ? 'Vistas del catálogo de modelos' : 'Model catalog views'}
          className="flex flex-wrap gap-2"
        >
          {scopeTabs.map((tab) => (
            <Link
              key={tab.id}
              href={tab.href}
              className={`rounded-full border px-5 py-2.5 text-xs font-semibold uppercase tracking-micro shadow-sm transition ${
                tab.active
                  ? 'border-text-primary bg-text-primary text-bg'
                  : 'border-hairline bg-surface/88 text-text-secondary backdrop-blur hover:border-text-muted hover:text-text-primary'
              }`}
              aria-current={tab.active ? 'page' : undefined}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
        <header className="mt-12 max-w-[710px] sm:mt-14">
          <h1 className="text-balance text-[42px] font-semibold leading-[1.04] tracking-normal text-text-primary sm:text-[56px] lg:text-[64px]">
            {heroTitleParts.lead}
            {heroTitleParts.accent ? (
              <>
                <br />
                <span>
                  {heroAccentParts.prefix}
                  {heroAccentParts.emphasis}
                </span>
              </>
            ) : null}
          </h1>
          <p className="mt-6 max-w-[62ch] text-base font-medium leading-relaxed text-text-secondary sm:text-lg">
            {heroSubhead}
          </p>
          <ul className="mt-8 grid gap-5 text-sm text-text-secondary sm:grid-cols-2">
            {heroBullets.slice(0, 2).map((bullet, index) => (
              <li key={bullet} className="flex items-center gap-4">
                <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full border border-hairline bg-surface/85 text-text-primary shadow-sm backdrop-blur">
                  <UIIcon icon={index === 0 ? Sparkles : Timer} size={18} />
                </span>
                <span className="font-semibold leading-relaxed">{bullet}</span>
              </li>
            ))}
          </ul>
        </header>
      </div>
    </section>
  );
}
