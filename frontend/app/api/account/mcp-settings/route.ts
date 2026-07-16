import { type NextRequest, type NextResponse } from 'next/server';

import {
  handleMcpSettingsGet,
  handleMcpSettingsPatch,
} from './_lib/mcp-settings-route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  return handleMcpSettingsGet(request);
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  return handleMcpSettingsPatch(request);
}
