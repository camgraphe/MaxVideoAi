import mcpPublication from '@/config/mcp-publication.json';
import { buildLlmsText } from '@/lib/seo/llms-text';

export const dynamic = 'force-static';

export function GET() {
  return new Response(buildLlmsText(mcpPublication), {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=UTF-8',
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
