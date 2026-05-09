import OpenAI from 'openai';
import {
  VIDEO_AGENT_LLM_CONFIG,
  type VideoAgentSettings,
} from '../../../../../(core)/(workspace)/app/video-agents/_lib/video-agent-config';
import {
  type CommercialVideoAgentBrief,
  type CommercialVideoMarketingGoal,
} from '../../../../../(core)/(workspace)/app/video-agents/_lib/video-agent-brief';
import {
  askNextCommercialBriefQuestion,
} from '../../../../../(core)/(workspace)/app/video-agents/_lib/video-agent-intake';
import {
  createVideoAgentConfirmation,
  type VideoAgentIntakeApiRequest,
  type VideoAgentIntakeApiResponse,
  type VideoAgentPreparePromptApiRequest,
  type VideoAgentPreparePromptApiResponse,
} from '../../../../../(core)/(workspace)/app/video-agents/_lib/video-agent-api';
import { reviewCommercialVideoRequest, type VideoAgentWarning } from '../../../../../(core)/(workspace)/app/video-agents/_lib/video-agent-safety';

const MARKETING_GOALS: CommercialVideoMarketingGoal[] = [
  'awareness',
  'product_demo',
  'launch',
  'conversion',
  'retargeting',
  'social_ad',
  'brand_story',
  'other',
];

type JsonRecord = Record<string, unknown>;

function createOpenAIClient(): OpenAI | null {
  if (process.env.VIDEO_AGENT_LLM_DISABLED === '1') return null;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function stringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)
    .slice(0, 10);
}

function warningArray(value: unknown): VideoAgentWarning[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter(isRecord)
    .map((warning) => ({
      type: stringValue(warning.type, 'other') as VideoAgentWarning['type'],
      message: stringValue(warning.message),
      severity: stringValue(warning.severity, 'low') as VideoAgentWarning['severity'],
    }))
    .filter((warning) => warning.message)
    .slice(0, 4);
}

function marketingGoal(value: unknown, fallback: CommercialVideoMarketingGoal): CommercialVideoMarketingGoal {
  const goal = stringValue(value);
  return MARKETING_GOALS.includes(goal as CommercialVideoMarketingGoal)
    ? (goal as CommercialVideoMarketingGoal)
    : fallback;
}

function parseJsonObject(raw: string | null | undefined): JsonRecord | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return isRecord(parsed) ? parsed : null;
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      const parsed = JSON.parse(match[0]);
      return isRecord(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
}

function mergeBrief(localBrief: CommercialVideoAgentBrief, value: unknown): CommercialVideoAgentBrief {
  const brief = isRecord(value) ? value : {};

  return {
    rawRequest: localBrief.rawRequest,
    productOrOffer: stringValue(brief.productOrOffer, localBrief.productOrOffer),
    audience: stringValue(brief.audience, localBrief.audience),
    marketingGoal: marketingGoal(brief.marketingGoal, localBrief.marketingGoal),
    mainBenefit: stringValue(brief.mainBenefit, localBrief.mainBenefit),
    scene: stringValue(brief.scene, localBrief.scene),
    visualStyle: stringValue(brief.visualStyle, localBrief.visualStyle),
    brandTone: stringValue(brief.brandTone, localBrief.brandTone),
    cta: stringValue(brief.cta, localBrief.cta).slice(0, 40),
    mustInclude: stringArray(brief.mustInclude, localBrief.mustInclude),
    avoid: stringArray(brief.avoid, localBrief.avoid),
    legalSafetyConstraints: stringArray(
      brief.legalSafetyConstraints,
      localBrief.legalSafetyConstraints
    ),
  };
}

function buildIntakeResponseFromBrief(input: {
  request: VideoAgentIntakeApiRequest;
  brief: CommercialVideoAgentBrief;
  model: string;
  replyHint?: string;
  llmWarnings?: VideoAgentWarning[];
}): VideoAgentIntakeApiResponse {
  const safetyReview = reviewCommercialVideoRequest(input.brief);
  const warnings = [...safetyReview.warnings, ...(input.llmWarnings ?? [])].slice(0, 6);

  if (!safetyReview.allowed) {
    return {
      ok: true,
      action: 'intake',
      source: 'openai',
      model: input.model,
      minimumLatencyMs: VIDEO_AGENT_LLM_CONFIG.latency.intakeMinimumMs,
      phase: 'blocked',
      brief: input.brief,
      confirmation: null,
      assistantReply:
        safetyReview.reason ??
        'I cannot prepare that request. Please rewrite it without unsupported content.',
      warnings,
    };
  }

  const nextQuestion = askNextCommercialBriefQuestion(input.brief);
  if (nextQuestion) {
    return {
      ok: true,
      action: 'intake',
      source: 'openai',
      model: input.model,
      minimumLatencyMs: VIDEO_AGENT_LLM_CONFIG.latency.intakeMinimumMs,
      phase: 'intake',
      brief: input.brief,
      confirmation: null,
      assistantReply: input.replyHint || nextQuestion,
      warnings,
    };
  }

  const confirmation = createVideoAgentConfirmation({
    brief: input.brief,
    estimatedPriceCents: input.request.estimatedPriceCents,
    settings: input.request.settings,
    warnings,
  });

  return {
    ok: true,
    action: 'intake',
    source: 'openai',
    model: input.model,
    minimumLatencyMs: VIDEO_AGENT_LLM_CONFIG.latency.intakeMinimumMs,
    phase: 'confirm',
    brief: input.brief,
    confirmation,
    assistantReply:
      input.replyHint ||
      [
        'I have enough to prepare the commercial video prompt package.',
        `Summary: ${confirmation.summary}`,
        warnings.length ? `Warnings: ${warnings.map((warning) => warning.message).join(' ')}` : '',
        'Confirm in chat and I will prepare the final Seedance prompt and settings for manual testing.',
      ]
        .filter(Boolean)
        .join('\n'),
    warnings,
  };
}

