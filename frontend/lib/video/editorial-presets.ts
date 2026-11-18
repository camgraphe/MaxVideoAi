import flashHero from '@/config/model-cinematic-flash-hero.json';
import fluxVisuals from '@/config/model-flux-workflow-visuals.json';
import flash from '../../../content/models/en/seedance-2-5-flash.json';
import seedance from '../../../content/models/en/seedance-2-5.json';
import { getGalleryVideoPreset } from './gallery-presets';

// Register each model's authored English recipes explicitly. Never use another
// model's demonstrations as a fallback for a valid but unregistered identity.
const authoredModels: Record<string, typeof flash> = { [flash.cinematic.modelSlug]: flash };

/** Public prompt/settings recipes only; no generated assets or private provenance. */
export function getVideoEditorialPreset(engineId: string, exampleId: string) {
  if (engineId === fluxVisuals.modelSlug) {
    const recipe = [fluxVisuals.image.recipe, fluxVisuals.endpoints.recipe].find(film => film.id === exampleId);
    if (recipe) return { engineId, mode: recipe.mode, prompt: recipe.prompt, snapshot: {
      schemaVersion: 1, surface: 'video', engineId, inputMode: recipe.mode, prompt: recipe.prompt, core: recipe.settings, refs: {},
    } };
  }
  const board = fluxVisuals.keyframes;
  if (engineId === fluxVisuals.modelSlug && exampleId === board.recipe.id) {
    const { prompt, settings, reasoningLevel } = board.recipe;
    return { engineId, mode: 'ref2v', prompt, snapshot: {
      schemaVersion: 1, surface: 'video', engineId, inputMode: 'ref2v', prompt, core: settings,
      advanced: { extraInputValues: { reasoning_level: reasoningLevel, keyframe_indexes: board.seconds.map(second => second * 24).join(',') } },
      refs: {},
    } };
  }
  const capability = engineId === seedance.cinematic.modelSlug
    ? seedance.cinematic.capabilities.items.find(item => `capability-${item.id}` === exampleId) : undefined;
  if (capability) {
    const mode = capability.id === 'create' ? 'ref2v' : capability.id === 'modify' ? 'v2v' : 'extend';
    return { engineId, mode, prompt: capability.proof.prompt,
      snapshot: { schemaVersion: 1, surface: 'video', engineId, inputMode: mode, prompt: capability.proof.prompt, refs: {} } };
  }
  if (engineId === flashHero.modelSlug && exampleId === flashHero.id) {
    const { prompt, mode } = flashHero;
    return { engineId, mode, prompt, snapshot: { schemaVersion: 1, surface: 'video', engineId, inputMode: mode,
      prompt, core: flashHero.settings, refs: {} } };
  }
  const gallery = getGalleryVideoPreset(engineId, exampleId);
  if (gallery) return {
    engineId, mode: 't2v', prompt: gallery.prompt,
    snapshot: { schemaVersion: 1, surface: 'video', engineId, inputMode: 't2v', prompt: gallery.prompt,
      core: { durationSec: gallery.durationSec, resolution: gallery.resolution, aspectRatio: gallery.aspectRatio, audio: gallery.audio }, refs: {} },
  };
  const model = authoredModels[engineId];
  if (!model) return null;
  const workflow = model.cinematic.workflows.items.find(item => item.id === exampleId);
  const focus = model.cinematic.workflows.items.flatMap(item => item.focus ? [item.focus] : [])
    .find(item => item.id === `focus-${exampleId}`);
  const plan = model.examples.cinematic.shotPlans.find(item => item.assetId === exampleId);
  const promptingAsset = model.examples.cinematic.panels.find(panel => panel.placement === 'prompting')?.assetIds[0];
  const prompt = workflow?.prompt ?? focus?.prompt ?? (exampleId === promptingAsset
    ? model.prompting.demo.prompt
    : plan
      ? plan.prompt ?? `Animate the supplied first frame. ${plan.motion}\nPlanned sound: ${plan.sound}` : null);
  if (!prompt) return null;
  const mode = exampleId === 'modify' ? 'v2v' : exampleId === 'extend' ? 'extend' : 't2v';
  return {
    engineId, mode, prompt,
    // No source import or invented output settings. The normal composer chooses
    // its defaults and requires the visitor's references and a fresh quote.
    snapshot: { schemaVersion: 1, surface: 'video', engineId, inputMode: mode, prompt, refs: {} },
  };
}
