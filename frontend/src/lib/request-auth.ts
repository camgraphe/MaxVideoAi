type HeaderReader = Pick<Headers, 'get'> | null | undefined;

export function readBearerAccessToken(headers: HeaderReader): string | null {
  const raw = headers?.get('authorization')?.trim() ?? '';
  if (!raw) {
    return null;
  }

  const token = raw.replace(/^Bearer\s+/i, '').trim();
  return token.length ? token : null;
}
