type HrefLike = string | { pathname?: string | null } | null | undefined;

// Internal app and video surfaces are controlled with robots noindex/follow.
// Link-level nofollow is reserved for explicit rel values passed by callers.
export function shouldNofollowHref(_href: HrefLike): boolean {
  return false;
}

export function applyNofollowRel(rel: string | undefined, _href: HrefLike): string | undefined {
  return rel;
}
