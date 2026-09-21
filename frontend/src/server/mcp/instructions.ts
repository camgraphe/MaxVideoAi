export type MaxVideoAiMcpInstructionCapabilities = {
  paidGeneration: boolean;
  referenceUploads: boolean;
  montagePreparation?: boolean;
  audioGeneration?: boolean;
  studioMontageCreation?: boolean;
};

// Discovery only: clients may truncate this field at 2 KB. Keep detailed
// workflow rules in the relevant tool descriptor and live result.
// See docs/engineering/mcp-client-experience.md (reviewed 2026-09-21).
export function buildMaxVideoAiMcpInstructions(
  capabilities: MaxVideoAiMcpInstructionCapabilities,
): string {
  const instructions = [
    'MaxVideoAI: plan AI video/image work, compare models, budget Shorts, Reels and ads, animate images, and recover media in one account.',
  ];

  if (capabilities.paidGeneration) {
    instructions.push(
      'Use prepare_generation for a complete request. Display its exact quote and wait for explicit user approval before confirm_generation: one paid attempt only. Ambiguous assent is not approval. Failure or refund requires a fresh quote and new approval; never resubmit automatically.',
      'Recover with get_generation_status or list_recent_generations before any new attempt; present_generation delivers only completed results.',
    );
  } else {
    instructions.push('Generation is not available in this rollout; do not imply a submission.');
  }

  instructions.push(
    'Use list_models for discovery, get_model_details for the selected mode, recommend_models only for an open choice, and calculate_project_budget for comparable estimates, never exact quotes. Never substitute a named model without user approval. If a named model is unavailable or incompatible, explain why and ask before alternatives.',
    'The host owns creative discussion and prompts. This includes scripts, shot plans and creating/selecting reference media. Use live facts, not model memory. Ask only for missing choices that change the result or budget. For nullable inputs, omit or send null when unstated; never invent constraints.',
    'get_account_status identifies the connected account and credits. Use only returned URLs and private assets; never invent a destination or claim a browser step completed.',
  );

  if (capabilities.referenceUploads) {
    instructions.push('Select assets with list_media; import host files with import_reference_files; use create_reference_upload_link for browser/local-helper uploads. Preserve returned asset order.');
  }
  if (capabilities.paidGeneration && capabilities.audioGeneration) {
    instructions.push('Audio: list_audio_capabilities, then prepare_audio_generation; display the exact quote and wait for explicit approval before confirm_audio_generation. Same one-attempt rule.');
  }
  if (capabilities.montagePreparation) {
    instructions.push('prepare_montage validates ordered owned clips without rendering or saving a project.');
  }
  if (capabilities.studioMontageCreation) {
    instructions.push('create_studio_montage saves an editable project; follow its idempotency contract.');
  }
  return instructions.join('\n');
}

export const MAXVIDEOAI_MCP_INSTRUCTIONS = buildMaxVideoAiMcpInstructions({
  paidGeneration: false,
  referenceUploads: false,
  montagePreparation: false,
  audioGeneration: false,
  studioMontageCreation: false,
});
