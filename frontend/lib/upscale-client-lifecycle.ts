import type { UpscaleToolRequest, UpscaleToolResponse } from '@/types/tools-upscale';
import { getJobStatus, type JobStatusResult } from '@/lib/api-job-status';
import { readLastKnownUserId } from '@/lib/last-known';

const attempts = new Map<string, string>();
export async function upscaleClientAttempt(payload: UpscaleToolRequest) {
  const principal = readLastKnownUserId();
  const settings = Object.fromEntries(Object.entries(payload).filter(([key]) => !['acceptedQuote', 'requestId'].includes(key)).sort(([a], [b]) => a.localeCompare(b)));
  const bytes = new TextEncoder().encode(JSON.stringify([principal, settings]));
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  const key = `upscale-attempt:${Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('')}`;
  const reserve = () => {
    let stored: string | null = null;
    try { stored = localStorage.getItem(key); } catch { /* Memory still protects this page. */ }
    const requestId = payload.requestId ?? attempts.get(key) ?? stored ?? crypto.randomUUID();
    attempts.set(key, requestId);
    try { localStorage.setItem(key, requestId); } catch { /* Storage may be unavailable. */ }
    return { requestId, principal, finish() {
      if (attempts.get(key) === requestId) attempts.delete(key);
      try { if (localStorage.getItem(key) === requestId) localStorage.removeItem(key); } catch { /* Optional storage. */ }
    } };
  };
  return navigator.locks ? navigator.locks.request(key, reserve) : reserve();
}

export async function waitForUpscale(
  accepted: UpscaleToolResponse,
  dependencies: {
    getStatus(jobId: string): Promise<JobStatusResult>;
    sleep(): Promise<void>;
    isCurrent(): boolean;
    onTerminal(): void;
  }
): Promise<UpscaleToolResponse> {
  let result = accepted;
  for (;;) {
    if (!dependencies.isCurrent()) throw new Error('The account changed. Find this upscale in its original account.');
    if (result.status === 'failed') {
      dependencies.onTerminal();
      throw new Error(result.error?.message ?? 'Upscale failed.');
    }
    if (result.output?.url) { dependencies.onTerminal(); return result; }
    if (!result.jobId) throw new Error('Upscale acceptance did not include a job ID.');
    await dependencies.sleep();
    let status: JobStatusResult;
    try { status = await dependencies.getStatus(result.jobId); } catch { continue; }
    result = { ...result, status: status.status,
      output: status.status === 'completed' && status.videoUrl ? { url: status.videoUrl, thumbUrl: status.thumbUrl } : null,
      error: status.status === 'failed' ? { code: 'upscale_failed', message: status.message ?? 'Upscale failed.' } : undefined };
  }
}

export function waitForAcceptedUpscale(accepted: UpscaleToolResponse, attempt: Awaited<ReturnType<typeof upscaleClientAttempt>>) {
  window.dispatchEvent(new CustomEvent('upscale:accepted', { detail: { jobId: accepted.jobId } }));
  return waitForUpscale(accepted, {
    getStatus: getJobStatus,
    sleep: () => new Promise(resolve => setTimeout(resolve, 5_000)),
    isCurrent: () => readLastKnownUserId() === attempt.principal,
    onTerminal: attempt.finish,
  });
}
