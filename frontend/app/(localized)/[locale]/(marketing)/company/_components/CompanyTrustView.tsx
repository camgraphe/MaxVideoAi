import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/locales';
import { localizePathFromEnglish } from '@/lib/i18n/paths';
import type { CompanyCopy } from '../_lib/company-copy';

export function CompanyTrustView({ copy, locale }: { copy: CompanyCopy; locale: AppLocale }) {
  const href = (path: string) => (path === '/return-policy' ? path : localizePathFromEnglish(locale, path));

  return (
    <div className="container-page max-w-6xl space-y-12 py-14 sm:space-y-16 sm:py-20">
      <header className="max-w-4xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">{copy.hero.eyebrow}</p>
        <h1 className="mt-5 font-display text-4xl font-semibold tracking-[-0.04em] text-text-primary sm:text-6xl">
          {copy.hero.title}
        </h1>
        <p className="mt-6 text-lg leading-8 text-text-secondary">{copy.hero.intro}</p>
      </header>

      <section className="grid gap-4 lg:grid-cols-3">
        {copy.resources.map((group) => (
          <article key={group.title} className="rounded-[24px] border border-hairline bg-surface/75 p-6">
            <h2 className="text-lg font-semibold text-text-primary">{group.title}</h2>
            <ul className="mt-5 space-y-4">
              {group.links.map((item) => (
                <li key={item.href}>
                  <Link href={href(item.href)} className="font-semibold text-brand transition hover:text-brandHover">
                    {item.label}
                  </Link>
                  <p className="mt-1 text-sm leading-6 text-text-secondary">{item.description}</p>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      <section className="rounded-[28px] border border-brand/20 bg-accent-subtle/35 p-6 shadow-card sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">{copy.rights.eyebrow}</p>
        <h2 className="mt-3 text-2xl font-semibold text-text-primary">{copy.rights.title}</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {[copy.rights.uploads, copy.rights.outputs, copy.rights.commercialUse, copy.rights.privacy].map((body) => (
            <p key={body} className="rounded-[18px] border border-hairline bg-surface/70 p-4 text-sm leading-7 text-text-secondary">
              {body}
            </p>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={`${href('/legal/terms')}#generated-media-rights`}
            className="rounded-full border border-hairline px-4 py-2 text-sm font-semibold"
          >
            {copy.rights.legalCta}
          </Link>
          <Link
            href={href('/legal/privacy')}
            className="rounded-full border border-hairline px-4 py-2 text-sm font-semibold"
          >
            {copy.rights.privacyCta}
          </Link>
        </div>
      </section>
    </div>
  );
}
