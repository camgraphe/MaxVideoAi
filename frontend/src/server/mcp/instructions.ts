export type MaxVideoAiMcpInstructionCapabilities = {
  paidGeneration: boolean;
  referenceUploads: boolean;
};

export function buildMaxVideoAiMcpInstructions(
  capabilities: MaxVideoAiMcpInstructionCapabilities,
): string {
  const instructions = [
    "Prompt drafting remains the host agent's responsibility.",
    'The host agent may help the user formulate prompts and create or select suitable reference images.',
    'Use MaxVideoAI tools to inspect the connected account and factual model capabilities.',
    'Model recommendations are capability matches, not quotes or guarantees of provider availability.',
  ];

  if (capabilities.referenceUploads) {
    instructions.push(
      'Use list_media to select existing private MaxVideoAI image assets. Do not upload images with list_media or expose private source URLs.',
    );
  }

  if (capabilities.paidGeneration) {
    instructions.push(
      'Use prepare_generation to validate the request and obtain its exact price before any paid action.',
      'Ask for explicit user confirmation of that exact quote, then use confirm_generation with the quoted identifier.',
      'An accepted job is not a completed result: use get_generation_status and do not claim completion until MaxVideoAI reports a terminal successful status.',
    );
  } else {
    instructions.push(
      'Generation is not available in this rollout; do not imply that a video or image was submitted.',
    );
  }

  return instructions.join(' ');
}

export const MAXVIDEOAI_MCP_INSTRUCTIONS = buildMaxVideoAiMcpInstructions({
  paidGeneration: false,
  referenceUploads: false,
});
