type ImageWorkspaceEmptyStateProps = {
  message: string;
};

export function ImageWorkspaceEmptyState({ message }: ImageWorkspaceEmptyStateProps) {
  return (
    <main className="flex flex-1 items-center justify-center bg-bg text-text-secondary">
      {message}
    </main>
  );
}
