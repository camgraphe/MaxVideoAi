const VISITOR_WORKSPACE_RAW = (process.env.NEXT_PUBLIC_VISITOR_WORKSPACE_ACCESS ?? 'true').trim().toLowerCase();

export const VISITOR_WORKSPACE_ENABLED =
  VISITOR_WORKSPACE_RAW !== 'false' &&
  VISITOR_WORKSPACE_RAW !== '0' &&
  VISITOR_WORKSPACE_RAW !== 'off' &&
  VISITOR_WORKSPACE_RAW !== 'disabled';

export function canVisitorBrowseWorkspacePath(pathname: string): boolean {
  if (!VISITOR_WORKSPACE_ENABLED) return false;
  const normalized = pathname.replace(/\/+$/, '') || '/';
  return (
    normalized === '/app' ||
    normalized === '/app/tools' ||
    normalized === '/app/tools/angle' ||
    normalized === '/app/tools/character-builder' ||
    normalized === '/app/tools/upscale' ||
    normalized === '/dashboard' ||
    normalized === '/jobs' ||
    normalized === '/app/image' ||
    normalized === '/app/library' ||
    normalized === '/billing' ||
    normalized === '/settings'
  );
}
