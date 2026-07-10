export function getWorkspaceAssetGridClass(fieldCount: number): string {
  if (fieldCount <= 1) return 'grid grid-cols-1 gap-3';
  if (fieldCount === 2) return 'grid grid-cols-1 gap-3 md:grid-cols-2';
  if (fieldCount === 3) return 'grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3';
  return 'grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4';
}
