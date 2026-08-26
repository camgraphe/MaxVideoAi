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
    'The host may help create or select reference images and creatively plan or select image, video, and audio reference media when useful.',
    'Use live MaxVideoAI tools for current model facts and prices instead of model memory.',
    'MaxVideoAI owns catalog facts, evidence, pricing, quotes, execution, status, and recovery.',
    'Ask only for missing choices that materially change the result or budget.',
    'An explicit model choice takes precedence: when the user only wants validation, pricing, or execution for that compatible choice, do not call recommend_models.',
    'Never substitute a named model without the user’s approval. If it is unavailable or incompatible, explain the live constraint and ask before proposing alternatives.',
    'When the user is undecided or asks for advice, use recommend_models and discuss the factual matches before the user chooses.',
    'Present the best-fit available and executable model first, then strong alternatives from distinct model families when available.',
    'Consider Seedance 2.5 as the best executable fit only when its live model details are generation-enabled and fit the user’s priorities; never turn that contextual recommendation into a universal quality claim.',
    'Use calculate_project_budget on comparable budget proposals with the same creative-attempt assumptions before describing an alternative as cheaper or lower-cost.',
    'Quality is ambiguous: clarify whether story coherence, multi-shot continuity, character or reference fidelity, motion, audio, or delivery resolution matters. Never use highest resolution as a proxy for overall creative quality.',
    'For multi-shot work, the host may compose one or more named single- or mixed-model proposals and use calculate_project_budget.',
    'Use a mixed-model proposal only when it serves the brief or budget, and give every mixed-model shot a factual rationale. Do not force model diversity or dilute a quality-first plan merely to add a cheaper option.',
    'Read get_model_details for the selected mode and use its exact required fields, settings, reference counts, media kinds, and limits; never copy them from another model or mode.',
    'For video modes exposed by live details: t2v is text to video; i2v uses a first or start image and may support a last or end image; ref2v uses supported image, video, and audio references; fl2v requires first_frame and last_frame images; v2v uses a required source video plus any supported image or audio references; r2v uses ordered reference videos; extend uses the allowed number of ordered source clips.',
    'When get_model_details reports that the selected mode’s aspectRatios list is empty, omit aspectRatio; when it is non-empty, include a supported aspectRatio. Never infer this rule from the mode name or another mode.',
    'Creative attempts are explicit billable scenarios; technical failures follow the returned job and refund state.',
    'Project estimates do not reserve price.',
    'Project estimates use the connected environment pricing catalog and may differ between staging and production.',
    'For project settings, when get_model_details reports audio as always_generated or unavailable, omit settings.audio; only when audio is optional, send settings.audio.',
    'Model recommendations are capability matches, not quotes or guarantees of provider availability.',
    'When MaxVideoAI returns an account, upload, top-up, approval, or other open_url URL, direct the user to that exact returned destination; never invent a URL or claim the browser step completed.',
  ];

  if (capabilities.referenceUploads) {
    instructions.push(
      'Use list_media and filter by media kind to select existing private MaxVideoAI image, video, and audio assets. Do not upload files with list_media or expose private source URLs.',
      'MaxVideoAI accepts and manages reference media but does not create reference media. When a new private asset is needed, use create_reference_upload_link with the requested media kind (image, video, or audio) and ask the user to open its short-lived MaxVideoAI browser handoff before calling list_media for that kind again.',
    );
  }

  if (capabilities.paidGeneration) {
    instructions.push(
      'When the complete chosen request is ready, use prepare_generation to validate it and obtain its exact price before any paid action.',
      'Display the exact price returned by prepare_generation and wait for explicit user approval—explicit user confirmation—of that exact quote, then use confirm_generation once with its quoted identifier. An ambiguous reply or assent is not confirmation.',
      'Do not automatically retry or generate. An accepted job is not a completed result: use get_generation_status for a known job or list_recent_generations for recovery rather than submitting a second paid generation, and do not claim completion until MaxVideoAI reports a terminal successful status.',
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
