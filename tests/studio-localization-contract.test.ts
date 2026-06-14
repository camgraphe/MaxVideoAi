import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import type { Dictionary } from '../frontend/lib/i18n/types';
import {
  DEFAULT_STUDIO_COPY,
  formatStudioProjectDate,
  localizeStudioConnectorDisplayLabel,
  localizeStudioEdgeKindLabel,
  localizeStudioGeneratedCanvasText,
  resolveStudioCopy,
} from '../frontend/app/(core)/(workspace)/app/studio/_lib/studio-copy';
import type {
  WorkspaceAssetRecord,
  WorkspaceGraphNode,
  WorkspaceTemplateId,
  WorkspaceTimelineItem,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-types';
import {
  clearWorkspaceGeneratedCopyReferences,
  clearWorkspaceTimelineItemGeneratedCopyReferences,
  localizeWorkspaceAssetSubtitle,
  localizeWorkspaceNodeGeneratedText,
  localizeWorkspaceNodeTitle,
  localizeWorkspacePromptText,
  localizeWorkspaceShotOutputName,
  localizeWorkspaceTimelineItemTitle,
  workspaceOutputNodeTitleDataForShot,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-generated-copy';
import {
  localizeWorkspaceTimelineTrackKindLabel,
  localizeWorkspaceTimelineTrackLabel,
  localizeWorkspaceTimelineTrackNoticeLabel,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-timeline-tracks';
import {
  workspaceLibrarySourceLabelsFromCopy,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-library-assets';
import { normalizePersistedWorkspaceState } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_state/workspace-api-persistence';
import { DEFAULT_WORKSPACE_PROJECT_SETTINGS } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-project-settings';

const root = process.cwd();
const locales = ['en', 'fr', 'es'] as const;

function requiredStudioCopyPaths(source: unknown, prefix = 'workspace.studio'): string[] {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return [];
  return Object.entries(source as Record<string, unknown>).flatMap(([key, value]) => {
    const keyPath = `${prefix}.${key}`;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return requiredStudioCopyPaths(value, keyPath);
    }
    return [keyPath];
  });
}

const requiredPaths = requiredStudioCopyPaths(DEFAULT_STUDIO_COPY);

function readPath(source: unknown, keyPath: string): unknown {
  return keyPath.split('.').reduce<unknown>((current, key) => {
    if (!current || typeof current !== 'object') return undefined;
    return (current as Record<string, unknown>)[key];
  }, source);
}

function formatCopyValue(value: string, replacements: Record<string, string | number>): string {
  return Object.entries(replacements).reduce(
    (current, [key, replacement]) => current.replaceAll(`{${key}}`, String(replacement)),
    value
  );
}

function shotName(copy: Record<string, string>, index: string): string {
  return formatCopyValue(copy.templateShotName, { index });
}

function outputName(copy: Record<string, string>, index: string): string {
  return formatCopyValue(copy.templateOutputName, { index });
}

function shotAudioName(copy: Record<string, string>, name: string): string {
  return formatCopyValue(copy.templateShotAudioName, { name });
}

function stripGeneratedCopyFromNode(node: WorkspaceGraphNode): WorkspaceGraphNode {
  const { generatedCopy: _generatedCopy, ...dataWithoutGeneratedCopy } = node.data;
  void _generatedCopy;
  return {
    ...node,
    data: dataWithoutGeneratedCopy,
  };
}

function stripGeneratedCopyFromTimelineItem(item: WorkspaceTimelineItem): WorkspaceTimelineItem {
  const { generatedCopy: _generatedCopy, ...itemWithoutGeneratedCopy } = item;
  void _generatedCopy;
  return itemWithoutGeneratedCopy;
}

type TemplateLocalizationExpectation = {
  id: WorkspaceTemplateId;
  expected: (copy: Record<string, string>) => string[];
  bannedEnglish: string[];
};

const templateLocalizationExpectations: TemplateLocalizationExpectation[] = [
  {
    id: 'product-ad',
    expected: (copy) => [
      copy.templateProductImage,
      copy.templateStyleReference,
      copy.templateCameraMovement,
      copy.templateAudioReference,
      copy.templateVoiceOver,
      copy.templateProductAdCameraPromptText,
      copy.templateProductAdVoiceoverPromptText,
      shotName(copy, '01'),
      shotName(copy, '02'),
      outputName(copy, '01'),
      outputName(copy, '02'),
      copy.templateHeroReveal,
      copy.templateMacroDetails,
      copy.templateExplodedView,
      copy.templateFinalPackshot,
      shotAudioName(copy, `${shotName(copy, '02')} - ${copy.templateMacroDetails}`),
    ],
    bannedEnglish: [
      'Product Image',
      'Style Reference',
      'Camera Movement',
      'Audio Reference',
      'Voice Over',
      'Hero Reveal',
      'Macro Details',
      'Exploded View',
      'Final Packshot',
      'Shot 01',
      'Output 01',
      'Shot 02 - Macro Details Audio',
      'Smooth cinematic orbit around product, slow push in, premium macro lighting.',
      'Precision in motion. A modern chronograph built for every second that matters.',
    ],
  },
  {
    id: 'dev-blocks',
    expected: (copy) => [
      copy.templateDevImageBlock,
      copy.templateDevVideoBlock,
      copy.templateDevAudioBlock,
      copy.templateDevPromptBlock,
      copy.templateDevShotBlock,
      copy.templateDevOutputBlock,
      copy.templateAssetImageNode,
      copy.templateAssetVideoNode,
      copy.templateAssetAudioNode,
      copy.templateTextPromptNode,
      copy.templateShotNode,
      copy.templateOutputNode,
      copy.templateDevPromptText,
      shotAudioName(copy, copy.templateDevOutputBlock),
    ],
    bannedEnglish: [
      'Dev Image Block',
      'Dev Video Block',
      'Dev Audio Block',
      'Dev Prompt Block',
      'Dev Shot Block',
      'Dev Output Block',
      'Dev Output Block Audio',
      'asset-image node',
      'output node',
      'Use this dev template to tune the prompt block, textarea, handles, spacing, and inspector states.',
    ],
  },
  {
    id: 'character-dialogue',
    expected: (copy) => [
      copy.templateCharacterAnchor,
      copy.templatePerformanceReference,
      copy.templateDialogueDirection,
      copy.templateVoiceCue,
      copy.templateRoomTone,
      copy.templateCharacterDialoguePromptText,
      copy.templateCharacterVoicePromptText,
      copy.templateCharacterCloseUp,
      copy.templateReverseAngle,
      copy.templateReactionBeat,
      copy.templateFinalLine,
      copy.templateDialogueCloseUp,
      shotAudioName(copy, copy.templateReactionBeat),
    ],
    bannedEnglish: [
      'Character Anchor',
      'Performance Reference',
      'Dialogue Direction',
      'Voice Cue',
      'Room Tone',
      'Character Close-up',
      'Reverse Angle',
      'Reaction Beat',
      'Final Line',
      'Dialogue Close-up',
      'Reaction Beat Audio',
      'A close, emotional two-line exchange. Keep the same character identity, soft eye movement, natural pauses, and grounded delivery.',
      'A quiet but decisive voiceover that bridges both shots without breaking character continuity.',
    ],
  },
  {
    id: 'storyboard-to-video',
    expected: (copy) => [
      copy.templateStoryboardFrames,
      copy.templateMotionBoard,
      copy.templatePanelContinuity,
      copy.templateSceneNotes,
      copy.templateTempScore,
      copy.templateStoryboardPromptText,
      copy.templateStoryboardVoicePromptText,
      copy.templatePanel01Establish,
      copy.templatePanel02Action,
      copy.templatePanel03Insert,
      copy.templatePanel04EndFrame,
      copy.templateStoryboardBeat01,
      copy.templateStoryboardBeat02,
      shotAudioName(copy, copy.templateStoryboardBeat02),
    ],
    bannedEnglish: [
      'Storyboard Frames',
      'Motion Board',
      'Panel Continuity',
      'Scene Notes',
      'Temp Score',
      'Panel 01 Establish',
      'Panel 02 Action',
      'Panel 03 Insert',
      'Panel 04 End Frame',
      'Storyboard Beat 01',
      'Storyboard Beat 02',
      'Storyboard Beat 02 Audio',
      'Follow the storyboard order exactly. Use each panel as a beat, preserve screen direction, and make transitions feel like a planned animatic.',
      'Use the storyboard as timing authority: establish, push in, action beat, detail, transition, end frame.',
    ],
  },
  {
    id: 'ugc-ad',
    expected: (copy) => [
      copy.templateCreatorReference,
      copy.templateBrollReference,
      copy.templateHookScript,
      copy.templateCreatorVo,
      copy.templateSocialBed,
      copy.templateUgcPromptText,
      copy.templateUgcVoicePromptText,
      copy.templateHookOpener,
      copy.templateProductProof,
      copy.templateBrollDetail,
      copy.templateCtaMoment,
      copy.templateUgcHook,
      copy.templateProofBroll,
      shotAudioName(copy, copy.templateProofBroll),
    ],
    bannedEnglish: [
      'Creator Reference',
      'B-roll Reference',
      'Hook Script',
      'Creator VO',
      'Social Bed',
      'Hook Opener',
      'Product Proof',
      'B-roll Detail',
      'CTA Moment',
      'UGC Hook',
      'Proof B-roll',
      'Proof B-roll Audio',
      'Open with a direct hook, show the product in use, cut to one proof point, then close with a clean visual payoff.',
      'Conversational voiceover: fast hook, believable benefit, no over-polished ad language.',
    ],
  },
  {
    id: 'cinematic-scene',
    expected: (copy) => [
      copy.templateMoodPlate,
      copy.templateCameraLanguage,
      copy.templateScenePrompt,
      copy.templateTrailerVo,
      copy.templateTrailerPulse,
      copy.templateCinematicScenePromptText,
      copy.templateCinematicVoicePromptText,
      copy.templateWideEstablishing,
      copy.templateCharacterReveal,
      copy.templateActionInsert,
      copy.templateFinalFrame,
      copy.templateTrailerEstablish,
      copy.templateTrailerReveal,
      shotAudioName(copy, copy.templateTrailerReveal),
    ],
    bannedEnglish: [
      'Mood Plate',
      'Camera Language',
      'Scene Prompt',
      'Trailer VO',
      'Trailer Pulse',
      'Wide Establishing',
      'Character Reveal',
      'Action Insert',
      'Final Frame',
      'Trailer Establish',
      'Trailer Reveal',
      'Trailer Reveal Audio',
      'Build a cinematic trailer beat: wide establishing image, controlled camera push, character reveal, atmosphere, and dramatic final frame.',
      'Sparse narration with tension: one line before the reveal, one line on the final frame.',
    ],
  },
];

function localizedTemplateTextValues(
  template: {
    nodes: WorkspaceGraphNode[];
    timelineItems: WorkspaceTimelineItem[];
  },
  copy: Record<string, string>
): string[] {
  const nodeValues = template.nodes.flatMap((node) => {
    const generatedCopy = node.data.generatedCopy;
    return [
      localizeWorkspaceNodeGeneratedText(node.data.title, generatedCopy?.title, copy),
      localizeWorkspaceNodeGeneratedText(node.data.subtitle, generatedCopy?.subtitle, copy),
      localizeWorkspaceNodeGeneratedText(node.data.promptText, generatedCopy?.promptText, copy),
      localizeWorkspaceNodeGeneratedText(node.data.shot?.outputName, generatedCopy?.shotOutputName, copy),
    ];
  }).filter((value): value is string => typeof value === 'string');
  const timelineValues = template.timelineItems
    .map((item) => localizeWorkspaceTimelineItemTitle(item, copy))
    .filter((value): value is string => typeof value === 'string');
  return [...nodeValues, ...timelineValues];
}

test('Studio localization dictionaries expose required copy in every locale', () => {
  locales.forEach((locale) => {
    const dictionary = JSON.parse(fs.readFileSync(path.join(root, `frontend/messages/${locale}.json`), 'utf8'));
    requiredPaths.forEach((keyPath) => {
      const value = readPath(dictionary, keyPath);
      assert.equal(typeof value, 'string', `${locale} ${keyPath} should be a string`);
      assert.ok(String(value).trim().length > 0, `${locale} ${keyPath} should not be empty`);
    });
  });
});

test('Studio asset library source filters use localized copy', () => {
  const frDictionary = JSON.parse(fs.readFileSync(path.join(root, 'frontend/messages/fr.json'), 'utf8')) as Dictionary;
  const esDictionary = JSON.parse(fs.readFileSync(path.join(root, 'frontend/messages/es.json'), 'utf8')) as Dictionary;
  const frLabels = workspaceLibrarySourceLabelsFromCopy(resolveStudioCopy(frDictionary).assetLibrary);
  const esLabels = workspaceLibrarySourceLabelsFromCopy(resolveStudioCopy(esDictionary).assetLibrary);

  assert.equal(frLabels.all, 'Tous');
  assert.equal(frLabels.recent, 'Récents');
  assert.equal(frLabels.upload, 'Importés');
  assert.equal(frLabels.generated, 'Générés');
  assert.equal(frLabels.character, 'Personnage');
  assert.equal(esLabels.all, 'Todos');
  assert.equal(esLabels.recent, 'Recientes');
  assert.equal(esLabels.upload, 'Subidos');
  assert.equal(esLabels.generated, 'Generados');
  assert.equal(esLabels.character, 'Personaje');
});

test('resolveStudioCopy falls back when the Studio namespace is missing', () => {
  const copy = resolveStudioCopy({ workspace: {} } as unknown as Dictionary);

  assert.deepEqual(copy, DEFAULT_STUDIO_COPY);
});

test('resolveStudioCopy applies partial leaf overrides without dropping sibling defaults', () => {
  const copy = resolveStudioCopy({
    workspace: {
      studio: {
        projects: {
          title: 'Custom Studio title',
        },
        topbar: {
          canvas: 'Board',
        },
        canvas: {
          toolbar: {
            selectNodes: 'Select blocks',
          },
        },
        notices: {
          unlockBeforeMoving: 'Unlock first.',
        },
      },
    },
  } as unknown as Dictionary);

  assert.equal(copy.projects.title, 'Custom Studio title');
  assert.equal(copy.projects.createProject, DEFAULT_STUDIO_COPY.projects.createProject);
  assert.equal(copy.topbar.canvas, 'Board');
  assert.equal(copy.topbar.viewer, DEFAULT_STUDIO_COPY.topbar.viewer);
  assert.equal(copy.common.itemPlural, DEFAULT_STUDIO_COPY.common.itemPlural);
  assert.equal(copy.canvas.toolbar.selectNodes, 'Select blocks');
  assert.equal(copy.canvas.toolbar.marqueeSelectNodes, DEFAULT_STUDIO_COPY.canvas.toolbar.marqueeSelectNodes);
  assert.equal(copy.canvas.toolbar.saveCanvas, DEFAULT_STUDIO_COPY.canvas.toolbar.saveCanvas);
  assert.equal(copy.canvas.templates.canvasPanel, DEFAULT_STUDIO_COPY.canvas.templates.canvasPanel);
  assert.equal(copy.notices.unlockBeforeMoving, 'Unlock first.');
  assert.equal(copy.notices.unlockBeforeCutting, DEFAULT_STUDIO_COPY.notices.unlockBeforeCutting);
  assert.equal(copy.notices.canvasTemplateCreatedFrom, DEFAULT_STUDIO_COPY.notices.canvasTemplateCreatedFrom);
});

test('resolveStudioCopy ignores wrong-typed values and keeps defaults', () => {
  const copy = resolveStudioCopy({
    workspace: {
      studio: {
        projects: {
          title: 42,
          createProject: 'Create custom',
        },
        topbar: 'invalid topbar',
        timeline: {
          tools: {
            selection: 123,
          },
        },
        common: {
          itemPlural: null,
        },
        notices: {
          unlockBeforeMoving: ['wrong'],
        },
      },
    },
  } as unknown as Dictionary);

  assert.equal(copy.projects.title, DEFAULT_STUDIO_COPY.projects.title);
  assert.equal(copy.projects.createProject, 'Create custom');
  assert.deepEqual(copy.topbar, DEFAULT_STUDIO_COPY.topbar);
  assert.equal(copy.timeline.tools.selection, DEFAULT_STUDIO_COPY.timeline.tools.selection);
  assert.equal(copy.common.itemPlural, DEFAULT_STUDIO_COPY.common.itemPlural);
  assert.equal(copy.notices.unlockBeforeMoving, DEFAULT_STUDIO_COPY.notices.unlockBeforeMoving);
});

test('formatStudioProjectDate handles invalid and valid Studio dates', () => {
  assert.equal(
    formatStudioProjectDate('en', 'not-a-date', DEFAULT_STUDIO_COPY),
    DEFAULT_STUDIO_COPY.projects.localDraft
  );

  const formatted = formatStudioProjectDate('en', '2026-06-12T14:30:00.000Z', DEFAULT_STUDIO_COPY);

  assert.equal(typeof formatted, 'string');
  assert.ok(formatted.trim().length > 0, 'valid Studio project date should format to a nonempty string');
  assert.notEqual(formatted, DEFAULT_STUDIO_COPY.projects.localDraft);
});

test('Studio starter templates relocalize generated text across languages', async () => {
  const { createStarterWorkspaceTemplate } = await import(
    '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-templates'
  );
  const frDictionary = JSON.parse(fs.readFileSync(path.join(root, 'frontend/messages/fr.json'), 'utf8')) as Dictionary;
  const esDictionary = JSON.parse(fs.readFileSync(path.join(root, 'frontend/messages/es.json'), 'utf8')) as Dictionary;
  const frCopy = resolveStudioCopy(frDictionary);
  const esCopy = resolveStudioCopy(esDictionary);

  const template = createStarterWorkspaceTemplate('cinematic-scene', frCopy.canvas.nodes);
  const styleReference = template.nodes.find((node) => node.id === 'asset-style-reference');
  const scenePrompt = template.nodes.find((node) => node.id === 'prompt-camera');
  const finalShot = template.nodes.find((node) => node.id === 'shot-04');
  const firstOutput = template.nodes.find((node) => node.id === 'output-01');

  assert.equal(styleReference?.data.title, frCopy.canvas.nodes.templateCameraLanguage);
  assert.equal(scenePrompt?.data.promptText, frCopy.canvas.nodes.templateCinematicScenePromptText);
  assert.equal(finalShot?.data.title, shotName(frCopy.canvas.nodes, '04'));
  assert.equal(finalShot?.data.subtitle, frCopy.canvas.nodes.templateFinalFrame);
  assert.equal(finalShot?.data.shot?.outputName, frCopy.canvas.nodes.templateFinalFrame);
  assert.equal(firstOutput?.data.title, outputName(frCopy.canvas.nodes, '01'));

  assert.equal(
    localizeWorkspaceNodeGeneratedText(styleReference?.data.title, styleReference?.data.generatedCopy?.title, esCopy.canvas.nodes),
    esCopy.canvas.nodes.templateCameraLanguage
  );
  assert.equal(
    localizeWorkspaceNodeGeneratedText(scenePrompt?.data.promptText, scenePrompt?.data.generatedCopy?.promptText, esCopy.canvas.nodes),
    esCopy.canvas.nodes.templateCinematicScenePromptText
  );
  assert.equal(
    localizeWorkspaceNodeGeneratedText(finalShot?.data.title, finalShot?.data.generatedCopy?.title, esCopy.canvas.nodes),
    shotName(esCopy.canvas.nodes, '04')
  );
  assert.equal(
    localizeWorkspaceNodeGeneratedText(finalShot?.data.subtitle, finalShot?.data.generatedCopy?.subtitle, esCopy.canvas.nodes),
    esCopy.canvas.nodes.templateFinalFrame
  );
  assert.equal(
    localizeWorkspaceNodeGeneratedText(finalShot?.data.shot?.outputName, finalShot?.data.generatedCopy?.shotOutputName, esCopy.canvas.nodes),
    esCopy.canvas.nodes.templateFinalFrame
  );
  assert.equal(
    localizeWorkspaceNodeGeneratedText(firstOutput?.data.title, firstOutput?.data.generatedCopy?.title, esCopy.canvas.nodes),
    outputName(esCopy.canvas.nodes, '01')
  );
  assert.equal(
    localizeStudioGeneratedCanvasText('Plan 04 - Image finale', esCopy.canvas.nodes),
    `${shotName(esCopy.canvas.nodes, '04')} - ${esCopy.canvas.nodes.templateFinalFrame}`
  );
  assert.equal(
    localizeStudioGeneratedCanvasText('Sortie 01', esCopy.canvas.nodes),
    outputName(esCopy.canvas.nodes, '01')
  );

  [
    ['Bloc image dev', esCopy.canvas.nodes.templateDevImageBlock],
    ['Ancre personnage', esCopy.canvas.nodes.templateCharacterAnchor],
    ['Images storyboard', esCopy.canvas.nodes.templateStoryboardFrames],
    ['Accroche UGC', esCopy.canvas.nodes.templateUgcHook],
  ].forEach(([sourceValue, expectedValue]) => {
    assert.equal(localizeStudioGeneratedCanvasText(sourceValue, esCopy.canvas.nodes), expectedValue);
  });

  [
    [frCopy.canvas.nodes.templateDevPromptText, esCopy.canvas.nodes.templateDevPromptText],
    [frCopy.canvas.nodes.templateCharacterDialoguePromptText, esCopy.canvas.nodes.templateCharacterDialoguePromptText],
    [frCopy.canvas.nodes.templateCharacterVoicePromptText, esCopy.canvas.nodes.templateCharacterVoicePromptText],
    [frCopy.canvas.nodes.templateStoryboardPromptText, esCopy.canvas.nodes.templateStoryboardPromptText],
    [frCopy.canvas.nodes.templateStoryboardVoicePromptText, esCopy.canvas.nodes.templateStoryboardVoicePromptText],
    [frCopy.canvas.nodes.templateUgcPromptText, esCopy.canvas.nodes.templateUgcPromptText],
    [frCopy.canvas.nodes.templateUgcVoicePromptText, esCopy.canvas.nodes.templateUgcVoicePromptText],
  ].forEach(([sourceValue, expectedValue]) => {
    assert.equal(localizeStudioGeneratedCanvasText(sourceValue, esCopy.canvas.nodes), expectedValue);
  });

  [
    ['Bloque de imagen dev', frCopy.canvas.nodes.templateDevImageBlock],
    ['Ancla de personaje', frCopy.canvas.nodes.templateCharacterAnchor],
    ['Fotogramas storyboard', frCopy.canvas.nodes.templateStoryboardFrames],
    ['Gancho UGC', frCopy.canvas.nodes.templateUgcHook],
  ].forEach(([sourceValue, expectedValue]) => {
    assert.equal(localizeStudioGeneratedCanvasText(sourceValue, frCopy.canvas.nodes), expectedValue);
  });

  [
    [esCopy.canvas.nodes.templateDevPromptText, frCopy.canvas.nodes.templateDevPromptText],
    [esCopy.canvas.nodes.templateCharacterDialoguePromptText, frCopy.canvas.nodes.templateCharacterDialoguePromptText],
    [esCopy.canvas.nodes.templateStoryboardPromptText, frCopy.canvas.nodes.templateStoryboardPromptText],
    [esCopy.canvas.nodes.templateUgcPromptText, frCopy.canvas.nodes.templateUgcPromptText],
  ].forEach(([sourceValue, expectedValue]) => {
    assert.equal(localizeStudioGeneratedCanvasText(sourceValue, frCopy.canvas.nodes), expectedValue);
  });

  const localizedProduct = createStarterWorkspaceTemplate('product-ad', frCopy.canvas.nodes);
  const productPrompt = localizedProduct.nodes.find((node) => node.id === 'prompt-camera');
  const productVoice = localizedProduct.nodes.find((node) => node.id === 'prompt-voiceover');
  const productHeroShot = localizedProduct.nodes.find((node) => node.id === 'shot-01');
  assert.equal(productPrompt?.data.promptText, frCopy.canvas.nodes.templateProductAdCameraPromptText);
  assert.equal(productVoice?.data.promptText, frCopy.canvas.nodes.templateProductAdVoiceoverPromptText);
  assert.equal(productHeroShot?.data.shot?.outputName, frCopy.canvas.nodes.templateHeroReveal);
  assert.equal(
    localizeWorkspaceNodeGeneratedText(productPrompt?.data.promptText, productPrompt?.data.generatedCopy?.promptText, esCopy.canvas.nodes),
    esCopy.canvas.nodes.templateProductAdCameraPromptText
  );
  assert.equal(
    localizeWorkspaceNodeGeneratedText(productHeroShot?.data.shot?.outputName, productHeroShot?.data.generatedCopy?.shotOutputName, esCopy.canvas.nodes),
    esCopy.canvas.nodes.templateHeroReveal
  );

  const canonicalProduct = createStarterWorkspaceTemplate('product-ad');
  assert.equal(
    canonicalProduct.nodes.find((node) => node.id === 'prompt-camera')?.data.promptText,
    'Smooth cinematic orbit around product, slow push in, premium macro lighting.'
  );
});

test('Studio generated canvas text preserves custom shot labels while localizing known tails', () => {
  const frDictionary = JSON.parse(fs.readFileSync(path.join(root, 'frontend/messages/fr.json'), 'utf8')) as Dictionary;
  const esDictionary = JSON.parse(fs.readFileSync(path.join(root, 'frontend/messages/es.json'), 'utf8')) as Dictionary;
  const frCopy = resolveStudioCopy(frDictionary).canvas.nodes;
  const esCopy = resolveStudioCopy(esDictionary).canvas.nodes;

  assert.equal(
    localizeStudioGeneratedCanvasText('Shot 02 - Café Lumière', frCopy),
    `${shotName(frCopy, '02')} - Café Lumière`
  );
  assert.equal(
    localizeStudioGeneratedCanvasText('Plan 02 - Café Lumière', esCopy),
    `${shotName(esCopy, '02')} - Café Lumière`
  );
  assert.equal(
    localizeStudioGeneratedCanvasText('Shot 02 - Café Lumière Audio', frCopy),
    shotAudioName(frCopy, `${shotName(frCopy, '02')} - Café Lumière`)
  );
  assert.equal(
    localizeStudioGeneratedCanvasText('Shot 02 - Macro Details Tail', frCopy),
    formatCopyValue(frCopy.templateTimelineTailPreviewName, {
      name: `${shotName(frCopy, '02')} - ${frCopy.templateMacroDetails}`,
    })
  );
  assert.equal(
    localizeStudioGeneratedCanvasText('Fin de Plan 02 - Détails macro', esCopy),
    formatCopyValue(esCopy.templateTimelineTailPreviewName, {
      name: `${shotName(esCopy, '02')} - ${esCopy.templateMacroDetails}`,
    })
  );
  assert.equal(
    localizeStudioGeneratedCanvasText('Shot 02 - Café Lumière Tail', frCopy),
    'Shot 02 - Café Lumière Tail'
  );
});

test('Studio starter template node state stays canonical and carries generated copy provenance', async () => {
  const { createStarterWorkspaceTemplate } = await import(
    '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-templates'
  );
  const {
    localizeWorkspaceNodeGeneratedText,
    localizeWorkspaceShotOutputName,
  } = await import(
    '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-generated-copy'
  );
  const frDictionary = JSON.parse(fs.readFileSync(path.join(root, 'frontend/messages/fr.json'), 'utf8')) as Dictionary;
  const frCopy = resolveStudioCopy(frDictionary).canvas.nodes;
  const changedCopy = {
    ...frCopy,
    templateHeroReveal: '__hero_reveal_changed__',
    templateProductAdCameraPromptText: '__camera_prompt_changed__',
  };

  const template = createStarterWorkspaceTemplate('product-ad');
  const promptNode = template.nodes.find((node) => node.id === 'prompt-camera');
  const heroShot = template.nodes.find((node) => node.id === 'shot-01');
  assert.ok(promptNode, 'product template should include prompt-camera');
  assert.ok(heroShot?.data.shot, 'product template should include shot-01 settings');

  assert.equal(
    promptNode.data.promptText,
    'Smooth cinematic orbit around product, slow push in, premium macro lighting.'
  );
  assert.notEqual(promptNode.data.promptText, frCopy.templateProductAdCameraPromptText);
  assert.equal(promptNode.data.generatedCopy?.promptText?.key, 'templateProductAdCameraPromptText');
  assert.equal(heroShot.data.shot.outputName, 'Hero Reveal');
  assert.notEqual(heroShot.data.shot.outputName, frCopy.templateHeroReveal);
  assert.equal(heroShot.data.generatedCopy?.shotOutputName?.key, 'templateHeroReveal');

  assert.equal(
    localizeWorkspaceNodeGeneratedText(promptNode.data.promptText, promptNode.data.generatedCopy?.promptText, changedCopy),
    changedCopy.templateProductAdCameraPromptText
  );
  assert.equal(
    localizeWorkspaceShotOutputName(heroShot, changedCopy),
    changedCopy.templateHeroReveal
  );
});

test('Studio generated copy localization preserves custom exact-match node text without provenance', async () => {
  const { localizeWorkspaceNodeGeneratedText } = await import(
    '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-generated-copy'
  );
  const frDictionary = JSON.parse(fs.readFileSync(path.join(root, 'frontend/messages/fr.json'), 'utf8')) as Dictionary;
  const frCopy = resolveStudioCopy(frDictionary).canvas.nodes;

  assert.equal(localizeWorkspaceNodeGeneratedText('Final Frame', undefined, frCopy), 'Final Frame');
  assert.equal(localizeWorkspaceNodeGeneratedText('Camera Language', undefined, frCopy), 'Camera Language');
  assert.equal(localizeWorkspaceNodeGeneratedText('Output 01', undefined, frCopy), 'Output 01');
  assert.equal(
    localizeWorkspaceNodeGeneratedText('Final Frame', { key: 'templateFinalFrame' }, frCopy),
    frCopy.templateFinalFrame
  );
  assert.equal(
    localizeWorkspaceNodeGeneratedText('Output 01', { key: 'templateOutputName', replacements: { index: '01' } }, frCopy),
    outputName(frCopy, '01')
  );
});

test('Studio timeline clip title localization requires generated provenance', async () => {
  const { createStarterWorkspaceTemplate } = await import(
    '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-templates'
  );
  const frDictionary = JSON.parse(fs.readFileSync(path.join(root, 'frontend/messages/fr.json'), 'utf8')) as Dictionary;
  const frCopy = resolveStudioCopy(frDictionary).canvas.nodes;
  const template = createStarterWorkspaceTemplate('product-ad');
  const starterClip = template.timelineItems.find((item) => item.id === 'timeline-output-02');
  assert.ok(starterClip, 'product template should include timeline-output-02');

  assert.equal(starterClip.title, 'Shot 02 - Macro Details');
  assert.equal(
    localizeWorkspaceTimelineItemTitle(starterClip, frCopy),
    `${shotName(frCopy, '02')} - ${frCopy.templateMacroDetails}`
  );

  const customExactMatchClip: WorkspaceTimelineItem = {
    id: 'custom-final-frame',
    outputNodeId: 'custom-output',
    track: 'video',
    title: 'Final Frame',
    durationSec: 5,
    startSec: 0,
    mediaKind: 'video',
  };
  assert.equal(localizeWorkspaceTimelineItemTitle(customExactMatchClip, frCopy), 'Final Frame');

  const editedStarterClip: WorkspaceTimelineItem = {
    ...starterClip,
    title: 'Hero Reveal',
    generatedCopy: clearWorkspaceTimelineItemGeneratedCopyReferences(starterClip.generatedCopy, ['title']),
  };
  assert.equal(localizeWorkspaceTimelineItemTitle(editedStarterClip, frCopy), 'Hero Reveal');

  const sourceChecks = [
    {
      relativePath: 'frontend/app/(core)/(workspace)/app/studio/workspace/_components/timeline/TimelineClip.tsx',
      localizedPattern: /localizeWorkspaceTimelineItemTitle\(item, canvasNodeCopy\)/,
      rawPattern: /localizeStudioGeneratedCanvasText\(item\.title/,
    },
    {
      relativePath: 'frontend/app/(core)/(workspace)/app/studio/workspace/_components/TimelineClipInspector.tsx',
      localizedPattern: /localizeWorkspaceTimelineItemTitle\(selectedItem, canvasNodeCopy\)/,
      rawPattern: /localizeStudioGeneratedCanvasText\(selectedItem\.title/,
    },
    {
      relativePath: 'frontend/app/(core)/(workspace)/app/studio/workspace/_components/timeline/TimelineTrackRow.tsx',
      localizedPattern: /\{item\.title\}/,
      rawPattern: /localizeStudioGeneratedCanvasText\(item\.title/,
    },
    {
      relativePath: 'frontend/app/(core)/(workspace)/app/studio/workspace/_lib/timeline/timeline-external-drop.ts',
      localizedPattern: /localizeWorkspaceTimelineItemTitle\(item, copy\)/,
      rawPattern: /localizeStudioGeneratedCanvasText\(title/,
    },
  ];

  sourceChecks.forEach(({ relativePath, localizedPattern, rawPattern }) => {
    const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
    assert.match(source, localizedPattern, `${relativePath} should localize generated timeline titles via provenance`);
    assert.doesNotMatch(source, rawPattern, `${relativePath} should not localize timeline titles by raw text only`);
  });
});

test('Studio generated output nodes replace stale template output provenance with shot output provenance', async () => {
  const { createStarterWorkspaceTemplate } = await import(
    '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-templates'
  );
  const { localizeWorkspaceNodeTitle } = await import(
    '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-generated-copy'
  );
  const frDictionary = JSON.parse(fs.readFileSync(path.join(root, 'frontend/messages/fr.json'), 'utf8')) as Dictionary;
  const esDictionary = JSON.parse(fs.readFileSync(path.join(root, 'frontend/messages/es.json'), 'utf8')) as Dictionary;
  const frCopy = resolveStudioCopy(frDictionary).canvas.nodes;
  const esCopy = resolveStudioCopy(esDictionary).canvas.nodes;
  const template = createStarterWorkspaceTemplate('product-ad');
  const shotNode = template.nodes.find((node) => node.id === 'shot-01');
  const starterOutput = template.nodes.find((node) => node.id === 'output-01');
  assert.ok(shotNode?.data.shot, 'product template should include shot-01 settings');
  assert.ok(starterOutput, 'product template should include output-01');

  const titleData = workspaceOutputNodeTitleDataForShot(shotNode);
  const generatedOutputNode: WorkspaceGraphNode = {
    ...starterOutput,
    data: {
      ...starterOutput.data,
      ...titleData,
    },
  };

  assert.equal(titleData.title, 'Hero Reveal');
  assert.equal(titleData.generatedCopy?.title?.key, 'templateHeroReveal');
  assert.equal(localizeWorkspaceNodeTitle(generatedOutputNode, frCopy), frCopy.templateHeroReveal);
  assert.equal(localizeWorkspaceNodeTitle(generatedOutputNode, esCopy), esCopy.templateHeroReveal);
  assert.notEqual(localizeWorkspaceNodeTitle(generatedOutputNode, frCopy), outputName(frCopy, '01'));

  const customShotNode: WorkspaceGraphNode = {
    ...shotNode,
    data: {
      ...shotNode.data,
      generatedCopy: {
        ...shotNode.data.generatedCopy,
        shotOutputName: undefined,
      },
      shot: {
        ...shotNode.data.shot,
        outputName: 'Final Frame',
      },
    },
  };
  const customTitleData = workspaceOutputNodeTitleDataForShot(customShotNode);
  const customOutputNode: WorkspaceGraphNode = {
    ...starterOutput,
    data: {
      ...starterOutput.data,
      ...customTitleData,
    },
  };

  assert.equal(customTitleData.title, 'Final Frame');
  assert.equal(customTitleData.generatedCopy, undefined);
  assert.equal(localizeWorkspaceNodeTitle(customOutputNode, frCopy), 'Final Frame');
});

test('Studio asset metadata subtitles localize template media labels without rewriting custom metadata', () => {
  const frDictionary = JSON.parse(fs.readFileSync(path.join(root, 'frontend/messages/fr.json'), 'utf8')) as Dictionary;
  const esDictionary = JSON.parse(fs.readFileSync(path.join(root, 'frontend/messages/es.json'), 'utf8')) as Dictionary;
  const frCopy = resolveStudioCopy(frDictionary).canvas.nodes;
  const esCopy = resolveStudioCopy(esDictionary).canvas.nodes;

  assert.equal(localizeWorkspaceAssetSubtitle('Audio · reference', frCopy), `${frCopy.audio} · ${frCopy.edgeReference}`);
  assert.equal(localizeWorkspaceAssetSubtitle('Audio · 28s', esCopy), `${esCopy.audio} · 28s`);
  assert.equal(localizeWorkspaceAssetSubtitle('Video · reference', frCopy), `${frCopy.video} · ${frCopy.edgeReference}`);
  assert.equal(localizeWorkspaceAssetSubtitle('Image · 2048x2048', esCopy), `${esCopy.image} · 2048x2048`);
  assert.equal(localizeWorkspaceAssetSubtitle('reference_audio.wav', frCopy), 'reference_audio.wav');
  assert.equal(localizeWorkspaceAssetSubtitle('Logo · 1024x1024', esCopy), 'Logo · 1024x1024');

  const source = fs.readFileSync(
    path.join(root, 'frontend/app/(core)/(workspace)/app/studio/workspace/_components/nodes/workspace-node-types.tsx'),
    'utf8'
  );
  assert.match(source, /localizeWorkspaceAssetSubtitle\(String\(asset\.subtitle \?\? ''\), copy\)/);
  assert.doesNotMatch(source, /replace\(\/^Video\\b/);
});

test('Studio persisted starter workspaces without generated copy provenance are conservatively migrated', async () => {
  const { createStarterWorkspaceTemplate } = await import(
    '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-templates'
  );
  const frDictionary = JSON.parse(fs.readFileSync(path.join(root, 'frontend/messages/fr.json'), 'utf8')) as Dictionary;
  const esDictionary = JSON.parse(fs.readFileSync(path.join(root, 'frontend/messages/es.json'), 'utf8')) as Dictionary;
  const frCopy = resolveStudioCopy(frDictionary).canvas.nodes;
  const esCopy = resolveStudioCopy(esDictionary).canvas.nodes;
  const template = createStarterWorkspaceTemplate('cinematic-scene');
  const oldPersistedWorkspace = {
    nodes: template.nodes.map(stripGeneratedCopyFromNode),
    edges: template.edges,
    timelineItems: template.timelineItems.map(stripGeneratedCopyFromTimelineItem),
    activeTemplateId: 'cinematic-scene',
    projectSettings: DEFAULT_WORKSPACE_PROJECT_SETTINGS,
  };

  const migrated = normalizePersistedWorkspaceState(oldPersistedWorkspace);
  assert.ok(migrated, 'old persisted starter workspace should normalize');
  const cameraLanguageNode = migrated.nodes.find((node) => node.id === 'asset-style-reference');
  const finalShot = migrated.nodes.find((node) => node.id === 'shot-04');
  const firstOutput = migrated.nodes.find((node) => node.id === 'output-01');
  const trailerRevealClip = migrated.timelineItems.find((item) => item.id === 'timeline-output-02');

  assert.equal(cameraLanguageNode?.data.generatedCopy?.title?.key, 'templateCameraLanguage');
  assert.equal(finalShot?.data.generatedCopy?.subtitle?.key, 'templateFinalFrame');
  assert.equal(finalShot?.data.generatedCopy?.shotOutputName?.key, 'templateFinalFrame');
  assert.equal(firstOutput?.data.generatedCopy?.title?.key, 'templateOutputName');
  assert.equal(trailerRevealClip?.generatedCopy?.title?.key, 'templateTrailerReveal');
  assert.equal(cameraLanguageNode ? localizeWorkspaceNodeTitle(cameraLanguageNode, frCopy) : '', frCopy.templateCameraLanguage);
  assert.equal(finalShot ? localizeWorkspaceShotOutputName(finalShot, esCopy) : '', esCopy.templateFinalFrame);
  assert.equal(trailerRevealClip ? localizeWorkspaceTimelineItemTitle(trailerRevealClip, frCopy) : '', frCopy.templateTrailerReveal);
});

test('Studio persisted generated copy migration preserves custom exact-match text outside starter context', async () => {
  const { createStarterWorkspaceTemplate } = await import(
    '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-templates'
  );
  const frDictionary = JSON.parse(fs.readFileSync(path.join(root, 'frontend/messages/fr.json'), 'utf8')) as Dictionary;
  const frCopy = resolveStudioCopy(frDictionary).canvas.nodes;
  const template = createStarterWorkspaceTemplate('product-ad');
  const oldPersistedWorkspace = {
    nodes: template.nodes.map((node) => {
      const stripped = stripGeneratedCopyFromNode(node);
      if (stripped.id === 'prompt-camera') {
        return {
          ...stripped,
          data: {
            ...stripped.data,
            promptText: 'Final Frame',
          },
        };
      }
      if (stripped.id === 'shot-01' && stripped.data.shot) {
        return {
          ...stripped,
          data: {
            ...stripped.data,
            shot: {
              ...stripped.data.shot,
              outputName: 'Final Frame',
            },
          },
        };
      }
      if (stripped.id === 'output-01' && stripped.data.output) {
        return {
          ...stripped,
          data: {
            ...stripped.data,
            output: {
              ...stripped.data.output,
              sourceShotId: 'custom-shot',
            },
          },
        };
      }
      return stripped;
    }),
    edges: template.edges,
    timelineItems: template.timelineItems.map((item) => (
      item.id === 'timeline-output-02'
        ? { ...stripGeneratedCopyFromTimelineItem(item), title: 'Hero Reveal' }
        : stripGeneratedCopyFromTimelineItem(item)
    )),
    activeTemplateId: 'product-ad',
    projectSettings: DEFAULT_WORKSPACE_PROJECT_SETTINGS,
  };

  const migrated = normalizePersistedWorkspaceState(oldPersistedWorkspace);
  assert.ok(migrated, 'customized persisted workspace should normalize');
  const promptNode = migrated.nodes.find((node) => node.id === 'prompt-camera');
  const heroShot = migrated.nodes.find((node) => node.id === 'shot-01');
  const firstOutput = migrated.nodes.find((node) => node.id === 'output-01');
  const customClip = migrated.timelineItems.find((item) => item.id === 'timeline-output-02');

  assert.equal(promptNode?.data.generatedCopy?.promptText, undefined);
  assert.equal(heroShot?.data.generatedCopy?.shotOutputName, undefined);
  assert.equal(firstOutput?.data.generatedCopy?.title, undefined);
  assert.equal(customClip?.generatedCopy?.title, undefined);
  assert.equal(promptNode ? localizeWorkspacePromptText(promptNode, frCopy) : '', 'Final Frame');
  assert.equal(heroShot ? localizeWorkspaceShotOutputName(heroShot, frCopy) : '', 'Final Frame');
  assert.equal(firstOutput ? localizeWorkspaceNodeTitle(firstOutput, frCopy) : '', 'Output 01');
  assert.equal(customClip ? localizeWorkspaceTimelineItemTitle(customClip, frCopy) : '', 'Hero Reveal');
});

test('Studio persisted generated copy migration respects modern cleared exact-match fields', async () => {
  const { createStarterWorkspaceTemplate } = await import(
    '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-templates'
  );
  const frDictionary = JSON.parse(fs.readFileSync(path.join(root, 'frontend/messages/fr.json'), 'utf8')) as Dictionary;
  const frCopy = resolveStudioCopy(frDictionary).canvas.nodes;
  const template = createStarterWorkspaceTemplate('product-ad');
  const starterPrompt = template.nodes.find((node) => node.id === 'prompt-camera')?.data.promptText;
  assert.equal(starterPrompt, 'Smooth cinematic orbit around product, slow push in, premium macro lighting.');

  const modernEditedWorkspace = {
    nodes: template.nodes.map((node): WorkspaceGraphNode => {
      if (node.id === 'prompt-camera') {
        return {
          ...node,
          data: {
            ...node.data,
            generatedCopy: clearWorkspaceGeneratedCopyReferences(node.data.generatedCopy, ['promptText']),
            promptText: starterPrompt,
          },
        };
      }
      if (node.id === 'shot-01' && node.data.shot) {
        return {
          ...node,
          data: {
            ...node.data,
            generatedCopy: clearWorkspaceGeneratedCopyReferences(node.data.generatedCopy, ['subtitle', 'shotOutputName']),
            subtitle: 'Hero Reveal',
            shot: {
              ...node.data.shot,
              outputName: 'Hero Reveal',
            },
          },
        };
      }
      if (node.id === 'output-01') {
        return {
          ...node,
          data: {
            ...node.data,
            generatedCopy: clearWorkspaceGeneratedCopyReferences(node.data.generatedCopy, ['title']),
            title: 'Output 01',
          },
        };
      }
      return node;
    }),
    edges: template.edges,
    timelineItems: template.timelineItems.map((item) => (
      item.id === 'timeline-output-01'
        ? {
            ...item,
            generatedCopy: clearWorkspaceTimelineItemGeneratedCopyReferences(item.generatedCopy, ['title']),
          }
        : item
    )),
    activeTemplateId: 'product-ad',
    projectSettings: DEFAULT_WORKSPACE_PROJECT_SETTINGS,
  };

  const migrated = normalizePersistedWorkspaceState(modernEditedWorkspace);
  assert.ok(migrated, 'modern edited persisted workspace should normalize');
  const promptNode = migrated.nodes.find((node) => node.id === 'prompt-camera');
  const heroShot = migrated.nodes.find((node) => node.id === 'shot-01');
  const firstOutput = migrated.nodes.find((node) => node.id === 'output-01');
  const firstClip = migrated.timelineItems.find((item) => item.id === 'timeline-output-01');

  assert.equal(promptNode?.data.generatedCopy?.promptText, null);
  assert.equal(heroShot?.data.generatedCopy?.shotOutputName, null);
  assert.equal(firstOutput?.data.generatedCopy?.title, null);
  assert.equal(firstClip?.generatedCopy?.title, null);
  assert.equal(promptNode ? localizeWorkspacePromptText(promptNode, frCopy) : '', starterPrompt);
  assert.equal(heroShot ? localizeWorkspaceShotOutputName(heroShot, frCopy) : '', 'Hero Reveal');
  assert.equal(firstOutput ? localizeWorkspaceNodeTitle(firstOutput, frCopy) : '', 'Output 01');
  assert.equal(firstClip ? localizeWorkspaceTimelineItemTitle(firstClip, frCopy) : '', 'Shot 01 - Hero Reveal');
});

test('Studio connector display labels localize fallback labels by connector kind', () => {
  const frDictionary = JSON.parse(fs.readFileSync(path.join(root, 'frontend/messages/fr.json'), 'utf8')) as Dictionary;
  const frCopy = resolveStudioCopy(frDictionary).canvas.nodes;

  assert.equal(localizeStudioConnectorDisplayLabel('Camera', frCopy, 'camera'), frCopy.edgeCamera);
  assert.equal(localizeStudioConnectorDisplayLabel('Reference', frCopy, 'reference'), frCopy.edgeReference);
  assert.equal(localizeStudioConnectorDisplayLabel('Generated output', frCopy, 'generated_output'), frCopy.edgeGeneratedOutput);
  assert.equal(localizeStudioConnectorDisplayLabel('Source video', frCopy, 'video_reference'), frCopy.connectorSourceVideo);
  assert.equal(localizeStudioConnectorDisplayLabel('Custom camera lens', frCopy, 'camera'), 'Custom camera lens');

  const source = fs.readFileSync(
    path.join(root, 'frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceRenderNodes.ts'),
    'utf8'
  );
  assert.match(source, /localizeStudioConnectorDisplayLabel\(connector\.label, studioCanvasCopy\.nodes, connector\.kind\)/);
});

test('Studio canvas notices localize connection, media, and track labels by active copy', async () => {
  const { createStarterWorkspaceTemplate } = await import(
    '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-templates'
  );
  const frDictionary = JSON.parse(fs.readFileSync(path.join(root, 'frontend/messages/fr.json'), 'utf8')) as Dictionary;
  const esDictionary = JSON.parse(fs.readFileSync(path.join(root, 'frontend/messages/es.json'), 'utf8')) as Dictionary;
  const frCopy = resolveStudioCopy(frDictionary).canvas.nodes;
  const esCopy = resolveStudioCopy(esDictionary).canvas.nodes;
  const template = createStarterWorkspaceTemplate('product-ad');
  const outputNode = template.nodes.find((node) => node.id === 'output-01');
  assert.ok(outputNode, 'product template should include output-01');

  assert.equal(localizeStudioEdgeKindLabel('camera', frCopy), frCopy.edgeCamera);
  assert.equal(localizeWorkspaceNodeTitle(outputNode, frCopy), outputName(frCopy, '01'));
  assert.equal(localizeWorkspaceTimelineTrackNoticeLabel('video', frCopy), `${frCopy.video} 1`);
  assert.equal(localizeWorkspaceTimelineTrackNoticeLabel('audio-2', esCopy), `${esCopy.audio ?? 'Audio'} 2`);

  const graphActionsSource = fs.readFileSync(
    path.join(root, 'frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceGraphActions.ts'),
    'utf8'
  );
  assert.match(graphActionsSource, /studioCanvasNodeCopy: StudioCopy\['canvas'\]\['nodes'\]/);
  assert.match(graphActionsSource, /localizeStudioEdgeKindLabel\(edge\.data\?\.kind \?\? kind, studioCanvasNodeCopy\)/);
  assert.match(graphActionsSource, /localizeStudioEdgeKindLabel\(edge\.data\?\.kind \?\? request\.handleId, studioCanvasNodeCopy\)/);
  assert.doesNotMatch(graphActionsSource, /(label|connector): edge\.data\?\.label/);

  const canvasTimelineSource = fs.readFileSync(
    path.join(root, 'frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceCanvasTimelineActions.ts'),
    'utf8'
  );
  assert.match(canvasTimelineSource, /studioCanvasNodeCopy: StudioCopy\['canvas'\]\['nodes'\]/);
  assert.match(canvasTimelineSource, /localizeWorkspaceNodeTitle\(mediaNode, studioCanvasNodeCopy\)/);
  assert.match(canvasTimelineSource, /localizeWorkspaceTimelineTrackNoticeLabel\(targetTrack, studioCanvasNodeCopy\)/);
  assert.doesNotMatch(
    canvasTimelineSource,
    /setNotice\(formatNotice\(studioNotices\.nodeDroppedOnTimeline, \{[\s\S]{0,200}title: mediaNode\.data\.title/
  );
  assert.doesNotMatch(
    canvasTimelineSource,
    /setNotice\(formatNotice\(studioNotices\.nodeDroppedOnTimeline, \{[\s\S]{0,200}track: targetTrack/
  );
});

test('Studio handle-drop created nodes localize connector-derived labels and prompt seeds', async () => {
  const {
    createWorkspaceHandleDropNode,
    resolveWorkspaceHandleDropDraft,
  } = await import('../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-handle-drop');
  const frDictionary = JSON.parse(fs.readFileSync(path.join(root, 'frontend/messages/fr.json'), 'utf8')) as Dictionary;
  const frCopy = resolveStudioCopy(frDictionary);
  const cameraDraft = resolveWorkspaceHandleDropDraft('camera', frCopy.notices, 'target', frCopy.canvas.nodes);
  const referenceDraft = resolveWorkspaceHandleDropDraft('reference', frCopy.notices, 'target', frCopy.canvas.nodes);
  assert.ok(cameraDraft, 'camera handle drop should create a prompt node draft');
  assert.ok(referenceDraft, 'reference handle drop should create an image node draft');

  assert.equal(
    cameraDraft.title,
    formatCopyValue(frCopy.notices.promptNodeTitle, { label: frCopy.canvas.nodes.edgeCamera })
  );
  assert.equal(
    referenceDraft.title,
    formatCopyValue(frCopy.notices.imageNodeTitle, { label: frCopy.canvas.nodes.edgeReference })
  );
  assert.ok(!cameraDraft.title.includes('Camera'));
  assert.ok(!referenceDraft.title.includes('Reference'));

  const promptNode = createWorkspaceHandleDropNode({
    defaultModelId: 'seedance-1-pro',
    draft: cameraDraft,
    index: 1,
    notices: frCopy.notices,
    position: { x: 0, y: 0 },
  });
  assert.equal(
    promptNode.data.promptText,
    formatCopyValue(frCopy.notices.draftHandlePromptText, {
      label: frCopy.canvas.nodes.edgeCamera.toLocaleLowerCase(),
    })
  );
  assert.ok(!String(promptNode.data.promptText).includes('camera'));

  const graphActionsSource = fs.readFileSync(
    path.join(root, 'frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceGraphActions.ts'),
    'utf8'
  );
  assert.match(graphActionsSource, /resolveWorkspaceHandleDropDraft\(request\.handleId, studioNotices, request\.handleType, studioCanvasNodeCopy\)/);
});

test('Studio handle-drop generated node labels and prompt seeds relocalize through generated copy provenance', async () => {
  const {
    createWorkspaceHandleDropNode,
    resolveWorkspaceHandleDropDraft,
  } = await import('../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-handle-drop');
  const frDictionary = JSON.parse(fs.readFileSync(path.join(root, 'frontend/messages/fr.json'), 'utf8')) as Dictionary;
  const esDictionary = JSON.parse(fs.readFileSync(path.join(root, 'frontend/messages/es.json'), 'utf8')) as Dictionary;
  const frCopy = resolveStudioCopy(frDictionary);
  const esCopy = resolveStudioCopy(esDictionary);
  const cameraDraft = resolveWorkspaceHandleDropDraft('camera', frCopy.notices, 'target', frCopy.canvas.nodes);
  const outputDraft = resolveWorkspaceHandleDropDraft('generated_output', frCopy.notices, 'source', frCopy.canvas.nodes);
  assert.ok(cameraDraft, 'camera handle drop should create a prompt node draft');
  assert.ok(outputDraft, 'generated output handle drop should create an output node draft');

  const promptNode = createWorkspaceHandleDropNode({
    defaultModelId: 'seedance-1-pro',
    draft: cameraDraft,
    index: 1,
    notices: frCopy.notices,
    position: { x: 0, y: 0 },
  });
  const outputNode = createWorkspaceHandleDropNode({
    defaultModelId: 'seedance-1-pro',
    draft: outputDraft,
    index: 2,
    notices: frCopy.notices,
    position: { x: 120, y: 0 },
  });

  assert.equal(promptNode.data.generatedCopy?.title?.key, 'handlePromptNodeTitle');
  assert.equal(promptNode.data.generatedCopy?.title?.edgeKindReplacements?.label, 'camera');
  assert.equal(promptNode.data.generatedCopy?.promptText?.key, 'handleDraftPromptText');
  assert.equal(promptNode.data.generatedCopy?.promptText?.lowercaseEdgeKindReplacements?.label, 'camera');
  assert.equal(outputNode.data.generatedCopy?.title?.key, 'handleGeneratedOutputTitle');
  assert.equal(
    localizeWorkspaceNodeTitle(promptNode, esCopy.canvas.nodes),
    formatCopyValue(esCopy.canvas.nodes.handlePromptNodeTitle, { label: esCopy.canvas.nodes.edgeCamera })
  );
  assert.equal(
    localizeWorkspacePromptText(promptNode, esCopy.canvas.nodes),
    formatCopyValue(esCopy.canvas.nodes.handleDraftPromptText, {
      label: esCopy.canvas.nodes.edgeCamera.toLocaleLowerCase(),
    })
  );
  assert.equal(localizeWorkspaceNodeTitle(outputNode, esCopy.canvas.nodes), esCopy.canvas.nodes.handleGeneratedOutputTitle);

  const customPromptNode: WorkspaceGraphNode = {
    ...promptNode,
    data: {
      ...promptNode.data,
      generatedCopy: clearWorkspaceGeneratedCopyReferences(promptNode.data.generatedCopy, ['title', 'promptText']),
      title: 'Camera Prompt',
      promptText: 'Draft camera input...',
    },
  };
  assert.equal(localizeWorkspaceNodeTitle(customPromptNode, esCopy.canvas.nodes), 'Camera Prompt');
  assert.equal(localizeWorkspacePromptText(customPromptNode, esCopy.canvas.nodes), 'Draft camera input...');
});

test('Studio full-connector rejection notices localize connector labels by kind', async () => {
  const { getWorkspaceModelCapabilities } = await import(
    '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-capabilities'
  );
  const { workspaceConnectionRejectionReason } = await import(
    '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-graph-helpers'
  );
  const { createStarterWorkspaceTemplate } = await import(
    '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-templates'
  );
  const frDictionary = JSON.parse(fs.readFileSync(path.join(root, 'frontend/messages/fr.json'), 'utf8')) as Dictionary;
  const frCopy = resolveStudioCopy(frDictionary).canvas.nodes;
  const template = createStarterWorkspaceTemplate('product-ad');
  const rejection = workspaceConnectionRejectionReason({
    capabilities: getWorkspaceModelCapabilities(),
    connection: {
      source: 'shot-01',
      target: 'output-01',
      sourceHandle: 'generated_output',
      targetHandle: 'generated_output',
    },
    edges: template.edges,
    nodes: template.nodes,
  });

  assert.equal(rejection?.code, 'connector_full');
  assert.equal(rejection?.connectorKind, 'generated_output');
  assert.equal(localizeStudioEdgeKindLabel(rejection?.connectorKind ?? 'reference', frCopy), frCopy.edgeGeneratedOutput);

  const graphActionsSource = fs.readFileSync(
    path.join(root, 'frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceGraphActions.ts'),
    'utf8'
  );
  assert.match(graphActionsSource, /localizeStudioEdgeKindLabel\(reason\.connectorKind, studioCanvasNodeCopy\)/);
  assert.doesNotMatch(graphActionsSource, /fullConnectorMatch/);
});

test('Studio timeline split clears generated title provenance on suffixed right clips', async () => {
  const { createStarterWorkspaceTemplate } = await import(
    '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-templates'
  );
  const { splitWorkspaceTimelineItem } = await import(
    '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-timeline-editing'
  );
  const frDictionary = JSON.parse(fs.readFileSync(path.join(root, 'frontend/messages/fr.json'), 'utf8')) as Dictionary;
  const frCopy = resolveStudioCopy(frDictionary).canvas.nodes;
  const template = createStarterWorkspaceTemplate('product-ad');
  const splitItems = splitWorkspaceTimelineItem(template.timelineItems, 'timeline-output-02', 3);
  const leftClip = splitItems.find((item) => item.id === 'timeline-output-02');
  const rightClip = splitItems.find((item) => item.id === 'timeline-output-02-split');

  assert.equal(leftClip ? localizeWorkspaceTimelineItemTitle(leftClip, frCopy) : '', `${shotName(frCopy, '02')} - ${frCopy.templateMacroDetails}`);
  assert.equal(rightClip?.title, 'Shot 02 - Macro Details B');
  assert.equal(rightClip?.generatedCopy, undefined);
  assert.equal(rightClip ? localizeWorkspaceTimelineItemTitle(rightClip, frCopy) : '', 'Shot 02 - Macro Details B');
});

test('Studio timeline track labels and context menu kinds use active localized copy', () => {
  const frDictionary = JSON.parse(fs.readFileSync(path.join(root, 'frontend/messages/fr.json'), 'utf8')) as Dictionary;
  const esDictionary = JSON.parse(fs.readFileSync(path.join(root, 'frontend/messages/es.json'), 'utf8')) as Dictionary;
  const frCopy = resolveStudioCopy(frDictionary).canvas.nodes;
  const esCopy = resolveStudioCopy(esDictionary).canvas.nodes;

  assert.equal(localizeWorkspaceTimelineTrackKindLabel('video', frCopy), frCopy.video);
  assert.equal(localizeWorkspaceTimelineTrackKindLabel('audio', esCopy), esCopy.audio ?? 'Audio');
  assert.equal(localizeWorkspaceTimelineTrackLabel('video-2', frCopy), `${frCopy.video} 2`);
  assert.equal(localizeWorkspaceTimelineTrackLabel('audio-3', esCopy), `${esCopy.audio ?? 'Audio'} 3`);
  assert.equal(localizeWorkspaceTimelineTrackNoticeLabel('audio-2', frCopy), `${frCopy.audio ?? 'Audio'} 2`);

  const inspectorSource = fs.readFileSync(
    path.join(root, 'frontend/app/(core)/(workspace)/app/studio/workspace/_components/TimelineClipInspector.tsx'),
    'utf8'
  );
  assert.match(inspectorSource, /localizeWorkspaceTimelineTrackLabel\(selectedItem\.track, canvasNodeCopy\)/);
  assert.doesNotMatch(inspectorSource, /workspaceTimelineTrackLabel\(selectedItem\.track\)/);

  const trackActionsSource = fs.readFileSync(
    path.join(root, 'frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceTimelineTrackActions.ts'),
    'utf8'
  );
  assert.match(trackActionsSource, /studioCanvasNodeCopy: StudioCopy\['canvas'\]\['nodes'\]/);
  assert.match(trackActionsSource, /localizeWorkspaceTimelineTrackLabel\(track, studioCanvasNodeCopy\)/);
  assert.doesNotMatch(trackActionsSource, /workspaceTimelineTrackLabel\(track\)/);

  const contextMenuSource = fs.readFileSync(
    path.join(root, 'frontend/app/(core)/(workspace)/app/studio/workspace/_components/timeline/TimelineContextMenus.tsx'),
    'utf8'
  );
  assert.match(contextMenuSource, /canvasNodeCopy: StudioCopy\['canvas'\]\['nodes'\]/);
  assert.match(contextMenuSource, /localizeWorkspaceTimelineTrackLabel\(trackMenu\.trackId, canvasNodeCopy\)/);
  assert.match(contextMenuSource, /localizeWorkspaceTimelineTrackKindLabel\(trackMenu\.kind, canvasNodeCopy\)/);
  assert.doesNotMatch(contextMenuSource, /replace\('\{kind\}', trackMenu\.kind\)/);

  const timelineSource = fs.readFileSync(
    path.join(root, 'frontend/app/(core)/(workspace)/app/studio/workspace/_components/WorkspaceTimeline.tsx'),
    'utf8'
  );
  assert.match(timelineSource, /<TimelineContextMenus[\s\S]*canvasNodeCopy=\{canvasNodeCopy\}/);
});

test('Studio starter template optional copy localizes generated raw fields while preserving provenance', async () => {
  const { createStarterWorkspaceTemplate } = await import(
    '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-templates'
  );
  const frDictionary = JSON.parse(fs.readFileSync(path.join(root, 'frontend/messages/fr.json'), 'utf8')) as Dictionary;
  const esDictionary = JSON.parse(fs.readFileSync(path.join(root, 'frontend/messages/es.json'), 'utf8')) as Dictionary;
  const frCopy = resolveStudioCopy(frDictionary).canvas.nodes;
  const esCopy = resolveStudioCopy(esDictionary).canvas.nodes;
  const localizedTemplate = createStarterWorkspaceTemplate('product-ad', frCopy);
  const promptNode = localizedTemplate.nodes.find((node) => node.id === 'prompt-camera');
  const heroShot = localizedTemplate.nodes.find((node) => node.id === 'shot-01');
  const firstTimelineClip = localizedTemplate.timelineItems.find((item) => item.id === 'timeline-output-01');
  assert.ok(promptNode, 'localized template should include prompt-camera');
  assert.ok(heroShot?.data.shot, 'localized template should include shot-01');
  assert.ok(firstTimelineClip, 'localized template should include timeline-output-01');

  assert.equal(promptNode.data.title, frCopy.templateCameraMovement);
  assert.equal(promptNode.data.promptText, frCopy.templateProductAdCameraPromptText);
  assert.equal(heroShot.data.shot.outputName, frCopy.templateHeroReveal);
  assert.equal(firstTimelineClip.title, `${shotName(frCopy, '01')} - ${frCopy.templateHeroReveal}`);
  assert.equal(promptNode.data.generatedCopy?.promptText?.key, 'templateProductAdCameraPromptText');
  assert.equal(heroShot.data.generatedCopy?.shotOutputName?.key, 'templateHeroReveal');
  assert.equal(firstTimelineClip.generatedCopy?.title?.value, 'Shot 01 - Hero Reveal');
  assert.equal(localizeWorkspacePromptText(promptNode, esCopy), esCopy.templateProductAdCameraPromptText);
  assert.equal(localizeWorkspaceShotOutputName(heroShot, esCopy), esCopy.templateHeroReveal);
  assert.equal(localizeWorkspaceTimelineItemTitle(firstTimelineClip, esCopy), `${shotName(esCopy, '01')} - ${esCopy.templateHeroReveal}`);

  const canonicalTemplate = createStarterWorkspaceTemplate('product-ad');
  assert.equal(canonicalTemplate.nodes.find((node) => node.id === 'prompt-camera')?.data.title, 'Camera Movement');
  assert.equal(canonicalTemplate.timelineItems.find((item) => item.id === 'timeline-output-01')?.title, 'Shot 01 - Hero Reveal');
});

test('Studio starter templates render localized generated text across templates and locales', async () => {
  const { createStarterWorkspaceTemplate } = await import(
    '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-templates'
  );

  for (const locale of ['fr', 'es'] as const) {
    const dictionary = JSON.parse(fs.readFileSync(path.join(root, `frontend/messages/${locale}.json`), 'utf8')) as Dictionary;
    const copy = resolveStudioCopy(dictionary).canvas.nodes;

    for (const expectation of templateLocalizationExpectations) {
      const template = createStarterWorkspaceTemplate(expectation.id);
      const localizedTexts = localizedTemplateTextValues(template, copy);

      expectation.expected(copy).forEach((expectedValue) => {
        assert.equal(typeof expectedValue, 'string', `${expectation.id} ${locale} expected copy key should resolve`);
        assert.ok(expectedValue.trim().length > 0, `${expectation.id} ${locale} expected copy should not be empty`);
        assert.ok(
          localizedTexts.includes(expectedValue),
          `${expectation.id} ${locale} should render localized "${expectedValue}"`
        );
      });

      expectation.bannedEnglish.forEach((englishValue) => {
        assert.ok(
          !localizedTexts.includes(englishValue),
          `${expectation.id} ${locale} should not render English seed "${englishValue}"`
        );
      });
    }
  }
});

test('Studio generation payload preparation relocalizes template prompt and output state without changing custom text', async () => {
  const { createStarterWorkspaceTemplate } = await import(
    '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-templates'
  );
  const { prepareWorkspaceShotGenerationInputs } = await import(
    '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-generation'
  );
  const frDictionary = JSON.parse(fs.readFileSync(path.join(root, 'frontend/messages/fr.json'), 'utf8')) as Dictionary;
  const esDictionary = JSON.parse(fs.readFileSync(path.join(root, 'frontend/messages/es.json'), 'utf8')) as Dictionary;
  const frCopy = resolveStudioCopy(frDictionary).canvas.nodes;
  const esCopy = resolveStudioCopy(esDictionary).canvas.nodes;
  const template = createStarterWorkspaceTemplate('product-ad', frCopy);
  const heroShot = template.nodes.find((node) => node.id === 'shot-01');
  assert.ok(heroShot?.data.shot, 'Product Ad template should include shot-01 settings');

  const localizedInputs = prepareWorkspaceShotGenerationInputs({
    canvasNodeCopy: esCopy,
    edges: template.edges,
    nodes: template.nodes,
    settings: heroShot.data.shot,
    shotNode: heroShot,
  });

  assert.equal(localizedInputs.outputName, esCopy.templateHeroReveal);
  assert.ok(localizedInputs.prompt.includes(esCopy.templateProductAdCameraPromptText));
  assert.ok(!localizedInputs.prompt.includes(frCopy.templateProductAdCameraPromptText));

  const customPrompt = 'Café Lumière handheld pass';
  const customOutput = 'Café Lumière';
  const customNodes = template.nodes.map((node) => {
    if (node.id === 'prompt-camera') {
      return {
        ...node,
        data: {
          ...node.data,
          generatedCopy: {
            ...node.data.generatedCopy,
            promptText: undefined,
          },
          promptText: customPrompt,
        },
      };
    }
    if (node.id === 'shot-01' && node.data.shot) {
      return {
        ...node,
        data: {
          ...node.data,
          generatedCopy: {
            ...node.data.generatedCopy,
            shotOutputName: undefined,
          },
          shot: {
            ...node.data.shot,
            outputName: customOutput,
          },
        },
      };
    }
    return node;
  });
  const customShot = customNodes.find((node) => node.id === 'shot-01');
  assert.ok(customShot?.data.shot, 'custom shot should keep shot settings');
  const customInputs = prepareWorkspaceShotGenerationInputs({
    canvasNodeCopy: esCopy,
    edges: template.edges,
    nodes: customNodes,
    settings: customShot.data.shot,
    shotNode: customShot,
  });

  assert.equal(customInputs.outputName, customOutput);
  assert.equal(customInputs.prompt, customPrompt);
});

test('Studio generation payload preparation preserves custom exact-match prompt and output text', async () => {
  const { createStarterWorkspaceTemplate } = await import(
    '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-templates'
  );
  const { prepareWorkspaceShotGenerationInputs } = await import(
    '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-generation'
  );
  const esDictionary = JSON.parse(fs.readFileSync(path.join(root, 'frontend/messages/es.json'), 'utf8')) as Dictionary;
  const esCopy = resolveStudioCopy(esDictionary).canvas.nodes;
  const template = createStarterWorkspaceTemplate('product-ad');
  const starterPrompt = 'Smooth cinematic orbit around product, slow push in, premium macro lighting.';
  const customOutput = 'Final Frame';
  const customNodes = template.nodes.map((node): WorkspaceGraphNode => {
    if (node.id === 'prompt-camera') {
      return {
        ...node,
        data: {
          ...node.data,
          generatedCopy: {
            ...node.data.generatedCopy,
            promptText: undefined,
          },
          promptText: starterPrompt,
        },
      };
    }
    if (node.id === 'shot-01' && node.data.shot) {
      return {
        ...node,
        data: {
          ...node.data,
          generatedCopy: {
            ...node.data.generatedCopy,
            shotOutputName: undefined,
          },
          shot: {
            ...node.data.shot,
            outputName: customOutput,
          },
        },
      };
    }
    return node;
  });
  const customShot = customNodes.find((node) => node.id === 'shot-01');
  assert.ok(customShot?.data.shot, 'custom shot should keep shot settings');

  const customInputs = prepareWorkspaceShotGenerationInputs({
    canvasNodeCopy: esCopy,
    edges: template.edges,
    nodes: customNodes,
    settings: customShot.data.shot,
    shotNode: customShot,
  });

  assert.equal(customInputs.prompt, starterPrompt);
  assert.equal(customInputs.outputName, customOutput);
  assert.ok(!customInputs.prompt.includes(esCopy.templateProductAdCameraPromptText));
});

test('Studio generated clip project-media labels use localized generated display titles', async () => {
  const { createStarterWorkspaceTemplate } = await import(
    '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-templates'
  );
  const { generatedClipProjectMediaTitle } = await import(
    '../frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceProjectMediaActions'
  );
  const frDictionary = JSON.parse(fs.readFileSync(path.join(root, 'frontend/messages/fr.json'), 'utf8')) as Dictionary;
  const frCopy = resolveStudioCopy(frDictionary).canvas.nodes;
  const template = createStarterWorkspaceTemplate('product-ad');
  const outputNode = template.nodes.find((node) => node.id === 'output-01');
  assert.ok(outputNode, 'product template should include output-01');

  assert.equal(generatedClipProjectMediaTitle(outputNode, frCopy), outputName(frCopy, '01'));

  const customOutputNode: WorkspaceGraphNode = {
    ...outputNode,
    data: {
      ...outputNode.data,
      generatedCopy: undefined,
      title: 'Output 01',
    },
  };
  assert.equal(generatedClipProjectMediaTitle(customOutputNode, frCopy), 'Output 01');

  const source = fs.readFileSync(
    path.join(root, 'frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceProjectMediaActions.ts'),
    'utf8'
  );
  assert.match(source, /studioCanvasNodeCopy: StudioCopy\['canvas'\]\['nodes'\]/);
  assert.match(source, /generatedClipProjectMediaTitle\(node, studioCanvasNodeCopy\)/);
  assert.match(source, /generatedClipProjectMediaTitle\(nodesToDelete\[0\], studioCanvasNodeCopy\)/);
});

test('Studio project media timeline and drag-preview labels use active localized copy', async () => {
  const { resolveProjectAssetTimelineInsert } = await import(
    '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-project-media-timeline'
  );
  const { projectMediaDragKindLabel } = await import(
    '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-project-media-drag'
  );
  const frDictionary = JSON.parse(fs.readFileSync(path.join(root, 'frontend/messages/fr.json'), 'utf8')) as Dictionary;
  const esDictionary = JSON.parse(fs.readFileSync(path.join(root, 'frontend/messages/es.json'), 'utf8')) as Dictionary;
  const frCopy = resolveStudioCopy(frDictionary).canvas.nodes;
  const esCopy = resolveStudioCopy(esDictionary).canvas.nodes;
  const imageAsset: WorkspaceAssetRecord = {
    id: 'image-asset',
    kind: 'image',
    filename: 'Hero_Frame.png',
    subtitle: 'Image · 2048x2048',
    url: '/media/hero-frame.png',
    thumbUrl: '/media/hero-frame.png',
    durationSec: 5,
    dimensions: '2048x2048',
  };
  const videoAsset: WorkspaceAssetRecord = {
    id: 'video-asset',
    kind: 'video',
    filename: 'Launch_Film.mp4',
    subtitle: 'Video · 5s',
    url: '/media/launch-film.mp4',
    thumbUrl: '/media/launch-film.jpg',
    durationSec: 5,
    dimensions: '3840x2160',
  };

  const dropped = resolveProjectAssetTimelineInsert({
    allowInsertIntoClip: false,
    assetId: imageAsset.id,
    canvasNodeCopy: frCopy,
    currentItems: [],
    idSeed: 'localized',
    lockedTimelineTracks: [],
    projectAssets: [imageAsset],
    startSec: 3,
    targetTrack: 'video-2',
  });
  assert.equal(dropped.ok, true);
  assert.match(dropped.notice, new RegExp(`${frCopy.video} 2`));
  assert.doesNotMatch(dropped.notice, /video-2|Audio 1/);

  const incompatible = resolveProjectAssetTimelineInsert({
    allowInsertIntoClip: false,
    assetId: videoAsset.id,
    canvasNodeCopy: esCopy,
    currentItems: [],
    idSeed: 'localized',
    lockedTimelineTracks: [],
    projectAssets: [videoAsset],
    startSec: 0,
    targetTrack: 'audio-2',
  });
  assert.equal(incompatible.ok, false);
  assert.match(incompatible.notice, new RegExp(`${esCopy.audio ?? 'Audio'} 2`));
  assert.doesNotMatch(incompatible.notice, /audio-2/);

  assert.equal(projectMediaDragKindLabel('audio', frCopy), frCopy.audio ?? 'Audio');
  assert.equal(projectMediaDragKindLabel('image', esCopy), esCopy.image);
  assert.equal(projectMediaDragKindLabel('video', frCopy), frCopy.video);

  const dragSource = fs.readFileSync(
    path.join(root, 'frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-project-media-drag.ts'),
    'utf8'
  );
  assert.match(dragSource, /projectMediaDragKindLabel\(payload\.mediaKind, canvasNodeCopy\)/);
  assert.doesNotMatch(dragSource, /return 'Audio'/);

  const timelineSource = fs.readFileSync(
    path.join(root, 'frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-project-media-timeline.ts'),
    'utf8'
  );
  assert.match(timelineSource, /localizeWorkspaceTimelineTrackNoticeLabel\([^,]+, canvasNodeCopy\)/);
  assert.doesNotMatch(timelineSource, /track: params\.targetTrack/);
  assert.doesNotMatch(timelineSource, /track: resolvedTargetTrack/);

  const sidebarSource = fs.readFileSync(
    path.join(root, 'frontend/app/(core)/(workspace)/app/studio/workspace/_components/TimelineProjectSidebar.tsx'),
    'utf8'
  );
  assert.match(sidebarSource, /studioCanvasNodeCopy,/);
  const layoutSource = fs.readFileSync(
    path.join(root, 'frontend/app/(core)/(workspace)/app/studio/workspace/_components/WorkspaceEditorLayout.tsx'),
    'utf8'
  );
  assert.match(layoutSource, /studioCanvasNodeCopy=\{studioCopy\.canvas\.nodes\}/);
});

test('Studio export preflight issues localize generated timeline clip titles', async () => {
  const { createStarterWorkspaceTemplate } = await import(
    '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-templates'
  );
  const { buildWorkspaceTimelineRenderManifest } = await import(
    '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-timeline-render'
  );
  const frDictionary = JSON.parse(fs.readFileSync(path.join(root, 'frontend/messages/fr.json'), 'utf8')) as Dictionary;
  const frCopy = resolveStudioCopy(frDictionary).canvas.nodes;
  const template = createStarterWorkspaceTemplate('product-ad');
  const firstClip = template.timelineItems.find((item) => item.id === 'timeline-output-01');
  assert.ok(firstClip, 'product template should include timeline-output-01');
  const processingNodes = template.nodes.map((node) => (
    node.id === 'output-01' && node.data.output
      ? {
          ...node,
          data: {
            ...node.data,
            output: {
              ...node.data.output,
              status: 'processing' as const,
              url: null,
              thumbUrl: null,
            },
          },
        }
      : node
  ));

  const manifest = buildWorkspaceTimelineRenderManifest({
    canvasNodeCopy: frCopy,
    createdAt: '2026-06-12T10:00:00.000Z',
    items: [firstClip],
    nodes: processingNodes,
    projectName: 'Product Ad',
  });
  const issueMessage = manifest.issues.find((issue) => issue.itemId === firstClip.id)?.message ?? '';
  const localizedClipTitle = `${shotName(frCopy, '01')} - ${frCopy.templateHeroReveal}`;

  assert.match(issueMessage, new RegExp(localizedClipTitle));
  assert.doesNotMatch(issueMessage, /Shot 01 - Hero Reveal/);

  const exportStateSource = fs.readFileSync(
    path.join(root, 'frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceExportState.ts'),
    'utf8'
  );
  assert.match(exportStateSource, /canvasNodeCopy: studioCanvasNodeCopy/);
});

test('Studio export manifests and EDL use localized generated timeline clip titles', async () => {
  const { createStarterWorkspaceTemplate } = await import(
    '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-templates'
  );
  const { buildWorkspaceTimelineRenderManifest } = await import(
    '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-timeline-render'
  );
  const { buildWorkspaceTimelineEdl } = await import(
    '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-timeline-export'
  );
  const frDictionary = JSON.parse(fs.readFileSync(path.join(root, 'frontend/messages/fr.json'), 'utf8')) as Dictionary;
  const frCopy = resolveStudioCopy(frDictionary).canvas.nodes;
  const template = createStarterWorkspaceTemplate('product-ad');
  const firstClip = template.timelineItems.find((item) => item.id === 'timeline-output-01');
  assert.ok(firstClip, 'product template should include timeline-output-01');
  const readyNodes = template.nodes.map((node) => (
    node.id === 'output-01' && node.data.output
      ? {
          ...node,
          data: {
            ...node.data,
            output: {
              ...node.data.output,
              status: 'ready' as const,
              url: '/media/render-output-01.mp4',
              thumbUrl: '/media/render-output-01.jpg',
            },
          },
        }
      : node
  ));

  const manifest = buildWorkspaceTimelineRenderManifest({
    canvasNodeCopy: frCopy,
    createdAt: '2026-06-12T10:00:00.000Z',
    items: [firstClip],
    nodes: readyNodes,
    projectName: 'Product Ad',
  });
  const clipTitle = manifest.tracks.flatMap((track) => track.clips).find((clip) => clip.id === firstClip.id)?.title;
  const localizedClipTitle = `${shotName(frCopy, '01')} - ${frCopy.templateHeroReveal}`;

  assert.equal(clipTitle, localizedClipTitle);
  assert.notEqual(clipTitle, 'Shot 01 - Hero Reveal');

  const edl = buildWorkspaceTimelineEdl(manifest);
  assert.match(edl, new RegExp(`\\* FROM CLIP: ${localizedClipTitle}`));
  assert.doesNotMatch(edl, /\* FROM CLIP: Shot 01 - Hero Reveal/);
});

test('Studio export manifests and payloads localize generated sequence names', async () => {
  const { createStarterWorkspaceTemplate } = await import(
    '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-templates'
  );
  const { buildWorkspaceTimelineRenderManifest } = await import(
    '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-timeline-render'
  );
  const { buildWorkspaceTimelineVideoExportRequest } = await import(
    '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-timeline-export'
  );
  const frDictionary = JSON.parse(fs.readFileSync(path.join(root, 'frontend/messages/fr.json'), 'utf8')) as Dictionary;
  const frCopy = resolveStudioCopy(frDictionary);
  const template = createStarterWorkspaceTemplate('product-ad');
  const firstClip = template.timelineItems.find((item) => item.id === 'timeline-output-01');
  assert.ok(firstClip, 'product template should include timeline-output-01');
  const readyNodes = template.nodes.map((node) => (
    node.id === 'output-01' && node.data.output
      ? {
          ...node,
          data: {
            ...node.data,
            output: {
              ...node.data.output,
              status: 'ready' as const,
              url: '/media/render-output-01.mp4',
              thumbUrl: '/media/render-output-01.jpg',
            },
          },
        }
      : node
  ));

  const manifest = buildWorkspaceTimelineRenderManifest({
    canvasNodeCopy: frCopy.canvas.nodes,
    createdAt: '2026-06-12T10:00:00.000Z',
    items: [firstClip],
    nodes: readyNodes,
    projectMediaCopy: frCopy.viewer.projectMedia,
    projectName: 'Product Ad',
    sequenceName: 'Main sequence',
  });
  const request = buildWorkspaceTimelineVideoExportRequest(manifest, {
    createdAt: '2026-06-12T10:00:00.000Z',
    idempotencyKey: 'export-localized-sequence',
  });

  assert.equal(manifest.sequenceName, frCopy.viewer.projectMedia.mainSequenceName);
  assert.equal(request.manifest.sequenceName, frCopy.viewer.projectMedia.mainSequenceName);
  assert.notEqual(request.manifest.sequenceName, 'Main sequence');

  const exportStateSource = fs.readFileSync(
    path.join(root, 'frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceExportState.ts'),
    'utf8'
  );
  assert.match(exportStateSource, /studioProjectMediaCopy: StudioCopy\['viewer'\]\['projectMedia'\]/);
  assert.match(exportStateSource, /projectMediaCopy: studioProjectMediaCopy/);
});

test('Studio export overlap issues localize sentence and track labels', async () => {
  const { createStarterWorkspaceTemplate } = await import(
    '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-templates'
  );
  const { buildWorkspaceTimelineRenderManifest } = await import(
    '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-timeline-render'
  );
  const frDictionary = JSON.parse(fs.readFileSync(path.join(root, 'frontend/messages/fr.json'), 'utf8')) as Dictionary;
  const frCopy = resolveStudioCopy(frDictionary);
  const template = createStarterWorkspaceTemplate('product-ad');
  const firstClip = template.timelineItems.find((item) => item.id === 'timeline-output-01');
  const secondClip = template.timelineItems.find((item) => item.id === 'timeline-output-02');
  assert.ok(firstClip, 'product template should include timeline-output-01');
  assert.ok(secondClip, 'product template should include timeline-output-02');
  const readyNodes = template.nodes.map((node) => (
    (node.id === 'output-01' || node.id === 'output-02') && node.data.output
      ? {
          ...node,
          data: {
            ...node.data,
            output: {
              ...node.data.output,
              status: 'ready' as const,
              url: `/media/${node.id}.mp4`,
              thumbUrl: `/media/${node.id}.jpg`,
            },
          },
        }
      : node
  ));
  const overlappingSecondClip = {
    ...secondClip,
    startSec: firstClip.startSec + 1,
  };

  const manifest = buildWorkspaceTimelineRenderManifest({
    canvasNodeCopy: frCopy.canvas.nodes,
    createdAt: '2026-06-12T10:00:00.000Z',
    exportDialogCopy: frCopy.exportDialog,
    items: [firstClip, overlappingSecondClip],
    nodes: readyNodes,
    projectName: 'Product Ad',
  });
  const issueMessage = manifest.issues.find((issue) => issue.code === 'overlapping_clips')?.message ?? '';

  assert.match(issueMessage, new RegExp(`${shotName(frCopy.canvas.nodes, '02')} - ${frCopy.canvas.nodes.templateMacroDetails}`));
  assert.match(issueMessage, new RegExp(`${shotName(frCopy.canvas.nodes, '01')} - ${frCopy.canvas.nodes.templateHeroReveal}`));
  assert.match(issueMessage, new RegExp(`${frCopy.canvas.nodes.video} 1`));
  assert.doesNotMatch(issueMessage, /\boverlaps\b/i);
  assert.doesNotMatch(issueMessage, /\bvideo track\b/i);
});

test('Studio timeline external drop previews localize displaced starter clip titles', async () => {
  const { createStarterWorkspaceTemplate } = await import(
    '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-templates'
  );
  const { resolveTimelineExternalDropPreview } = await import(
    '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/timeline/timeline-external-drop'
  );
  const frDictionary = JSON.parse(fs.readFileSync(path.join(root, 'frontend/messages/fr.json'), 'utf8')) as Dictionary;
  const frCopy = resolveStudioCopy(frDictionary).canvas.nodes;
  const template = createStarterWorkspaceTemplate('product-ad');

  const preview = resolveTimelineExternalDropPreview({
    canvasNodeCopy: frCopy,
    isInsertIntoClipEnabled: false,
    items: template.timelineItems,
    lockedTracks: new Set(),
    payload: { nodeId: 'incoming-output', mediaKind: 'video', durationSec: 5, title: 'Incoming clip' },
    rawStartSec: 5,
    track: 'video',
  });
  const displacedTitles = preview?.displacedItems.map((item) => item.title) ?? [];

  assert.ok(displacedTitles.includes(`${shotName(frCopy, '02')} - ${frCopy.templateMacroDetails}`));
  assert.ok(displacedTitles.includes(shotAudioName(frCopy, `${shotName(frCopy, '02')} - ${frCopy.templateMacroDetails}`)));
  assert.ok(!displacedTitles.includes('Shot 02 - Macro Details'));
  assert.ok(!displacedTitles.includes('Shot 02 - Macro Details Audio'));

  const customPreview = resolveTimelineExternalDropPreview({
    canvasNodeCopy: frCopy,
    isInsertIntoClipEnabled: false,
    items: [{
      id: 'custom-final-frame',
      outputNodeId: 'custom-output',
      track: 'video',
      title: 'Final Frame',
      durationSec: 5,
      startSec: 0,
      mediaKind: 'video',
    }],
    lockedTracks: new Set(),
    payload: { nodeId: 'incoming-output', mediaKind: 'video', durationSec: 5, title: 'Incoming clip' },
    rawStartSec: 0,
    track: 'video',
  });

  assert.deepEqual(
    customPreview?.displacedItems.map((item) => item.title),
    ['Final Frame']
  );
});

test('Studio timeline inserted tail clip labels relocalize generated tails and preserve custom tails', async () => {
  const { insertWorkspaceTimelineItems } = await import(
    '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-timeline-editing'
  );
  const frDictionary = JSON.parse(fs.readFileSync(path.join(root, 'frontend/messages/fr.json'), 'utf8')) as Dictionary;
  const frCopy = resolveStudioCopy(frDictionary).canvas.nodes;

  const sourceItem: WorkspaceTimelineItem = {
    id: 'shot-02',
    outputNodeId: 'output-02',
    track: 'video',
    title: 'Shot 02 - Macro Details',
    generatedCopy: {
      title: {
        value: 'Shot 02 - Macro Details',
      },
    },
    durationSec: 8,
    startSec: 0,
    mediaKind: 'video',
  };
  const insertedItems = insertWorkspaceTimelineItems({
    allowInsertIntoClip: true,
    idSeed: 'localization',
    items: [sourceItem],
    mode: 'insert',
    newItems: [{
      id: 'incoming',
      outputNodeId: 'incoming-output',
      track: 'video',
      title: 'Incoming clip',
      durationSec: 2,
      startSec: 4,
      mediaKind: 'video',
    }],
    playheadSec: 4,
  });
  const generatedTail = insertedItems.find((item) => item.id === 'shot-02-tail-localization');

  assert.equal(generatedTail?.title, 'Shot 02 - Macro Details Tail');
  assert.equal(generatedTail?.generatedCopy?.title?.value, 'Shot 02 - Macro Details Tail');
  assert.equal(
    generatedTail ? localizeWorkspaceTimelineItemTitle(generatedTail, frCopy) : '',
    formatCopyValue(frCopy.templateTimelineTailPreviewName, {
      name: `${shotName(frCopy, '02')} - ${frCopy.templateMacroDetails}`,
    })
  );

  const customSourceItem: WorkspaceTimelineItem = {
    ...sourceItem,
    id: 'custom-shot',
    title: 'Final Frame',
    generatedCopy: undefined,
  };
  const customInsertedItems = insertWorkspaceTimelineItems({
    allowInsertIntoClip: true,
    idSeed: 'custom',
    items: [customSourceItem],
    mode: 'insert',
    newItems: [{
      id: 'incoming-custom',
      outputNodeId: 'incoming-custom-output',
      track: 'video',
      title: 'Incoming clip',
      durationSec: 2,
      startSec: 4,
      mediaKind: 'video',
    }],
    playheadSec: 4,
  });
  const customTail = customInsertedItems.find((item) => item.id === 'custom-shot-tail-custom');

  assert.equal(customTail?.title, 'Final Frame Tail');
  assert.equal(customTail?.generatedCopy, undefined);
  assert.equal(customTail ? localizeWorkspaceTimelineItemTitle(customTail, frCopy) : '', 'Final Frame Tail');
});

test('Studio connection label surfaces route generated edge labels through localized copy', () => {
  const frDictionary = JSON.parse(fs.readFileSync(path.join(root, 'frontend/messages/fr.json'), 'utf8')) as Dictionary;
  const frCopy = resolveStudioCopy(frDictionary).canvas.nodes;
  assert.equal(localizeStudioEdgeKindLabel('prompt', frCopy), frCopy.edgePrompt);
  assert.equal(localizeStudioEdgeKindLabel('camera', frCopy), frCopy.edgeCamera);
  assert.equal(localizeStudioEdgeKindLabel('reference', frCopy), frCopy.edgeReference);
  assert.equal(localizeStudioEdgeKindLabel('generated_output', frCopy), frCopy.edgeGeneratedOutput);

  const sourceChecks = [
    {
      relativePath: 'frontend/app/(core)/(workspace)/app/studio/workspace/_components/NodeInspectorConnections.tsx',
      localizedPattern: /localizeStudioEdgeKindLabel\(edge\.data\?\.kind \?\? 'reference', copy\)/,
      rawPattern: /<p>\{edgeLabel\(/,
    },
    {
      relativePath: 'frontend/app/(core)/(workspace)/app/studio/workspace/_components/NodeSettingsPanel.tsx',
      localizedPattern: /return localizeStudioEdgeKindLabel\(role, copy\)/,
      rawPattern: /return edgeLabel\(role\)/,
    },
    {
      relativePath: 'frontend/app/(core)/(workspace)/app/studio/workspace/_components/nodes/workspace-node-frame.tsx',
      localizedPattern: /localizeStudioEdgeKindLabel\(handle, labelCopy\)/,
      rawPattern: /edgeLabel\(handle\)/,
    },
  ];

  sourceChecks.forEach(({ relativePath, localizedPattern, rawPattern }) => {
    const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
    assert.match(source, localizedPattern, `${relativePath} should localize generated edge labels`);
    assert.doesNotMatch(source, rawPattern, `${relativePath} should not render raw edge labels`);
  });
});

test('Studio starter template apply notices use localized template summary names', () => {
  const source = fs.readFileSync(
    path.join(root, 'frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceCanvasTemplateActions.ts'),
    'utf8'
  );

  assert.match(source, /studioCanvasCopy: StudioCopy\['canvas'\]/);
  assert.match(source, /templateSummariesCopy\[templateId\]/);
  assert.match(source, /starterTemplateNoticeName\(template\.id, template\.name, studioCanvasCopy\.templateSummaries\)/);
  assert.doesNotMatch(
    source,
    /createStarterWorkspaceTemplate\(templateId\)[\s\S]{0,700}canvasTemplateApplied, \{ name: template\.name \}/
  );
});

test('Studio source files do not keep legacy English UI copy outside the copy owner', () => {
  const bannedFiles = [
    'frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceProjectMediaActions.ts',
    'frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceSequenceActions.ts',
    'frontend/app/(core)/(workspace)/app/studio/workspace/_components/NodeLibrarySidebar.tsx',
  ];

  const bannedPatterns = [
    /media assets?/,
    /generated clips?/,
    /\bfolders?\b/,
    /\bBlock templates\b/,
    /\bCanvas templates\b/,
    /\bTemplate name\b/,
    /\bNo saved canvas templates yet\b/,
  ];

  bannedFiles.forEach((relativePath) => {
    const absolutePath = path.join(root, relativePath);
    if (!fs.existsSync(absolutePath)) return;
    const source = fs.readFileSync(absolutePath, 'utf8');
    bannedPatterns.forEach((pattern) => {
      assert.doesNotMatch(source, pattern, `${relativePath} should route visible copy through studio-copy.ts`);
    });
  });
});
