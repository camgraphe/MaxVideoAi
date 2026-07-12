import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/locales';
import type { ResolvedEditorialProfile } from '@/lib/editorial/profile';
import { localizePathFromEnglish } from '@/lib/i18n/paths';
import type { BlogEditorialCopy } from '../_lib/blog-editorial-copy';

type BlogAuthorProps = {
  copy: BlogEditorialCopy;
  locale: AppLocale;
  modifiedLabel: string | null;
  profile: ResolvedEditorialProfile;
  publishedLabel: string;
};

export function BlogAuthorByline({ copy, modifiedLabel, profile, publishedLabel }: BlogAuthorProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-text-secondary">
      <span>
        {copy.by}{' '}
        <Link href={profile.aboutHref} className="font-semibold text-text-primary transition hover:text-brand">
          {profile.name}
        </Link>
      </span>
      <span aria-hidden="true">·</span>
      <span>{profile.jobTitle}</span>
      <span aria-hidden="true">·</span>
      <span>
        {copy.published} {publishedLabel}
      </span>
      {modifiedLabel ? (
        <>
          <span aria-hidden="true">·</span>
          <span>
            {copy.updated} {modifiedLabel}
          </span>
        </>
      ) : null}
    </div>
  );
}

export function BlogAuthorCard({ copy, locale, profile }: Omit<BlogAuthorProps, 'modifiedLabel' | 'publishedLabel'>) {
  const standardsHref = localizePathFromEnglish(locale, '/editorial-standards');
  return (
    <section className="rounded-[24px] border border-hairline bg-surface/80 p-6 shadow-sm sm:p-7">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-muted">{copy.aboutAuthor}</p>
      <h2 className="mt-3 text-xl font-semibold text-text-primary">{profile.name}</h2>
      <p className="mt-1 text-sm font-medium text-brand">{profile.jobTitle}</p>
      <p className="mt-4 max-w-3xl text-sm leading-7 text-text-secondary">{profile.bio}</p>
      <div className="mt-5 flex flex-wrap gap-3 text-sm font-semibold">
        <Link href={profile.aboutHref} className="text-link transition hover:text-link-hover">
          {copy.aboutAuthor}
        </Link>
        <Link href={standardsHref} className="text-link transition hover:text-link-hover">
          {copy.standards}
        </Link>
      </div>
    </section>
  );
}
