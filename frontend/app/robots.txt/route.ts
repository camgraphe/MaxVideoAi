import { getMcpRequestHost, isMcpApiHost } from '@/lib/mcp-host-routing';
import { buildRobotsText, type RobotsSurface } from '@/lib/seo/robots-text';

export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  const requestHost = getMcpRequestHost(request.headers);
  const apiHost = process.env.MCP_API_HOST ?? 'api.maxvideoai.com';
  const surface: RobotsSurface = requestHost && !isMcpApiHost(requestHost, apiHost) ? 'public' : 'protocol';
  return new Response(buildRobotsText(surface), {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=UTF-8',
      'Cache-Control': 'no-store, must-revalidate',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
