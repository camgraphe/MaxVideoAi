const APP_PATHS = ['/app', '/dashboard', '/settings', '/jobs', '/billing', '/account/connections'];

export function isAppExperiencePath(pathname: string | null | undefined): boolean {
  return Boolean(pathname && APP_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`)));
}
