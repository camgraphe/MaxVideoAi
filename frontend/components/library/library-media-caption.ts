import type { AssetBrowserAsset } from './AssetLibraryBrowser';
import { compactLibraryCopy } from './compact-library-copy';

/** Technical filenames remain available in Details; the canvas uses recognizable facts. */
export function libraryMediaCaption(asset: AssetBrowserAsset, locale: string) {
  const copy = compactLibraryCopy(locale);
  const name = asset.name?.trim();
  if (
    name &&
    name.length <= 72 &&
    !/[a-f0-9]{20,}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}|^(?:job|output|render|asset)[_-]/i.test(
      name
    )
  )
    return name;
  const kind = asset.kind ? copy[asset.kind] : copy.unknown;
  const date = asset.createdAt ? new Date(asset.createdAt) : null;
  return date && Number.isFinite(date.getTime())
    ? `${kind} · ${date.toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`
    : kind;
}
