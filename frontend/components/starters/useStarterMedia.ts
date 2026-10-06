'use client';

import useSWR from 'swr';
import { BUILTIN_STARTER_MEDIA, type StarterMedia, type StarterMediaSurface } from '@/lib/starter-media';

export function useStarterMedia(surface: StarterMediaSurface, enabled = true) {
  const { data } = useSWR<{ items: StarterMedia[] }>(enabled ? `/api/starter-media?surface=${surface}` : null, async url => {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Starter media unavailable');
    return response.json();
  }, { fallbackData: { items: BUILTIN_STARTER_MEDIA[surface] }, revalidateOnFocus: false });
  return data?.items?.length ? data.items : BUILTIN_STARTER_MEDIA[surface];
}
