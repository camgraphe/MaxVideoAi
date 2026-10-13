export type PayAsYouGoReadResult<T> = { ok: true; value: T } | { ok: false; error: unknown };

/** Observe started reads immediately, including failures before React renders a boundary. */
export function observePayAsYouGoRead<T>(read: Promise<T>): Promise<PayAsYouGoReadResult<T>> {
  return read.then(value => ({ ok: true, value }), error => ({ ok: false, error }));
}

export async function resolvePayAsYouGoRead<T>(read: Promise<PayAsYouGoReadResult<T>>): Promise<T> {
  const result = await read;
  if (!result.ok) throw result.error;
  return result.value;
}
