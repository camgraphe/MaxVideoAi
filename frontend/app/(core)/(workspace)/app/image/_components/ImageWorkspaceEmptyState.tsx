type ImageWorkspaceEmptyStateProps = {
  message: string;
};

export function ImageWorkspaceLoadingState() {
  return <div className="min-h-96 flex-1 animate-pulse bg-surface" aria-busy="true" />;
}

export function ImageWorkspaceEmptyState({ message }: ImageWorkspaceEmptyStateProps) {
  return (
    <main className="flex flex-1 items-center justify-center bg-bg text-text-secondary">
      {message}
    </main>
  );
}
