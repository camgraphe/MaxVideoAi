import type { PaygSupportedModelId } from '../_content/types';

type Print = { id: string; contactSheet?: string };
type ProgrammeEntry = { model: PaygSupportedModelId; prints: readonly Print[] };

/** Each sheet contains three frames from its own print. An unavailable print yields to the next eligible one. */
export const PAYG_FILM_PROGRAMME: readonly ProgrammeEntry[] = [
  { model: 'kling-v4', prints: [
    { id: 'job_external_fal_fa631c836a5a7905ab77206bc87be7f16721d99e', contactSheet: '/assets/marketing/payg/kling-contact.webp' },
    { id: 'b645e55e-a837-4350-a27c-6198b4f8208a', contactSheet: '/assets/marketing/payg/kling-portrait-contact.webp' },
  ] },
  { model: 'flux-3-max', prints: [{ id: 'job_external_fal_56ea1db8b2c3657977478a1d30c64272758d2b6c', contactSheet: '/assets/marketing/payg/flux-contact.webp' }] },
  { model: 'seedance-2-5', prints: [{ id: 'job_ff94f180-0a2f-4f2b-acb2-bda8352fa9d9', contactSheet: '/assets/marketing/payg/seedance-contact.webp' }] },
  { model: 'minimax-h3', prints: [{ id: '4b53aad0-11a2-4215-a01a-f9b1913a794f' }] },
];

export function findProgrammePrint<T extends { id: string; engineId: string }>(entry: ProgrammeEntry, videos: ReadonlyMap<string, T>) {
  for (const print of entry.prints) {
    const video = videos.get(print.id);
    if (video?.engineId === entry.model) return { video, contactSheet: print.contactSheet };
  }
  return undefined;
}
