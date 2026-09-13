'use client';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import ImageWorkspace, { type ImageEngineOption } from '../ImageWorkspace';

/** Retire fields, previews and delayed callbacks before another account enters the editor. */
export default function ImageWorkspaceSession({ engines }: { engines: ImageEngineOption[] }) {
  const { user, loading } = useRequireAuth({ redirectIfLoggedOut: false });
  if (loading) return <div className="min-h-96 flex-1 animate-pulse bg-surface" aria-busy="true" />;
  return <ImageWorkspace key={user?.id ?? 'guest'} engines={engines} accountId={user?.id ?? null} />;
}
