'use client';

import useSWR from 'swr';
import { authFetch } from '@/lib/authFetch';
import type { AssetLibrarySource } from '@/components/library/AssetLibraryBrowser';
import type { CharacterReferenceSelection, CharacterReferencesResponse } from '@/types/image-generation';
import type { AssetsResponse, LibraryAsset } from '../_lib/image-workspace-types';

/** Account is part of the cache identity; prior-account responses cannot populate a new picker. */
export function useImageLibraryData({ userId, source, isCharacterMode }: {
  userId: string | null;
  source: AssetLibrarySource;
  isCharacterMode: boolean;
}) {
  const url = isCharacterMode ? '/api/character-references?limit=60'
    : source === 'all' ? '/api/user-assets?limit=60&kind=image'
    : `/api/user-assets?limit=60&kind=image&source=${encodeURIComponent(source)}`;
  const key = userId ? ['image-reference-library', userId, url] : null;
  return useSWR<LibraryAsset[] | CharacterReferenceSelection[]>(key, async ([, , requestUrl]: string[]) => {
    const response = await authFetch(requestUrl);
    const payload = (await response.json().catch(() => null)) as AssetsResponse | CharacterReferencesResponse | null;
    if (!response.ok || !payload?.ok) {
      const message = payload && 'error' in payload && typeof payload.error === 'string' ? payload.error : 'Failed to load library';
      throw new Error(message);
    }
    return 'characters' in payload ? payload.characters : payload.assets;
  }, { keepPreviousData: false });
}
