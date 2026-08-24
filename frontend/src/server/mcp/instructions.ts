export type MaxVideoAiMcpInstructionCapabilities = {
  paidGeneration: boolean;
  referenceUploads: boolean;
};

export function buildMaxVideoAiMcpInstructions(
  capabilities: MaxVideoAiMcpInstructionCapabilities,
): string {
  const instructions = [
    'The host owns creative discussion, scripts, prompts, shot plans, and reference ideas.',
    'Prompt drafting remains with the host agent.',
    'The host may help create or select reference images when useful.',
    'Use live MaxVideoAI tools for current model facts and prices instead of model memory.',
    'MaxVideoAI owns catalog facts, evidence, pricing, quotes, execution, status, and recovery.',
    'Ask only for missing choices that materially change the result or budget.',
    'For multi-shot work, the host may compose one or more named single- or mixed-model proposals and use calculate_project_budget.',
    'Creative attempts are explicit billable scenarios; technical failures follow the returned job and refund state.',
    'Project estimates do not reserve price.',
    'Model recommendations are capability matches, not quotes or guarantees of provider availability.',
  ];

  if (capabilities.referenceUploads) {
    instructions.push(
      'Use list_media to select existing private MaxVideoAI image assets. Do not upload images with list_media or expose private source URLs.',
      'MaxVideoAI accepts and manages reference assets but does not create reference images. When a new private image is needed, use create_reference_upload_link and ask the user to open its short-lived MaxVideoAI browser handoff before calling list_media again.',
    );
  }

  if (capabilities.paidGeneration) {
    instructions.push(
      'Use prepare_generation to validate the request and obtain its exact price before any paid action.',
      'Ask for explicit user confirmation of that exact quote, then use confirm_generation with the quoted identifier.',
      'Do not automatically retry or generate. An accepted job is not a completed result: use get_generation_status and do not claim completion until MaxVideoAI reports a terminal successful status.',
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
