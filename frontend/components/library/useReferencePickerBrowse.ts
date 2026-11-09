'use client';
import { useMemo } from 'react';
import { useLibraryBrowse } from '@/hooks/useLibraryBrowse';
import type { LibraryBrowseScope } from '@/lib/library-browse';
import type { AssetBrowserAsset, AssetLibraryBrowserProps } from './AssetLibraryBrowser';
import type { ReferencePickerSelection } from './ReferenceLibraryPicker.client';

/** Ordinary media use the full server library; specialized readers retain their supplied source. */
export function useReferencePickerBrowse(
  props: AssetLibraryBrowserProps & { selection: ReferencePickerSelection },
  query: string,
  organizationScope: Partial<LibraryBrowseScope>,
) {
  const { selection, source } = props;
  const browsingLibrary = Boolean(selection.browseLibrary && selection.ownerId && !selection.onToggle);
  const usingServerBrowse = browsingLibrary || Boolean(
    organizationScope.favorite || organizationScope.trash || organizationScope.collectionId,
  );
  const browseScope: LibraryBrowseScope = {
    view: source === 'recent' ? 'review' : browsingLibrary ? 'all' : 'saved',
    kind: props.assetType,
    source: source === 'all' || source === 'recent' ? undefined : source,
    q: query,
    sort: 'recent',
    ...organizationScope,
  };
  const organized = useLibraryBrowse({
    userId: selection.ownerId ?? null,
    scope: browseScope,
    enabled: usingServerBrowse,
  });
  const assets: AssetBrowserAsset[] = useMemo(
    () => usingServerBrowse
      ? organized.assets.flatMap((asset) => asset.kind ? [{ ...asset, kind: asset.kind }] : [])
      : props.assets,
    [usingServerBrowse, organized.assets, props.assets],
  );
  return { assets, organized, usingServerBrowse, browseScope };
}
