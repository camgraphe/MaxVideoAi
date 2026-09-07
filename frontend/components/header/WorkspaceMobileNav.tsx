'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Clapperboard, Images, LibraryBig, Menu } from 'lucide-react';
import { useI18n } from '@/lib/i18n/I18nProvider';

const DESTINATIONS = [
  { href: '/app', key: 'video', label: 'Video', icon: Clapperboard },
  { href: '/app/image', key: 'image', label: 'Image', icon: Images },
  { href: '/app/library', key: 'library', label: 'Library', icon: LibraryBig },
] as const;

export function WorkspaceMobileNav({ onOpenMenu }: { onOpenMenu: () => void }) {
  const pathname = usePathname();
  const { t } = useI18n();
  return (
    <nav
      aria-label={t('workspace.sidebar.aria.menu', 'App menu')}
      className="app-mobile-nav sticky top-[var(--header-height)] z-30 grid grid-cols-4 border-b border-hairline bg-surface px-2 py-1 md:hidden"
    >
      {DESTINATIONS.map(({ href, key, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={key}
            href={href}
            prefetch={false}
            aria-current={active ? 'page' : undefined}
            className={clsx(
              'flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none',
              active ? 'bg-[var(--brand-soft)] text-brand' : 'text-text-secondary hover:bg-surface-2'
            )}
          >
            <Icon className="h-[18px] w-[18px]" aria-hidden />
            {t(`workspace.header.quickNav.${key}`, label)}
          </Link>
        );
      })}
      <button
        type="button"
        onClick={onOpenMenu}
        aria-haspopup="dialog"
        className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-semibold text-text-secondary hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Menu className="h-[18px] w-[18px]" aria-hidden />
        {t('workspace.header.quickNav.menu', 'Menu')}
      </button>
    </nav>
  );
}
