'use client';

import Link from 'next/link';
import { Fragment } from 'react';
import { usePathname } from 'next/navigation';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { AppGlyph } from './AppGlyph';
import { APP_ACTIVITIES, appNavLabel, getAppNavigation, getAppNavigationSelection } from './app-navigation';
import { PROMPT_ASSISTANCE_PREVIEW } from '@/lib/prompt-assistance/preview-state';
import { AppCreationMobilePicker, AppCreationRailLinks } from './AppCreationNavigation.client';

export function AppNavigation({ variant, studioVisible = false }: {
  variant: 'rail' | 'mobile' | 'activities';
  studioVisible?: boolean;
}) {
  const pathname = usePathname();
  const { locale } = useI18n();
  const selection = getAppNavigationSelection(pathname, undefined, studioVisible);
  if (variant === 'activities' && !selection.activity) return null;
  if (variant === 'activities' && PROMPT_ASSISTANCE_PREVIEW) return null;
  const activities = variant === 'activities';
  const label = activities ? (locale === 'fr' ? 'Type de création' : locale === 'es' ? 'Tipo de creación' : 'Creation type') : (locale === 'fr' ? 'Navigation principale' : locale === 'es' ? 'Navegación principal' : 'Primary navigation');
  return (
    <nav className={`app-navigation app-navigation-${variant}`} aria-label={label}>
      {(activities ? APP_ACTIVITIES : getAppNavigation(undefined, studioVisible)).map((item) => (
        PROMPT_ASSISTANCE_PREVIEW && variant === 'mobile' && item.id === 'create' ? <AppCreationMobilePicker key={item.id} activity={selection.activity} locale={locale} /> : <Fragment key={item.id}>
        <Link
          href={item.href}
          prefetch={false}
          aria-current={(activities ? selection.activity : selection.primary) === item.id && !(PROMPT_ASSISTANCE_PREVIEW && item.id === 'create') ? 'page' : undefined}
        >
          <AppGlyph name={item.glyph} />
          <span className="app-navigation-label">
            <span>{appNavLabel(item, locale)}</span>
            {item.badge ? <span className="app-navigation-badge" aria-hidden="true">{item.badge}</span> : null}
          </span>
        </Link>
        {PROMPT_ASSISTANCE_PREVIEW && variant === 'rail' && item.id === 'create' ? <AppCreationRailLinks activity={selection.activity} locale={locale} /> : null}
        </Fragment>
      ))}
    </nav>
  );
}
