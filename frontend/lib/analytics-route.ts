import { localePathnames } from '@/i18n/locales';

export type AnalyticsRouteFamily =
  | 'admin'
  | 'auth'
  | 'marketing'
  | 'public_tools'
  | 'app_tools'
  | 'workspace'
  | 'billing';

export type AnalyticsRouteContext = {
  family: AnalyticsRouteFamily;
  normalizedPath: string;
  toolName: string | null;
  toolSurface: 'public' | 'workspace' | null;
  workspaceSection: string | null;
  excludedFromGa4: boolean;
};

const LOCALE_PREFIXES = Array.from(
  new Set(
    Object.values(localePathnames)
      .filter((value): value is string => Boolean(value))
      .map((value) => `/${value}`)
  )
).sort((left, right) => right.length - left.length);

const WORKSPACE_PREFIXES = ['/app', '/dashboard', '/generate', '/jobs', '/settings', '/connect', '/video'];

function ensureLeadingSlash(pathname: string): string {
  if (!pathname) return '/';
  return pathname.startsWith('/') ? pathname : `/${pathname}`;
}

function trimTrailingSlash(pathname: string): string {
  if (pathname.length <= 1) return pathname;
  return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function resolveToolName(normalizedPath: string): string | null {
  if (normalizedPath === '/tools' || normalizedPath === '/app/tools') {
    return 'tools_hub';
  }

  if (normalizedPath.startsWith('/tools/')) {
    return normalizedPath.slice('/tools/'.length).split('/')[0]?.replace(/-/g, '_') ?? null;
  }

  if (normalizedPath.startsWith('/app/tools/')) {
    return normalizedPath.slice('/app/tools/'.length).split('/')[0]?.replace(/-/g, '_') ?? null;
  }

  return null;
}

function resolveWorkspaceSection(normalizedPath: string): string | null {
  if (normalizedPath === '/app') return 'home';
  if (normalizedPath.startsWith('/app/')) {
    return normalizedPath.slice('/app/'.length).split('/')[0] ?? 'home';
  }
  if (normalizedPath === '/generate') return 'generate';
  if (normalizedPath === '/dashboard') return 'dashboard';
  if (normalizedPath === '/jobs') return 'jobs';
  if (normalizedPath === '/settings') return 'settings';
  if (normalizedPath === '/connect') return 'connect';
  if (normalizedPath.startsWith('/video/')) return 'video';
  return null;
}

export function normalizeAnalyticsPath(pathname: string | null | undefined): string {
  const raw = ensureLeadingSlash((pathname ?? '/').split('?')[0]?.split('#')[0] ?? '/');
  const cleaned = trimTrailingSlash(raw);

  for (const prefix of LOCALE_PREFIXES) {
    if (cleaned === prefix) {
      return '/';
    }
    if (matchesPrefix(cleaned, prefix)) {
      const stripped = cleaned.slice(prefix.length);
      return stripped.startsWith('/') ? stripped : `/${stripped}`;
    }
  }

  return cleaned || '/';
}

export function getAnalyticsRouteContext(pathname: string | null | undefined): AnalyticsRouteContext {
  const normalizedPath = normalizeAnalyticsPath(pathname);

  if (matchesPrefix(normalizedPath, '/admin')) {
    return {
      family: 'admin',
      normalizedPath,
      toolName: null,
      toolSurface: null,
      workspaceSection: null,
      excludedFromGa4: true,
    };
  }

  if (
    matchesPrefix(normalizedPath, '/login') ||
    matchesPrefix(normalizedPath, '/signup') ||
    matchesPrefix(normalizedPath, '/auth')
  ) {
    return {
      family: 'auth',
      normalizedPath,
      toolName: null,
      toolSurface: null,
      workspaceSection: null,
      excludedFromGa4: false,
    };
  }

  if (matchesPrefix(normalizedPath, '/billing')) {
    return {
      family: 'billing',
      normalizedPath,
      toolName: null,
      toolSurface: null,
      workspaceSection: 'billing',
      excludedFromGa4: false,
    };
  }

  if (matchesPrefix(normalizedPath, '/app/tools')) {
    return {
      family: 'app_tools',
      normalizedPath,
      toolName: resolveToolName(normalizedPath),
      toolSurface: 'workspace',
      workspaceSection: 'tools',
      excludedFromGa4: false,
    };
  }

  if (matchesPrefix(normalizedPath, '/tools')) {
    return {
      family: 'public_tools',
      normalizedPath,
      toolName: resolveToolName(normalizedPath),
      toolSurface: 'public',
      workspaceSection: null,
      excludedFromGa4: false,
    };
  }

  if (WORKSPACE_PREFIXES.some((prefix) => matchesPrefix(normalizedPath, prefix))) {
    return {
      family: 'workspace',
      normalizedPath,
      toolName: null,
      toolSurface: null,
      workspaceSection: resolveWorkspaceSection(normalizedPath),
      excludedFromGa4: false,
    };
  }

  return {
    family: 'marketing',
    normalizedPath,
    toolName: null,
    toolSurface: null,
    workspaceSection: null,
    excludedFromGa4: false,
  };
}
