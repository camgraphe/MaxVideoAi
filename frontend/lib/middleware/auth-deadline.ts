/** Bound the complete refresh/claims operation, including SDK retry delays. */
export class MiddlewareAuthTimeoutError extends Error {
  constructor() {
    super('Authentication is temporarily unavailable.');
    this.name = 'MiddlewareAuthTimeoutError';
  }
}

export async function withMiddlewareAuthDeadline<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs = 8000,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const error = new MiddlewareAuthTimeoutError();
      reject(error);
      controller.abort(error);
    }, timeoutMs);
  });
  try {
    return await Promise.race([Promise.resolve().then(() => operation(controller.signal)), deadline]);
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}
