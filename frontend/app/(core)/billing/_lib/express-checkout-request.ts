const EXPRESS_CHECKOUT_REQUEST_TIMEOUT_MS = 30_000;

/** One bounded native preparation; expiration never starts a replacement request. */
export async function requestWalletExpressCheckout(options: { headers: Record<string, string>; body: string }) {
  const controller = new AbortController();
  let timeoutId: number | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(new Error('express_checkout_request_timeout'));
      controller.abort();
    }, EXPRESS_CHECKOUT_REQUEST_TIMEOUT_MS);
  });
  const readResponse = async () => {
    const response = await fetch('/api/wallet', { method: 'POST', ...options, signal: controller.signal });
    const decoded: unknown = await response.json().catch(() => null);
    const payload = decoded && typeof decoded === 'object' && !Array.isArray(decoded)
      ? decoded as Record<string, unknown> : null;
    return { response, payload };
  };
  try {
    // Abort alone does not bound a fetch/body implementation that ignores its signal.
    return await Promise.race([readResponse(), deadline]);
  } finally {
    if (timeoutId !== undefined) window.clearTimeout(timeoutId);
  }
}
