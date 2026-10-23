/** Reserved literal leaves are protected by S3 policy; ACL/cache metadata alone is insufficient. */
export const VIDEO_EXCERPT_PRIVATE_LEAF_PREFIX = 'video-excerpts-private-v3-';
export type PrivateMediaStorageScope = 'video-excerpt';

export function privateMediaStorageLeaf(leaf: string, scope?: PrivateMediaStorageScope): string {
  if (scope === undefined) return leaf;
  if (scope !== 'video-excerpt') throw new Error('Invalid private media storage scope.');
  return `${VIDEO_EXCERPT_PRIVATE_LEAF_PREFIX}${leaf}`;
}

/** Derivative recovery must preserve privacy even when called without the original upload options. */
export function privateMediaStorageScopeForKey(key: string | null): PrivateMediaStorageScope | undefined {
  if (!key) return undefined;
  const parts = key.split('/');
  if (parts[0] === 'mcp-reference-staging') parts.shift();
  const leaf = parts.at(-1);
  if (!leaf?.startsWith(VIDEO_EXCERPT_PRIVATE_LEAF_PREFIX)) return undefined;
  return (parts.length === 4 && parts[0] === 'user-assets' && parts[1] === 'by-content' && /^[a-f0-9]{32}$/.test(parts[2]))
    || (parts.length === 3 && parts[0] === 'user-asset-thumbs' && Boolean(parts[1])) ? 'video-excerpt' : undefined;
}
