import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/locales';
import { localeRegions } from '@/i18n/locales';
import type { ResolvedEditorialProfile } from '@/lib/editorial/profile';
import type { BenchmarkCopy } from '../_lib/benchmark-copy';
import type { BenchmarkPageData } from '../_lib/benchmark-page-data';

export function BenchmarkEditorialOwnership({
  copy,
  locale,
  methodology,
  profile,
}: {
  copy: BenchmarkCopy;
  locale: AppLocale;
  methodology: BenchmarkPageData['methodology'];
  profile: ResolvedEditorialProfile;
}) {
  const effective = new Intl.DateTimeFormat(localeRegions[locale], {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(methodology.effectiveDate));

  return (
    <div className="mx-auto mt-8 flex max-w-4xl flex-wrap items-center justify-center gap-x-3 gap-y-2 border-t border-hairline pt-5 text-sm text-text-secondary">
      <span>
        {copy.ownership.label}:{' '}
        <Link href={profile.aboutHref} className="font-semibold text-text-primary transition hover:text-brand">
          {profile.name}
        </Link>
      </span>
      <span aria-hidden="true">·</span>
      <span>{profile.jobTitle}</span>
      <span aria-hidden="true">·</span>
      <span>
        {copy.ownership.methodologyVersion} v{methodology.version}
      </span>
      <span aria-hidden="true">·</span>
      <time dateTime={methodology.effectiveDate}>
        {copy.ownership.effective} {effective}
      </time>
      <span aria-hidden="true">·</span>
      <Link
        href={{ pathname: '/editorial-standards' }}
        className="font-semibold text-brand transition hover:text-brandHover"
      >
        {copy.ownership.standards}
      </Link>
    </div>
  );
}
