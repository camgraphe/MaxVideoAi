type HeaderReader = Pick<Headers, 'get'> | null | undefined;

export function readBearerAccessToken(headers: HeaderReader): string | null {
  const raw = headers?.get('authorization')?.trim() ?? '';
  if (!raw) {
    return null;
  }

  const match = raw.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim() ?? '';
  return token.length ? token : null;
}
