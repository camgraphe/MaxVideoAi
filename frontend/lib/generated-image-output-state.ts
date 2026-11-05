/** Private receipt bytes never enter job DTOs; this scalar stops browser polling. */
export function generatedImageOutputPreparationState(provider: string | null | undefined, status: string | null | undefined): 'manual_review' | undefined {
  return provider === 'openai_images_direct' && status === 'provider_polling_stalled' ? 'manual_review' : undefined;
}
