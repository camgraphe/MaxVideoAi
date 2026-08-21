import { Link, type LocalizedLinkHref } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/locales';
import type { ResolvedEditorialProfile } from '@/lib/editorial/profile';
import { localizePathFromEnglish } from '@/lib/i18n/paths';
import type { AboutCopy } from '../_lib/about-copy';

export function AboutView({
  copy,
  locale,
  profile,
}: {
  copy: AboutCopy;
  locale: AppLocale;
  profile: ResolvedEditorialProfile;
}) {
  const links: Array<{ href: LocalizedLinkHref; label: string }> = [
    { href: '/editorial-standards', label: copy.links.standards },
    { href: { pathname: '/benchmarks' }, label: copy.links.benchmarks },
    { href: { pathname: '/company' }, label: copy.links.company },
    { href: localizePathFromEnglish(locale, '/legal'), label: copy.links.legal },
  ];

  return (
    <div className="container-page max-w-6xl space-y-12 py-14 sm:space-y-16 sm:py-20">
      <header className="max-w-4xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">{copy.hero.eyebrow}</p>
        <h1 className="mt-5 font-display text-4xl font-semibold tracking-[-0.04em] text-text-primary sm:text-6xl">
          {copy.hero.title}
        </h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-text-secondary">{copy.hero.subtitle}</p>
      </header>

      <section
        id="adrien-millot"
        className="scroll-mt-[calc(var(--header-height)+32px)] rounded-[28px] border border-brand/20 bg-accent-subtle/35 p-6 shadow-card sm:p-8"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">{copy.identity.label}</p>
        <div className="mt-4 grid gap-5 md:grid-cols-[1fr_2fr]">
          <div>
            <h2 className="text-2xl font-semibold text-text-primary">{profile.name}</h2>
            <p className="mt-2 text-sm text-text-secondary">
              {profile.jobTitle} · {profile.location}
            </p>
          </div>
          <p className="text-base leading-7 text-text-secondary">{copy.identity.body}</p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {copy.sections.map((section) => (
          <article key={section.title} className="rounded-[24px] border border-hairline bg-surface/75 p-6">
            <h2 className="text-xl font-semibold text-text-primary">{section.title}</h2>
            <p className="mt-3 text-sm leading-7 text-text-secondary">{section.body}</p>
          </article>
        ))}
      </section>

      <section className="rounded-[24px] border border-hairline bg-surface/75 p-6 sm:p-8">
        <h2 className="text-xl font-semibold text-text-primary">{copy.independence.title}</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-text-secondary">{copy.independence.body}</p>
      </section>

      <nav aria-label={copy.hero.eyebrow} className="flex flex-wrap gap-3">
        {links.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="rounded-full border border-hairline bg-surface px-4 py-2 text-sm font-semibold text-text-primary transition hover:border-brand/35 hover:text-brand"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
