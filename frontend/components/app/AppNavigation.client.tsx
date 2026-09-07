'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { AppGlyph } from './AppGlyph';
import { APP_ACTIVITIES, appNavLabel, getAppNavigation, getAppNavigationSelection } from './app-navigation';

export function AppNavigation({ variant }: { variant: 'rail' | 'mobile' | 'activities' }) {
  const pathname = usePathname();
  const { locale } = useI18n();
  const selection = getAppNavigationSelection(pathname);
  if (variant === 'activities' && !selection.activity) return null;
  const activities = variant === 'activities';
  const label = activities ? (locale === 'fr' ? 'Type de création' : locale === 'es' ? 'Tipo de creación' : 'Creation type') : (locale === 'fr' ? 'Navigation principale' : locale === 'es' ? 'Navegación principal' : 'Primary navigation');
  return (
    <nav className={`app-navigation app-navigation-${variant}`} aria-label={label}>
      {(activities ? APP_ACTIVITIES : getAppNavigation()).map((item) => (
        <Link key={item.id} href={item.href} prefetch={false} aria-current={(activities ? selection.activity : selection.primary) === item.id ? 'page' : undefined}>
          <AppGlyph name={item.glyph} /><span>{appNavLabel(item, locale)}</span>
        </Link>
      ))}
    </nav>
  );
}
