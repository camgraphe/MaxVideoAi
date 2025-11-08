import fs from 'node:fs';
import path from 'node:path';

let cachedTimestamp: string | null = null;

export function getSitemapBuildTimestamp(): string {
  if (cachedTimestamp) {
    return cachedTimestamp;
  }

  const filePath = path.join(process.cwd(), 'public', '.sitemap_build_timestamp');
  try {
    const contents = fs.readFileSync(filePath, 'utf8').trim();
    if (contents.length > 0) {
      cachedTimestamp = contents;
      return contents;
    }
  } catch {
    // File may not exist on first run; fall through to new timestamp.
  }

  const fallback = new Date().toISOString();
  cachedTimestamp = fallback;
  return fallback;
}
