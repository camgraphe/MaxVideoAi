import type { LibraryMediaReference, LibraryOrganizationState } from './media-library-organization';
import type { MediaLibraryAsset } from './media-library-client';
export type LibraryBrowseScope = {
    view: 'all' | 'saved' | 'review';
    kind: 'all' | 'image' | 'video' | 'audio';
    source?: string;
    q?: string;
    jobId?: string;
    surface?: string;
    collectionId?: string;
    favorite?: boolean;
    trash?: boolean;
    sort: 'recent' | 'oldest' | 'name';
};
export type LibraryBrowseAsset = MediaLibraryAsset & {
    libraryRef: LibraryMediaReference;
    sourceRevision: string;
    organization: LibraryOrganizationState;
    position?: number;
    status?: string;
    role?: string;
    isSaved?: boolean;
    savedAssetId?: string | null;
    storyboard?: unknown;
    klingFirstFrame?: unknown;
};
export type LibraryBrowseResponse = {
    ok: boolean;
    assets: LibraryBrowseAsset[];
    nextCursor: string | null;
    hasMore: boolean;
    totalCount: number;
    error?: string;
};
export type LibrarySelectionSnapshot = {
    id: string;
    totalCount: number;
    expiresAt: string;
    keys: string[];
};
export type LibrarySnapshotMutationResult = {
    operation: import('./media-library-organization').LibraryOrganizationOperation;
    collectionId?: string;
    succeededKeys: string[];
    failed: {
        key: string;
        errorCode: string;
    }[];
    succeededCount: number;
    failedCount: number;
    affectedCount: number;
};
