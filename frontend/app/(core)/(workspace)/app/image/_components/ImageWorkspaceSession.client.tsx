'use client';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import ImageWorkspace, { type ImageEngineOption } from '../ImageWorkspace';
import { ImageWorkspaceLoadingState } from './ImageWorkspaceEmptyState';

/** Retire fields, previews and delayed callbacks before another account enters the editor. */
export default function ImageWorkspaceSession({ engines }: { engines: ImageEngineOption[] }) {
  const { user, loading } = useRequireAuth({ redirectIfLoggedOut: false });
  if (loading) return <ImageWorkspaceLoadingState />;
  return <ImageWorkspace key={user?.id ?? 'guest'} engines={engines} accountId={user?.id ?? null} />;
}
