import { handleAssistantReviewRetentionCron } from '../_lib/assistant-review-retention-handler';
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function GET(req: NextRequest) { return handleAssistantReviewRetentionCron(req); }
import type { NextRequest } from 'next/server';
