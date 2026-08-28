export type SettingsTab = 'account' | 'connections' | 'privacy' | 'notifications';
export type SettingsContentTab = Exclude<SettingsTab, 'connections'>;

export const SETTINGS_TAB_ITEMS: ReadonlyArray<{
  id: SettingsTab;
  href: string;
}> = [
  { id: 'account', href: '/settings' },
  { id: 'connections', href: '/account/connections' },
  { id: 'privacy', href: '/settings?tab=privacy' },
  { id: 'notifications', href: '/settings?tab=notifications' },
];

export function resolveSettingsContentTab(value: string | null | undefined): SettingsContentTab {
  if (value === 'privacy' || value === 'notifications') return value;
  return 'account';
}

export function isSettingsPath(pathname: string | null | undefined): boolean {
  const normalizedPath = pathname?.replace(/\/+$/, '') || '/';
  return (
    normalizedPath === '/settings' ||
    normalizedPath.startsWith('/settings/') ||
    normalizedPath === '/account/connections'
  );
}
