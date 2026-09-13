import { isMcpApiHost } from '@/lib/mcp-host-routing';
import { resolveMcpConfig } from '@/server/mcp/config';

export type StudioFeatureEnv = Readonly<Record<string, string | undefined>>;

export function isStudioMontageCreationEnabled(
  env: StudioFeatureEnv = process.env,
  requestHost?: string | null,
  published = false,
): boolean {
  if (published) return true;
  if (env.NODE_ENV === 'production' || env.STUDIO_MONTAGE_LOCAL_ENABLED !== 'true') return false;
  try {
    const config = resolveMcpConfig(env);
    const resource = new URL(config.resourceUrl);
    const hostname = resource.hostname.toLowerCase();
    const loopback = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname === '::1';
    return loopback && typeof requestHost === 'string' && isMcpApiHost(requestHost, config.apiHost);
  } catch {
    return false;
  }
}
