export type MaxVideoAiMcpInstructionCapabilities = {
  paidGeneration: boolean;
  referenceUploads: boolean;
  montagePreparation?: boolean;
  audioGeneration?: boolean;
  studioMontageCreation?: boolean;
  studioTimelineEditing?: boolean;
  studioExports?: boolean;
};

// Discovery entrypoint. Detailed rules live in each tool descriptor.
// Keep every gate combination within 2,000 UTF-8 bytes; see mcp-client-experience.md.
export function buildMaxVideoAiMcpInstructions(
  capabilities: MaxVideoAiMcpInstructionCapabilities,
): string {
  const instructions = [
    'MaxVideoAI plans AI video/image work, compares models, quotes generation and recovers media in one account.',
  ];
  if (capabilities.paidGeneration) {
    instructions.push(
      'For a complete request use prepare_generation. Display its exact quote; wait for explicit user approval before confirm_generation: one paid attempt. Ambiguous assent is not approval. Failure/refund needs a fresh quote and new approval; never resubmit automatically.',
      'Recover with get_generation_status or list_recent_generations; present_generation delivers completed results.',
    );
  } else {
    instructions.push('Generation is not available; never imply a submission.');
  }
  instructions.push(
    'Use list_models for discovery, get_model_details for exact modes, recommend_models for an open choice, calculate_project_budget for comparable estimates, not quotes. Never substitute a named model without approval; if unavailable or incompatible, explain and ask before alternatives.',
    'The host owns creative discussion, prompts and reference media; an idea or single asset may be enough. Use live facts, not memory or fixed rankings. Ask only what changes the result/budget. Omit unstated nullable inputs or send null; never invent constraints.',
    'get_account_status identifies account/credits. Use only returned URLs and private assets; never claim a browser step completed.',
  );
  if (capabilities.referenceUploads) {
    instructions.push('References: list_media, import_reference_files for host files, create_reference_upload_link for browser/local helper. Keep asset order.');
  }
  if (capabilities.paidGeneration && capabilities.audioGeneration) {
    instructions.push('Audio: list_audio_capabilities, prepare_audio_generation, then confirm_audio_generation after exact-quote approval; same one-attempt rule.');
  }
  if (capabilities.montagePreparation) {
    instructions.push('prepare_montage plans owned clips; no render or saved project.');
  }
  if (capabilities.studioMontageCreation) {
    instructions.push('create_studio_montage saves an editable project.');
  }
  if (capabilities.studioTimelineEditing) {
    instructions.push('Read get_studio_timeline before edit_studio_timeline; preserve revisions/locks.');
  }
  if (capabilities.studioExports) {
    instructions.push('prepare_studio_export quotes a saved cut; confirm_studio_export needs exact-quote approval. Recover with get_studio_export, never rerender.');
  }
  return instructions.join('\n');
}

export const MAXVIDEOAI_MCP_INSTRUCTIONS = buildMaxVideoAiMcpInstructions({
  paidGeneration: false,
  referenceUploads: false,
});
