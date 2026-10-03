import type { NextRequest } from 'next/server';
import { handleStudioReviewRequest } from '@/server/admin-studio-review/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest) { return handleStudioReviewRequest(request); }
