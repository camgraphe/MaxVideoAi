/** Ray's priced effects share a projection across previews, validated generation and checkout. */
export function videoPricingExtras(engineId: string, mode: string, values: Readonly<Record<string, unknown>> | null | undefined): {
  hdr?: true; exr_export?: true;
} {
  if (engineId !== 'luma-ray-3-2' || !['t2v', 'i2v', 'v2v'].includes(mode)) return {};
  const enabled = (value: unknown) => value === true || (typeof value === 'string'
    && ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase()));
  return { ...(enabled(values?.hdr) ? { hdr: true } : {}),
    ...(enabled(values?.exr_export ?? values?.exrExport) ? { exr_export: true } : {}) };
}
