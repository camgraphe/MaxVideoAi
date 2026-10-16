import { exampleRequestSource, parseExampleEntryId } from '@/lib/example-continuation';
import type { ExampleWatchDetail } from '@/lib/example-watch-detail';

/** Reuse public example eligibility; never resolve a private job or a caller-supplied URL. */
export async function loadStudioExampleEntry(value: unknown, load?: (id: string) => Promise<ExampleWatchDetail | null>) {
  const id = parseExampleEntryId(value);
  if (!id) return null;
  const read = load ?? (await import('./example-watch-detail-loader')).getExampleWatchDetail;
  const detail = await read(id);
  return detail ? exampleRequestSource(detail) : null;
}
