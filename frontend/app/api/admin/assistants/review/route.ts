import type { NextRequest } from 'next/server';
import { handleAssistantReviewRequest } from '@/server/admin-assistant-review/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest) { return handleAssistantReviewRequest(request); }
