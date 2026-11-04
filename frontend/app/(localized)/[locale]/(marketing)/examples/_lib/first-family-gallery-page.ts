import { cache } from 'react';
import { listExampleFamilyPage } from '@/server/videos';
import { DEFAULT_SORT, EXAMPLES_PAGE_SIZE } from './examples-route-utils';

// Metadata and the gallery render in the same request; never retain curated media across requests.
export const readFirstFamilyGalleryPage = cache((familyId: string) =>
  listExampleFamilyPage(familyId, { sort: DEFAULT_SORT, limit: EXAMPLES_PAGE_SIZE, offset: 0, includeVersionSamples: true })
);
