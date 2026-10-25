export type GoogleVertexInlineImage = { data: Buffer; mimeType: string };

export type GoogleVertexImageResponseSummary = {
  responseId: string | null;
  promptBlockReason: string | null;
  finishReasons: string[];
  blockedForSafety: boolean;
};

const SAFETY_FINISH_REASON_PATTERN = /safety|prohibited|blocklist|recitation/i;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

export function extractGoogleVertexImages(payload: unknown): GoogleVertexInlineImage[] {
  const root = asRecord(payload);
  const candidates = Array.isArray(root?.candidates) ? root.candidates : [];
  return candidates.flatMap((candidate) => {
    const content = asRecord(asRecord(candidate)?.content);
    const parts = Array.isArray(content?.parts) ? content.parts : [];
    return parts.flatMap((part) => {
      const inline = asRecord(asRecord(part)?.inlineData);
      if (!inline) return [];
      const data = typeof inline.data === 'string' ? inline.data : null;
      if (!data) return [];
      const decoded = Buffer.from(data, 'base64');
      return decoded.length ? [{ data: decoded, mimeType: typeof inline.mimeType === 'string' ? inline.mimeType : 'image/png' }] : [];
    });
  });
}

export function parseGoogleVertexResponseId(payload: unknown): string | null {
  const root = asRecord(payload);
  return typeof root?.responseId === 'string' ? root.responseId : null;
}

/** Modality counts are separate from inline parts and from the actual invoice. */
export function parseGoogleVertexImageUsage(payload: unknown): {
  inputTokens: number; outputTextTokens: number; outputImageTokens: number; thoughtsTokens: number;
  listEstimateUsd: number; invoiceCostUsd: null; source: string; ratesCheckedAt: string; toolFeesIncluded: false;
} | null {
  const usage = asRecord(asRecord(payload)?.usageMetadata);
  if (!usage || !Array.isArray(usage.candidatesTokensDetails)) return null;
  const valid = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
  if (!valid(usage.promptTokenCount) || !valid(usage.thoughtsTokenCount)) return null;
  const totals: Record<string, number> = { TEXT: 0, IMAGE: 0 };
  for (const item of usage.candidatesTokensDetails) {
    const detail = asRecord(item);
    if (!detail || !['TEXT', 'IMAGE'].includes(String(detail.modality)) || !valid(detail.tokenCount)) return null;
    totals[String(detail.modality)] += detail.tokenCount;
  }
  const inputTokens = usage.promptTokenCount;
  const thoughtsTokens = usage.thoughtsTokenCount;
  return { inputTokens, outputTextTokens: totals.TEXT, outputImageTokens: totals.IMAGE, thoughtsTokens,
    listEstimateUsd: Number(((inputTokens * 1.5 + (totals.TEXT + thoughtsTokens) * 7.5 + totals.IMAGE * 30) / 1_000_000).toFixed(10)),
    invoiceCostUsd: null, source: 'google-vertex-usage-metadata', ratesCheckedAt: '2026-10-25', toolFeesIncluded: false };
}

export function summarizeGoogleVertexImageResponse(payload: unknown): GoogleVertexImageResponseSummary {
  const root = asRecord(payload);
  const promptFeedback = asRecord(root?.promptFeedback);
  const promptBlockReason =
    typeof promptFeedback?.blockReason === 'string' && promptFeedback.blockReason.trim()
      ? promptFeedback.blockReason.trim()
      : null;
  const candidates = Array.isArray(root?.candidates) ? root.candidates : [];
  const finishReasons = Array.from(
    new Set(
      candidates
        .map((candidate) => asRecord(candidate)?.finishReason)
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        .map((value) => value.trim())
    )
  );
  const blockedForSafety = Boolean(
    (promptBlockReason && !/^(?:BLOCK_REASON_)?UNSPECIFIED$/i.test(promptBlockReason)) ||
      finishReasons.some((reason) => SAFETY_FINISH_REASON_PATTERN.test(reason))
  );

  return {
    responseId: parseGoogleVertexResponseId(payload),
    promptBlockReason,
    finishReasons,
    blockedForSafety,
  };
}
