import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import type {Dictionary} from '../frontend/lib/i18n/types';
import {DEFAULT_STUDIO_COPY,formatStudioProjectDate,localizeStudioGeneratedCanvasText,resolveStudioCopy} from '../frontend/app/(core)/(workspace)/app/studio/_lib/studio-copy';
import type {WorkspaceGraphNode,WorkspaceTimelineItem} from '../frontend/app/(core)/(workspace)/app/studio/_shared/_lib/workspace-types';
import {localizeWorkspaceTimelineItemTitle} from '../frontend/app/(core)/(workspace)/app/studio/_shared/_lib/workspace-generated-copy';
import {localizeWorkspaceTimelineTrackKindLabel,localizeWorkspaceTimelineTrackLabel,localizeWorkspaceTimelineTrackNoticeLabel} from '../frontend/app/(core)/(workspace)/app/studio/_shared/_lib/workspace-timeline-tracks';
import {workspaceLibrarySourceLabelsFromCopy} from '../frontend/app/(core)/(workspace)/app/studio/_shared/_lib/workspace-library-assets';
const root=process.cwd();
const locales=['en','fr','es'] as const;
function requiredStudioCopyPaths(source: unknown,prefix='workspace.studio'): string[] {
  if(!source||typeof source!=='object'||Array.isArray(source))return [];
  return Object.entries(source as Record<string,unknown>).flatMap(([key,value])=>{
    const keyPath=prefix+'.'+key;
    return value&&typeof value==='object'&&!Array.isArray(value)?requiredStudioCopyPaths(value,keyPath):[keyPath];
  });
}
const requiredPaths=requiredStudioCopyPaths(DEFAULT_STUDIO_COPY);
function readPath(source: unknown,keyPath: string): unknown {
  return keyPath.split('.').reduce<unknown>((current,key)=>current&&typeof current==='object'?(current as Record<string,unknown>)[key]:undefined,source);
}
function formatCopyValue(value: string,replacements: Record<string,string|number>): string {
  return Object.entries(replacements).reduce((current,[key,replacement])=>current.replaceAll('{'+key+'}',String(replacement)),value);
}
function shotName(copy: Record<string,string>,index: string){return formatCopyValue(copy.templateShotName,{index});}
function outputName(copy: Record<string,string>,index: string){return formatCopyValue(copy.templateOutputName,{index});}
function shotAudioName(copy: Record<string,string>,name: string){return formatCopyValue(copy.templateShotAudioName,{name});}
/** Authored test data exercises generated provenance without importing removed templates. */
function createLocalizedTimelineFixture(): {nodes: WorkspaceGraphNode[];timelineItems: WorkspaceTimelineItem[]} {
  const facts=[{index:'01',description:'Hero Reveal',startSec:0,durationSec:5},{index:'02',description:'Macro Details',startSec:5,durationSec:6}];
  return {
    nodes:facts.map(({index,durationSec})=>({id:'output-'+index,position:{x:0,y:0},data:{kind:'output',title:'Output '+index,
      output:{kind:'video',modelId:'veo-3-1',modelLabel:'Veo',workflowType:'text_to_video',pricing:null,status:'ready',
        createdAt:'2026-06-12T10:00:00.000Z',sourceShotId:'shot-'+index,url:'/media/output-'+index+'.mp4',thumbUrl:'/media/output-'+index+'.jpg',
        requestedSettings:{durationSec,aspectRatio:'16:9',resolution:'1080p',fps:30,outputCount:1},
        sourceMetadata:{measurementStatus:'measured',durationSec,width:1920,height:1080},
      }}})),
    timelineItems:facts.map(({index,description,startSec,durationSec})=>({
      id:'timeline-output-'+index,outputNodeId:'output-'+index,track:'video',title:'Shot '+index+' - '+description,
      generatedCopy:{title:{value:'Shot '+index+' - '+description}},startSec,durationSec,sourceStartSec:0,sourceDurationSec:durationSec,
      mediaKind:'video',status:'completed',sourceWidth:1920,sourceHeight:1080,
    })),
  };
}

