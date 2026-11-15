import { getCharacterFormatResolution, getQualityEngineId } from '@/lib/character-builder';
import { CharacterBuilderError } from './error';
import { buildPrompt } from './prompt';
import { sanitizeRequest } from './sanitize';
import { buildSettingsSnapshot } from './snapshot';
import type { RunCharacterBuilderInput } from './types';
import { buildImageUrls, buildInputMode, getAspectRatio, getEngineLabel } from './utils';

/** Pure recipe preparation shared by the workspace and private assistant transports. */
export function prepareCharacterBuilderRequest(input: RunCharacterBuilderInput) {
  const request = sanitizeRequest(input);
  const prompt = buildPrompt(request);
  const imageUrls = buildImageUrls(request);
  const inputMode = buildInputMode(request, imageUrls);
  const engineId = getQualityEngineId(request.qualityMode);
  const engineLabel = getEngineLabel(engineId);
  if (request.generateCount !== 1) {
    throw new CharacterBuilderError('Generate one character image at a time.', { status: 400, code: 'single_output_required' });
  }
  const settingsSnapshot = buildSettingsSnapshot(request, prompt, engineId, engineLabel, inputMode);
  const aspectRatio = getAspectRatio(
    request.outputMode,
    request.action,
    request.outputOptions.fullBodyRequired,
    request.outputOptions.includeCloseUps
  );
  const resolution = getCharacterFormatResolution(request.formatMode, request.qualityMode);

  return { request, prompt, imageUrls, inputMode, engineId, engineLabel, settingsSnapshot, aspectRatio, resolution };
}
