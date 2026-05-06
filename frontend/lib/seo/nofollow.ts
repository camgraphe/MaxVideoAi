type HrefLike = string | { pathname?: string | null } | null | undefined;

// Internal app and video surfaces are controlled with robots noindex/follow.
// Link-level nofollow is reserved for explicit rel values passed by callers.
export function shouldNofollowHref(href: HrefLike): boolean {
  void href;
  return false;
}

export function applyNofollowRel(rel: string | undefined, href: HrefLike): string | undefined {
  void href;
  return rel;
}