test('Studio localization dictionaries expose required copy in every locale', () => {

  locales.forEach((locale) => {
    const dictionary = JSON.parse(fs.readFileSync(path.join(root, `frontend/messages/${locale}.json`), 'utf8'));
    const studio = dictionary.workspace?.studio;
    assert.ok(studio, `${locale} workspace.studio dictionary should be present`);
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

test('Studio generated copy localization preserves custom exact-match node text without provenance', async () => {
  const { localizeWorkspaceNodeGeneratedText } = await import(
    '../frontend/app/(core)/(workspace)/app/studio/_shared/_lib/workspace-generated-copy'
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
  const frDictionary = JSON.parse(fs.readFileSync(path.join(root, 'frontend/messages/fr.json'), 'utf8')) as Dictionary;
  const frCopy = resolveStudioCopy(frDictionary).canvas.nodes;
  const template = createLocalizedTimelineFixture();
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
    generatedCopy: undefined,
  };
  assert.equal(localizeWorkspaceTimelineItemTitle(editedStarterClip, frCopy), 'Hero Reveal');

});

test('Studio timeline split clears generated title provenance on suffixed right clips', async () => {
  const { splitWorkspaceTimelineItem } = await import(
    '../frontend/app/(core)/(workspace)/app/studio/_shared/_lib/workspace-timeline-editing'
  );
  const frDictionary = JSON.parse(fs.readFileSync(path.join(root, 'frontend/messages/fr.json'), 'utf8')) as Dictionary;
  const frCopy = resolveStudioCopy(frDictionary).canvas.nodes;
  const template = createLocalizedTimelineFixture();
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

});

test('Studio export preflight issues localize generated timeline clip titles', async () => {
  const { buildWorkspaceTimelineRenderManifest } = await import(
    '../frontend/app/(core)/(workspace)/app/studio/_shared/_lib/workspace-timeline-render'
  );
  const frDictionary = JSON.parse(fs.readFileSync(path.join(root, 'frontend/messages/fr.json'), 'utf8')) as Dictionary;
  const frCopy = resolveStudioCopy(frDictionary).canvas.nodes;
  const template = createLocalizedTimelineFixture();
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

});

test('Studio export manifests and EDL use localized generated timeline clip titles', async () => {
  const { buildWorkspaceTimelineRenderManifest } = await import(
    '../frontend/app/(core)/(workspace)/app/studio/_shared/_lib/workspace-timeline-render'
  );
  const { buildWorkspaceTimelineEdl } = await import(
    '../frontend/app/(core)/(workspace)/app/studio/_shared/_lib/workspace-timeline-export'
  );
  const frDictionary = JSON.parse(fs.readFileSync(path.join(root, 'frontend/messages/fr.json'), 'utf8')) as Dictionary;
  const frCopy = resolveStudioCopy(frDictionary).canvas.nodes;
  const template = createLocalizedTimelineFixture();
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
  const { buildWorkspaceTimelineRenderManifest } = await import(
    '../frontend/app/(core)/(workspace)/app/studio/_shared/_lib/workspace-timeline-render'
  );
  const { buildWorkspaceTimelineVideoExportRequest } = await import(
    '../frontend/app/(core)/(workspace)/app/studio/_shared/_lib/workspace-timeline-export'
  );
  const frDictionary = JSON.parse(fs.readFileSync(path.join(root, 'frontend/messages/fr.json'), 'utf8')) as Dictionary;
  const frCopy = resolveStudioCopy(frDictionary);
  const template = createLocalizedTimelineFixture();
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

});

test('Studio export overlap issues localize sentence and track labels', async () => {
  const { buildWorkspaceTimelineRenderManifest } = await import(
    '../frontend/app/(core)/(workspace)/app/studio/_shared/_lib/workspace-timeline-render'
  );
  const frDictionary = JSON.parse(fs.readFileSync(path.join(root, 'frontend/messages/fr.json'), 'utf8')) as Dictionary;
  const frCopy = resolveStudioCopy(frDictionary);
  const template = createLocalizedTimelineFixture();
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

test('Studio timeline inserted tail clip labels relocalize generated tails and preserve custom tails', async () => {
  const { insertWorkspaceTimelineItems } = await import(
    '../frontend/app/(core)/(workspace)/app/studio/_shared/_lib/workspace-timeline-editing'
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
