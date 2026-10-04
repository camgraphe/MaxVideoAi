type PreviewContext = {
  requested?: string | string[];
  host: string | null;
  environment?: string;
  sandbox?: string;
};

export function allowLocalSeedanceDraftPreview(context: PreviewContext): boolean {
  if (context.requested !== '1' || context.environment !== 'development' || context.sandbox !== '1') return false;
  const host = context.host?.trim().toLowerCase() ?? '';
  if (!/^(localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/.test(host)) return false;
  try {
    new URL(`http://${host}`);
    return true;
  } catch {
    return false;
  }
}
