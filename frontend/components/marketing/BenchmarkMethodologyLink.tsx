import clsx from 'clsx';
import { FlaskConical } from 'lucide-react';
import type { AppLocale } from '@/i18n/locales';
import { Link } from '@/i18n/navigation';
import { localizePathFromEnglish } from '@/lib/i18n/paths';

const LABELS: Record<AppLocale, string> = {
  en: 'How we benchmark',
  fr: 'Notre méthodologie',
  es: 'Cómo evaluamos',
};

export function BenchmarkMethodologyLink({
  locale,
  variant = 'inline',
  className,
}: {
  locale: AppLocale;
  variant?: 'inline' | 'pill';
  className?: string;
}) {
  return (
    <Link
      href={localizePathFromEnglish(locale, '/benchmarks')}
      className={clsx(
        'inline-flex items-center gap-1.5 font-semibold text-brand transition hover:text-brandHover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        variant === 'pill' && 'min-h-10 rounded-full border border-brand/20 bg-brand/5 px-3 text-xs',
        variant === 'inline' && 'text-xs underline-offset-4 hover:underline',
        className
      )}
    >
      <FlaskConical className="h-3.5 w-3.5" aria-hidden />
      {LABELS[locale]}
    </Link>
  );
}
