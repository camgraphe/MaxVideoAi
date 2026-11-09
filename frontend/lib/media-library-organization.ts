/** Browser-safe organization contracts. References identify sources; they never grant access. */
export type LibraryMediaKind = 'image' | 'video' | 'audio';
export type LibraryMediaReference = ({
    type: 'asset';
    assetId: string;
    kind: LibraryMediaKind;
} | {
    type: 'job-output';
    jobId: string;
    outputId: string;
    kind: LibraryMediaKind;
} | {
    type: 'legacy';
    assetId: string;
    kind: LibraryMediaKind;
}) & {
    sourceRevision?: string;
};
export type LibraryOrganizationState = {
    key: string;
    favorite: boolean;
    trashedAt: string | null;
    collectionIds: string[];
};
export type LibraryOrganizationOperation = 'favorite' | 'unfavorite' | 'trash' | 'restore' | 'add-to-collection' | 'remove-from-collection';
export type LibraryOrganizationResult = {
    reference: LibraryMediaReference;
    key?: string;
    status: 'succeeded' | 'failed';
    error?: string;
    state?: LibraryOrganizationState;
};
export type LibraryOrganizationMutationResult = {
    results: LibraryOrganizationResult[];
    succeededCount: number;
    failedCount: number;
    affectedCount: number;
};
export type LibraryCollection = {
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
};
