import { handleMcpHttpRequest } from '@/server/mcp/http-handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

function handler(request: Request): Promise<Response> {
  return handleMcpHttpRequest(request);
}

export const GET = handler;
export const POST = handler;
export const DELETE = handler;
export const PUT = handler;
export const PATCH = handler;
export const OPTIONS = handler;
