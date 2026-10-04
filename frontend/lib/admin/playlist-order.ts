/** Both the keyboard controls and drag/drop edit display order, not stored rank. */
export function movePlaylistItem<T extends { videoId: string }>(items: T[], videoId: string, offset: number): T[] {
  const from = items.findIndex((item) => item.videoId === videoId);
  const to = Math.max(0, Math.min(items.length - 1, from + offset));
  if (from < 0 || from === to) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
