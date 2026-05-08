import Link from 'next/link';
import type { AppLocale } from '@/i18n/locales';

type ExamplesIntroHeroProps = {
  heroLead: string;
  heroSubtitle: string;
  heroTitle: string;
};

type ExamplesNextStepsSectionProps = {
  locale: AppLocale;
  nextStepLinks: Array<{
    href: string;
    label: string;
  }>;
};

export function ExamplesIntroHero({ heroLead, heroSubtitle, heroTitle }: ExamplesIntroHeroProps) {
  return (
    <section className="halo-hero stack-gap-sm text-center sm:stack-gap-md">
      <header className="mx-auto max-w-3xl stack-gap-sm text-center">
        <h1 className="text-3xl font-semibold text-text-primary sm:text-5xl">{heroTitle}</h1>
        <p className="text-base leading-relaxed text-text-secondary">{heroSubtitle}</p>
        <p className="mx-auto max-w-2xl text-sm leading-relaxed text-text-secondary/90">{heroLead}</p>
      </header>
    </section>
  );
}

export function ExamplesNextStepsSection({ locale, nextStepLinks }: ExamplesNextStepsSectionProps) {
  return (
    <section className="rounded-[16px] border border-hairline bg-surface/80 px-5 py-5 shadow-card">
      <h2 className="text-lg font-semibold text-text-primary">
        {locale === 'fr' ? 'Aller plus loin' : locale === 'es' ? 'Siguientes pasos' : 'Next steps'}
      </h2>
      <div className="mt-3 flex flex-wrap gap-3 text-sm">
        {nextStepLinks.map((item) => (
          <Link key={item.label} href={item.href} className="font-semibold text-brand hover:text-brandHover">
            {item.label}
          </Link>
        ))}
      </div>
    </section>
  );
}
