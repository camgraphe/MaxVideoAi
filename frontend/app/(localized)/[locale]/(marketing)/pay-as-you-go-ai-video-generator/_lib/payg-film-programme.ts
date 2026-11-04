import type { PaygSupportedModelId } from '../_content/types';

type FeaturedFilm = { id: string; model: PaygSupportedModelId; contactSheet?: string };

/** Each contact sheet contains three frames from this exact public render. */
export const PAYG_FILM_PROGRAMME: readonly FeaturedFilm[] = [
  { id: 'job_external_fal_fa631c836a5a7905ab77206bc87be7f16721d99e', model: 'kling-v4', contactSheet: '/assets/marketing/payg/kling-contact.webp' },
  { id: 'job_external_fal_56ea1db8b2c3657977478a1d30c64272758d2b6c', model: 'flux-3-max', contactSheet: '/assets/marketing/payg/flux-contact.webp' },
  { id: 'job_ff94f180-0a2f-4f2b-acb2-bda8352fa9d9', model: 'seedance-2-5', contactSheet: '/assets/marketing/payg/seedance-contact.webp' },
  { id: '4b53aad0-11a2-4215-a01a-f9b1913a794f', model: 'minimax-h3' },
];
