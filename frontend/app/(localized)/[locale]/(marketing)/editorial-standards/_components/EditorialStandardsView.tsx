import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/locales';
import { localeRegions } from '@/i18n/locales';
import type { ResolvedEditorialProfile } from '@/lib/editorial/profile';
import type { EditorialStandardsCopy } from '../_lib/editorial-standards-copy';

export function EditorialStandardsView({
  copy,
  locale,
  profile,
}: {
  copy: EditorialStandardsCopy;
  locale: AppLocale;
  profile: ResolvedEditorialProfile;
}) {
  const reviewedDate = new Intl.DateTimeFormat(localeRegions[locale], {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(copy.hero.reviewedDate));

  return (
    <div className="container-page max-w-6xl space-y-12 py-14 sm:space-y-16 sm:py-20">
      <header className="max-w-4xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">{copy.hero.eyebrow}</p>
        <h1 className="mt-5 font-display text-4xl font-semibold tracking-[-0.04em] text-text-primary sm:text-6xl">
          {copy.hero.title}
        </h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-text-secondary">{copy.hero.intro}</p>
        <p className="mt-5 text-sm text-text-muted">
          {copy.hero.reviewedLabel}{' '}
          <time dateTime={copy.hero.reviewedDate}>{reviewedDate}</time>
          <span aria-hidden="true"> · </span>
          <Link href={profile.aboutHref} className="font-semibold text-text-primary hover:text-brand">
            {profile.name}
          </Link>
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        {copy.sections.map((section) => (
          <article
            id={section.id}
            key={section.id}
            className="scroll-mt-[calc(var(--header-height)+32px)] rounded-[24px] border border-hairline bg-surface/75 p-6"
          >
            <h2 className="text-xl font-semibold text-text-primary">{section.title}</h2>
            <p className="mt-3 text-sm leading-7 text-text-secondary">{section.body}</p>
            {section.bullets?.length ? (
              <ul className="mt-4 space-y-2">
                {section.bullets.map((bullet) => (
                  <li key={bullet} className="flex gap-3 text-sm leading-6 text-text-secondary">
                    <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand/70" />
                    {bullet}
                  </li>
                ))}
              </ul>
            ) : null}
          </article>
        ))}
      </section>

      <nav aria-label={copy.hero.eyebrow} className="flex flex-wrap gap-3">
        <Link href={profile.aboutHref} className="rounded-full border border-hairline px-4 py-2 text-sm font-semibold">
          {copy.links.about}
        </Link>
        <Link href={{ pathname: '/benchmarks' }} className="rounded-full border border-hairline px-4 py-2 text-sm font-semibold">
          {copy.links.benchmarks}
        </Link>
        <Link href={{ pathname: '/contact' }} className="rounded-full border border-hairline px-4 py-2 text-sm font-semibold">
          {copy.links.contact}
        </Link>
      </nav>
    </div>
  );
}