function settingsSummary(settings: VideoAgentSettings): string {
  return `${settings.durationSec}s, ${settings.aspectRatio}, ${settings.resolution}, audio ${settings.audioEnabled ? 'on' : 'off'}`;
}

export async function createOpenAIIntakeResponse(
  request: VideoAgentIntakeApiRequest,
  localFallback: VideoAgentIntakeApiResponse
): Promise<VideoAgentIntakeApiResponse> {
  const client = createOpenAIClient();
  const model = process.env.VIDEO_AGENT_INTAKE_MODEL || VIDEO_AGENT_LLM_CONFIG.intakeModel;

  if (!client) {
    return { ...localFallback, source: 'local-fallback' };
  }

  try {
    const response = await client.chat.completions.create({
      model,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: [
            'You are the public intake agent for MaxVideoAI Commercial Video Agent V1.',
            'Extract a concise commercial video brief for Seedance 2.0 text-to-video.',
            'Ask at most one useful next question when required fields are missing.',
            'Infer reasonable defaults when the intent is clear; do not turn this into a long ChatGPT conversation.',
            'Reject unsafe, sexual, celebrity, protected IP, exact-logo, medical-claim, or financial-claim requests by listing warnings.',
            'Return JSON only with: brief, assistantReply, warnings.',
          ].join('\n'),
        },
        {
          role: 'user',
          content: JSON.stringify({
            currentBrief: request.brief,
            localExtraction: localFallback.brief,
            userMessage: request.message,
            selectedSettings: settingsSummary(request.settings),
            requiredBriefFields: [
              'productOrOffer',
              'audience',
              'mainBenefit',
              'scene',
              'visualStyle',
              'cta',
            ],
            allowedGoals: MARKETING_GOALS,
          }),
        },
      ],
    });

    const parsed = parseJsonObject(response.choices[0]?.message?.content);
    if (!parsed) return localFallback;

    return buildIntakeResponseFromBrief({
      request,
      brief: mergeBrief(localFallback.brief, parsed.brief),
      model,
      replyHint: stringValue(parsed.assistantReply),
      llmWarnings: warningArray(parsed.warnings),
    });
  } catch {
    return {
      ...localFallback,
      source: 'local-fallback',
      minimumLatencyMs: VIDEO_AGENT_LLM_CONFIG.latency.fallbackMinimumMs,
    };
  }
}

export async function createOpenAIPromptResponse(
  request: VideoAgentPreparePromptApiRequest,
  localFallback: VideoAgentPreparePromptApiResponse
): Promise<VideoAgentPreparePromptApiResponse> {
  const client = createOpenAIClient();
  const model = process.env.VIDEO_AGENT_PROMPT_MODEL || VIDEO_AGENT_LLM_CONFIG.promptModel;

  if (!client) {
    return { ...localFallback, source: 'local-fallback' };
  }

  try {
    const response = await client.chat.completions.create({
      model,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: [
            'You are the specialist prompt writer for MaxVideoAI Commercial Video Agent V1.',
            'Improve the provided Seedance 2.0 prompt without changing the selected settings.',
            'Use a compact English commercial-video prompt: subject, scene, action timeline, camera, lighting, mood, composition, audio, final frame, avoid list.',
            'Keep it feasible for the selected duration. No image references, no start frame, no real logos, no celebrities, no protected IP.',
            'Return JSON only with: finalPrompt, assistantReply, warnings.',
          ].join('\n'),
        },
        {
          role: 'user',
          content: JSON.stringify({
            settings: request.settings,
            clientBrief: request.brief,
            localPromptPackage: localFallback.prototypeResult,
          }),
        },
      ],
    });

    const parsed = parseJsonObject(response.choices[0]?.message?.content);
    const finalPrompt = stringValue(parsed?.finalPrompt);
    if (finalPrompt.length < 80) {
      return localFallback;
    }

    return {
      ...localFallback,
      source: 'openai',
      model,
      minimumLatencyMs: VIDEO_AGENT_LLM_CONFIG.latency.promptMinimumMs,
      assistantReply:
        stringValue(parsed?.assistantReply) ||
        'Prompt package ready. I used the Seedance structure and kept the request within the selected duration.',
      prototypeResult: {
        ...localFallback.prototypeResult,
        finalPrompt,
        warnings: [
          ...localFallback.prototypeResult.warnings,
          ...warningArray(parsed?.warnings),
        ].slice(0, 6),
      },
    };
  } catch {
    return {
      ...localFallback,
      source: 'local-fallback',
      minimumLatencyMs: VIDEO_AGENT_LLM_CONFIG.latency.fallbackMinimumMs,
    };
  }
}
