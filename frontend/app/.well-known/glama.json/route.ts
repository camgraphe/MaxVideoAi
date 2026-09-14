import { NextResponse } from 'next/server';

import { withMcpNoindexHeaders } from '@/server/mcp/response-headers';

export const dynamic = 'force-static';

const GLAMA_OWNERSHIP_PAYLOAD = {
  $schema: 'https://glama.ai/mcp/schemas/connector.json',
  claim: 'glama_claim_F6nygH7bBQqTyYeJp1TpaOh9hgo2zBbj',
} as const;

export async function GET() {
  return NextResponse.json(GLAMA_OWNERSHIP_PAYLOAD, {
    status: 200,
    headers: withMcpNoindexHeaders({
      'Cache-Control': 'public, max-age=3600',
    }),
  });
}
