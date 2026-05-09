import { NextRequest, NextResponse } from 'next/server';
import {
  VIDEO_AGENT_LLM_CONFIG,
} from '../../../../(core)/(workspace)/app/video-agents/_lib/video-agent-config';
import {
  createLocalVideoAgentIntakeResponse,
  createLocalVideoAgentPreparePromptResponse,
  type VideoAgentChatApiRequest,
} from '../../../../(core)/(workspace)/app/video-agents/_lib/video-agent-api';
import { createOpenAIIntakeResponse, createOpenAIPromptResponse } from './_lib/video-agent-openai';

export const runtime = 'nodejs';

function invalidRequest(message = 'Invalid video agent chat request') {
  return NextResponse.json(
    {
      ok: false,
      error: message,
      minimumLatencyMs: VIDEO_AGENT_LLM_CONFIG.latency.fallbackMinimumMs,
    },
    { status: 400 }
  );
}

function isRequestRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as VideoAgentChatApiRequest | null;

  if (!isRequestRecord(body)) {
    return invalidRequest();
  }

  if (body.action === 'intake') {
    if (typeof body.message !== 'string' || !body.message.trim()) {
      return invalidRequest('Missing intake message');
    }

    const localFallback = createLocalVideoAgentIntakeResponse(body);
    const response = await createOpenAIIntakeResponse(body, localFallback);
    return NextResponse.json(response);
  }

  if (body.action === 'prepare-prompt') {
    const localFallback = createLocalVideoAgentPreparePromptResponse(body);
    if (!localFallback.ok) {
      return NextResponse.json(localFallback, { status: 400 });
    }

    const response = await createOpenAIPromptResponse(body, localFallback);
    return NextResponse.json(response);
  }

  return invalidRequest();
}
