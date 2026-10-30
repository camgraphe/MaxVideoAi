import { AppCreationContent } from '@/components/app/AppCreationContent';

type ImageWorkspaceEmptyStateProps = {
  message: string;
};

export function ImageWorkspaceLoadingState() {
  return <AppCreationContent><div className="min-h-96 flex-1 animate-pulse bg-surface" aria-busy="true" /></AppCreationContent>;
}

export function ImageWorkspaceEmptyState({ message }: ImageWorkspaceEmptyStateProps) {
  return (
    <AppCreationContent><main className="flex flex-1 items-center justify-center bg-bg text-text-secondary">
      {message}
    </main></AppCreationContent>
  );
}
