import { localeRegions, type AppLocale } from '@/i18n/locales';
import type { Dictionary } from '@/lib/i18n/types';

export type StudioCopy = {
  projects: {
    metaTitle: string;
    heroBadge: string;
    title: string;
    subtitle: string;
    createTitle: string;
    createSubtitle: string;
    projectNameLabel: string;
    projectNamePlaceholder: string;
    canvasTemplateLabel: string;
    browseTemplates: string;
    createProject: string;
    creating: string;
    recentTitle: string;
    recentSubtitle: string;
    emptyRecent: string;
    viewAllProjects: string;
    projectActionsAria: string;
    rename: string;
    duplicate: string;
    duplicateSuffix: string;
    delete: string;
    renameTitle: string;
    renameSubmit: string;
    deleteTitle: string;
    deleteBody: string;
    deleteConfirm: string;
    cancel: string;
    closeDialog: string;
    untitledProject: string;
    localDraft: string;
    customCanvas: string;
  };
  topbar: {
    productName: string;
    breadcrumbProjects: string;
    breadcrumbWorkspace: string;
    workspaceViewLabel: string;
    canvas: string;
    viewer: string;
    export: string;
    exportAria: string;
    mock: string;
    live: string;
    mockAria: string;
    switchToLight: string;
    switchToDark: string;
    accountStatus: string;
    walletBalance: string;
    noSession: string;
    loadingSession: string;
    walletTopUpLabel: string;
    walletTopUpCopy: string;
    walletTopUpCta: string;
    signedIn: string;
    primaryNavigation: string;
    admin: string;
    signOut: string;
    navigationLabels: Record<string, string>;
    exitToProjects: string;
    saveAndReturnToProjects: string;
  };
  common: {
    secondsShort: string;
    itemSingular: string;
    itemPlural: string;
    folder: string;
    generatedClip: string;
  };
  canvas: {
    ariaLabel: string;
    toolbar: Record<string, string>;
    templates: Record<string, string>;
    templateSummaries: Record<string, {
      name: string;
      description: string;
      flow: string;
      badge: string;
    }>;
    nodes: Record<string, string>;
    map: Record<string, string>;
  };
  timeline: {
    tools: Record<string, string>;
    tracks: Record<string, string>;
    clips: Record<string, string>;
    inspector: Record<string, string>;
  };
  viewer: {
    controls: Record<string, string>;
    monitor: Record<string, string>;
    projectMedia: Record<string, string>;
  };
  exportDialog: Record<string, string>;
  assetLibrary: Record<string, string>;
  notices: {
    canvasTemplateNotFound: string;
    projectMediaAssetNotFound: string;
    projectMediaFolderNotFound: string;
    generatedClipNotFound: string;
    unlockBeforeMoving: string;
    unlockBeforeCutting: string;
    unlockBeforeTrimming: string;
    unlockBeforeDeleting: string;
    selectedClipsUnlinked: string;
    selectedClipsLinked: string;
    unlockBeforeUnlinking: string;
    unlockBeforeLinking: string;
    inPointSet: string;
    outPointSet: string;
    inOutPointsCleared: string;
    workspaceSavedReturningToProjects: string;
    projectLoadedCleanSequence: string;
    deleteTrackWithClipsConfirm: string;
    deleteTrackConfirm: string;
    timelineTrackDeleted: string;
    sequenceNotFound: string;
    keepAtLeastOneSequence: string;
    sequenceSelected: string;
    sequenceCreated: string;
    deleteSequenceConfirm: string;
    sequenceDeleted: string;
    exportEstimateFailed: string;
    exportReadyDownload: string;
    exportCompleted: string;
    serverExportFailed: string;
    serverExportRendering: string;
    queueingServerExport: string;
    serverExportAlreadyQueued: string;
    serverExportQueued: string;
    serverExportFailedToStart: string;
    exportEdlReady: string;
    projectMediaAdded: string;
    projectMediaRoot: string;
    projectMediaFallbackFolder: string;
    projectMediaImportedInto: string;
    deleteProjectAssetConfirm: string;
    projectAssetRemoved: string;
    deleteGeneratedClipConfirm: string;
    generatedClipRemoved: string;
    generatedOutputSubtitle: string;
    newProjectMediaFolderName: string;
    projectMediaFolderCreated: string;
    deleteProjectMediaFolderConfirm: string;
    projectMediaFolderDeleted: string;
    projectMediaFolderRenamed: string;
    projectAssetMovedToFolder: string;
    generatedClipMovedToFolder: string;
    projectMediaNotPlayable: string;
    unlockTrackBeforeProjectMediaDrop: string;
    projectMediaCannotBePlaced: string;
    projectMediaNotCompatibleWithTrack: string;
    unlockTargetTrackBeforeProjectMediaInsert: string;
    projectMediaInsertNeedsEditPoint: string;
    projectMediaCouldNotBeInserted: string;
    projectMediaDroppedOnTimeline: string;
    projectMediaInsertedAtPlayhead: string;
    completedServerExportSubtitle: string;
    deleteCanvasTemplateConfirm: string;
    canvasTemplateApplied: string;
    defaultCanvasTemplateName: string;
    canvasTemplateSavedAs: string;
    canvasTemplateDuplicateName: string;
    canvasTemplateSaved: string;
    canvasTemplateDeleted: string;
    textPastedIntoPrompt: string;
    sourceAddedToCanvas: string;
    pastedTextFilename: string;
    untitledFile: string;
    couldNotReadTextFile: string;
    fileAttachedToMediaBlock: string;
    fileAddedToCanvas: string;
    localImportSizeLabel: string;
    canvasImportImageLabel: string;
    canvasImportVideoLabel: string;
    canvasImportAudioLabel: string;
    localImageFallbackName: string;
    localVideoFallbackName: string;
    localAudioFallbackName: string;
    localPromptFallbackName: string;
    adHocImageReferenceTitle: string;
    adHocVideoReferenceTitle: string;
    adHocAudioReferenceTitle: string;
    adHocPromptTitle: string;
    adHocNoteTitle: string;
    adHocShotTitle: string;
    noImageSelected: string;
    noVideoSelected: string;
    noAudioSelected: string;
    promptFileSubtitle: string;
    canvasTextSubtitle: string;
    defaultPromptText: string;
    defaultNoteText: string;
    newGenerationBlockSubtitle: string;
    newShotOutputName: string;
    generatedOutputTitle: string;
    generatedOutputBlockSubtitle: string;
    outputProcessingRender: string;
    outputWaitingForMedia: string;
    textPromptSourceSubtitle: string;
    imageSourceBlockSubtitle: string;
    videoSourceBlockSubtitle: string;
    audioSourceBlockSubtitle: string;
    promptNodeTitle: string;
    imageNodeTitle: string;
    videoNodeTitle: string;
    audioNodeTitle: string;
    dragCreatedPromptSubtitle: string;
    draftHandlePromptText: string;
    readyForGeneratedMedia: string;
    unsupportedFile: string;
    unsupportedFiles: string;
    noSnapshotFrame: string;
    programSnapshotTitle: string;
    snapshotSubtitle: string;
    snapshotSentToCanvas: string;
    assetAttachedToMediaBlock: string;
    graphFallbackLabel: string;
    connectorFallbackLabel: string;
    graphLinkConnected: string;
    noMatchingBlockForConnector: string;
    nodeCreatedFromConnector: string;
    nodeDroppedOntoCanvas: string;
    linkNeedsSourceAndTarget: string;
    blockCannotLinkToItself: string;
    connectorsNotCompatible: string;
    connectorFull: string;
    selectGeneratedOutputOrMedia: string;
    outputNotReadyForTimeline: string;
    selectPlayableMediaForTimeline: string;
    blockCannotBePlacedOnTimeline: string;
    timelineDropNeedsEditPoint: string;
    blockCouldNotBeInsertedOnTimeline: string;
    nodeDroppedOnTimeline: string;
    unlockTrackBeforeDroppingMedia: string;
    blockNotCompatibleWithTimelineTrack: string;
    generationInvalidInputs: string;
    generationStarted: string;
    generationStartedMock: string;
    generationOutputCreated: string;
    generationOutputFailed: string;
    generationStillProcessing: string;
    generationFailed: string;
    invalidProjectMediaUpload: string;
  };
};

export const DEFAULT_STUDIO_COPY: StudioCopy = {
  projects: {
    metaTitle: 'Studio Projects | MaxVideoAI',
    heroBadge: 'MaxVideoAI Studio',
    title: 'Studio projects',
    subtitle: 'Create a project, choose the starting canvas, then configure each sequence inside the editor.',
    createTitle: 'Create a new project',
    createSubtitle: 'Set up your project in a few steps',
    projectNameLabel: 'Project name',
    projectNamePlaceholder: 'Give your project a name...',
    canvasTemplateLabel: 'Canvas template',
    browseTemplates: 'Browse all templates',
    createProject: 'Create project',
    creating: 'Creating...',
    recentTitle: 'Recent projects',
    recentSubtitle: 'Pick up where you left off',
    emptyRecent: 'No Studio projects yet.',
    viewAllProjects: 'View all projects',
    projectActionsAria: 'Project actions for {name}',
    rename: 'Rename',
    duplicate: 'Duplicate',
    duplicateSuffix: 'copy',
    delete: 'Delete',
    renameTitle: 'Rename project',
    renameSubmit: 'Save name',
    deleteTitle: 'Delete project',
    deleteBody: 'This removes the project from Studio. This cannot be undone.',
    deleteConfirm: 'Delete project',
    cancel: 'Cancel',
    closeDialog: 'Close dialog',
    untitledProject: 'Untitled edit',
    localDraft: 'Local draft',
    customCanvas: 'Custom canvas',
  },
  topbar: {
    productName: 'MaxVideoAI Editor',
    breadcrumbProjects: 'Projects',
    breadcrumbWorkspace: 'Workspace',
    workspaceViewLabel: 'Workspace view',
    canvas: 'Canvas',
    viewer: 'Viewer',
    export: 'Export',
    exportAria: 'Open export dialog',
    mock: 'Mock',
    live: 'Live',
    mockAria: 'Toggle mock generation',
    switchToLight: 'Switch Studio to light mode',
    switchToDark: 'Switch Studio to dark mode',
    accountStatus: 'Studio account status',
    walletBalance: 'Studio wallet balance {amount}',
    noSession: 'No session',
    loadingSession: 'Loading session',
    walletTopUpLabel: 'Top up available',
    walletTopUpCopy: 'Click to add funds and keep generating without interruption.',
    walletTopUpCta: 'Top up now',
    signedIn: 'Signed in',
    primaryNavigation: 'Primary navigation',
    admin: 'Admin',
    signOut: 'Sign out',
    navigationLabels: {
      dashboard: 'Dashboard',
      generate: 'Generate Video',
      'generate-image': 'Generate Image',
      'generate-audio': 'Generate Audio',
      tools: 'Tools',
      library: 'Library',
      jobs: 'History',
      billing: 'Billing',
      settings: 'Settings',
      studio: 'Studio',
    },
    exitToProjects: 'Exit to projects',
    saveAndReturnToProjects: 'Save and return to projects',
  },
  common: {
    secondsShort: 's',
    itemSingular: 'item',
    itemPlural: 'items',
    folder: 'Folder',
    generatedClip: 'Generated clip',
  },
  canvas: {
    ariaLabel: 'MaxVideoAI editor canvas',
    toolbar: {
      ariaLabel: 'Canvas creation toolbar',
      undoTooltip: 'Undo (Cmd/Ctrl + Z)',
      undoTitle: 'Undo canvas edit (Cmd/Ctrl + Z)',
      undo: 'Undo canvas edit',
      redoTooltip: 'Redo (Cmd/Ctrl + Shift + Z)',
      redoTitle: 'Redo canvas edit (Cmd/Ctrl + Shift + Z)',
      redo: 'Redo canvas edit',
      selectNodes: 'Select canvas nodes',
      marqueeSelectNodes: 'Marquee select canvas nodes',
      deleteSelectedNodes: 'Delete selected canvas nodes',
      imageTools: 'Image tools',
      videoTools: 'Video tools',
      audioTools: 'Audio tools',
      textTools: 'Text tools',
      canvasTemplates: 'Canvas templates',
      imageToolsDescription: 'Drag image blocks or image generation tools into the canvas.',
      videoToolsDescription: 'Drag video sources or video generation tools into the canvas.',
      audioToolsDescription: 'Drag music, sound, or voice tools into the canvas.',
      textToolsDescription: 'Drag connectable free text into the canvas.',
      canvasTemplatesDescription: 'Apply graph templates without touching the timeline.',
      emptyTitle: 'No graph yet',
      emptyBody: 'Start from a template or add nodes from the library.',
    },
    templates: {
      templateNamePlaceholder: 'Template name',
      templateNameLabel: 'Canvas template name',
      save: 'Save',
      duplicate: 'Duplicate {name}',
      delete: 'Delete {name}',
      empty: 'No saved canvas templates yet.',
    },
    templateSummaries: {
      'product-ad': {
        name: 'Product Ad',
        description: 'Product image, logo, style, music, four shot blocks, and launch timeline.',
        flow: 'Product ref -> style clip -> 4 shots',
        badge: 'Pro',
      },
      'dev-blocks': {
        name: 'Dev Blocks',
        description: 'Focused component development and testing workflow.',
        flow: 'Every block -> connectors -> output QA',
        badge: 'Pro',
      },
      'character-dialogue': {
        name: 'Character Dialogue',
        description: 'Character reference, dialogue prompt, voiceover, and continuity shots.',
        flow: 'Character anchor -> dialogue -> voice',
        badge: 'Pro',
      },
      'storyboard-to-video': {
        name: 'Storyboard Flow',
        description: 'Board frames, camera notes, continuity links, and empty outputs.',
        flow: 'Panels -> shot plan -> sequence',
        badge: 'Pro',
      },
      'ugc-ad': {
        name: 'UGC Hook',
        description: 'Talking-head reference, hook script, b-roll shots, voice and music.',
        flow: 'Hook script -> avatar -> b-roll',
        badge: 'Pro',
      },
      'cinematic-scene': {
        name: 'Cinematic Trailer',
        description: 'Style plate, camera plan, scene prompts, sound design, and sequence.',
        flow: 'Mood plate -> camera -> trailer shots',
        badge: 'Pro',
      },
    },
    nodes: {
      image: 'Image',
      imageDescription: 'Image source, logo, product frame, storyboard panel.',
      generateImage: 'Generate image',
      generateImageDescription: 'Prompt-led generation block for visual outputs.',
      video: 'Video',
      videoDescription: 'Video source, motion reference, source clip, B-roll.',
      generateVideo: 'Generate video',
      generateVideoDescription: 'Video generation block with model-aware inputs.',
      modifyVideo: 'Modify video',
      modifyVideoDescription: 'Video-to-video generation workflow block.',
      upscale: 'Upscale',
      upscaleDescription: 'Enhancement workflow block for a video source.',
      music: 'Music',
      musicDescription: 'Music source or reference audio.',
      generateMusic: 'Generate music',
      generateMusicDescription: 'Generation block for music direction.',
      sfx: 'SFX',
      sfxDescription: 'Generation block for sound effects.',
      voiceOver: 'Voice over',
      voiceOverDescription: 'Generation block for narration or voice direction.',
      freeText: 'Free text',
      freeTextDescription: 'Connectable text block for prompts, dialogue, notes, or metadata.',
      addImage: 'Add image',
      addVideo: 'Add video',
      addAudio: 'Add audio',
      assetFallback: 'Asset',
      promptFallback: 'Prompt',
      canvasNote: 'Canvas note',
      chars: 'chars',
      outputAvailable: 'Output available',
      clickToGenerate: 'Click to generate',
      generating: 'Generating',
      generate: 'Generate',
      completed: 'Completed',
      failed: 'Failed',
      incompatible: 'Incompatible',
      ready: 'Ready',
      draft: 'Draft',
      modelFallback: 'Model',
      generatedOutput: 'Generated output',
      processing: 'Processing',
      outputProcessingRender: 'Processing render...',
      outputWaitingForMedia: 'Waiting for generated media',
      generatedMedia: 'Generated media',
      placeholder: 'Placeholder',
      sendToTimeline: 'Send to timeline',
      openSettings: 'Open {name} settings',
      openSettingsTitle: 'Open settings (I)',
      imageReference: 'Image reference',
      videoReference: 'Video reference',
      audioReference: 'Audio reference',
      emptyMediaBlock: 'Empty media block',
      promptBlock: 'Prompt block',
      textSource: 'Text source',
      freeTextNote: 'Free text note',
      outputBlock: 'Output block',
      generatedResult: 'Generated result',
      generateBlock: 'Generate block',
      unifiedVideoModel: 'Unified video model',
      nodeSettingsAria: 'Node settings',
      inspectorTitle: 'Inspector',
      selectNodeToEditSettings: 'Select a node to edit settings',
      canvasFirst: 'Canvas first',
      emptyInspectorBody: 'Pick a shot, prompt, asset or output to inspect its graph role.',
      selectMedia: 'Select media',
      replaceMedia: 'Replace media',
      insertAtPlayhead: 'Insert at playhead',
      filename: 'Filename',
      type: 'Type',
      inputs: 'Inputs',
      outputs: 'Outputs',
      promptRole: 'Prompt role',
      text: 'Text',
      model: 'Model',
      unknown: 'Unknown',
      status: 'Status',
      workflow: 'Workflow',
      duration: 'Duration',
      notAvailable: 'n/a',
      job: 'Job',
      localJob: 'local',
      outputName: 'Output name',
      recommended: 'Recommended',
      allModels: 'All models',
      aspect: 'Aspect',
      resolution: 'Resolution',
      fps: 'FPS',
      referenceStrength: 'Reference strength',
      on: 'On',
      off: 'Off',
      included: 'Included',
      readyToGenerate: 'Ready to generate',
      needsAttention: 'Needs attention',
      missingInputs: 'Missing: {inputs}',
      unsupportedInputs: 'Unsupported: {inputs}',
      connectedInputsMatch: 'Connected inputs match selected model.',
      estimate: 'Estimate',
      estimating: 'Estimating...',
      routing: 'Routing',
      availableInputs: 'Available inputs',
      required: 'Required',
      optional: 'Optional',
      connections: 'Connections',
      connectedInputs: 'Connected inputs',
      connectedOutputs: 'Connected outputs',
      toNode: 'To {node}',
      fromNode: 'From {node}',
      noGraphConnections: 'No graph connections yet.',
      promptRoleSceneDescription: 'Scene description',
      edgeReference: 'Reference',
      edgeStartImage: 'Start image',
      edgeEndImage: 'End image',
      edgeProduct: 'Product',
      edgeCharacter: 'Character',
      edgeStyle: 'Style',
      edgeComposition: 'Composition',
      edgeLogo: 'Logo',
      edgePrompt: 'Prompt',
      edgeNegativePrompt: 'Negative',
      edgeCamera: 'Camera',
      edgeDialogue: 'Dialogue',
      edgeNarration: 'Narration',
      edgeAudio: 'Audio',
      edgeVoiceover: 'Voice',
      edgeMusic: 'Music',
      edgeSfx: 'SFX',
      edgeMotionReference: 'Motion',
      edgePreviousShot: 'Previous shot',
      edgeContinuity: 'Continuity',
      edgeGeneratedOutput: 'Output',
      edgeOutputToTimeline: 'Timeline',
      edgeVideoReference: 'Video ref',
      connectorNegativePrompt: 'Negative prompt',
      connectorStartFrame: 'Start frame',
      connectorEndFrameOptional: 'End frame (optional)',
      connectorLastFrame: 'Last frame',
      connectorReferenceImages: 'Reference images',
      connectorSourceVideo: 'Source video',
      templateProductImage: 'Product Image',
      templateStyleReference: 'Style Reference',
      templateCameraMovement: 'Camera Movement',
      templateAudioReference: 'Audio Reference',
      templateVoiceOver: 'Voice Over',
      templateShotName: 'Shot {index}',
      templateShotAudioName: '{name} Audio',
      templateOutputName: 'Output {index}',
      templateHeroReveal: 'Hero Reveal',
      templateMacroDetails: 'Macro Details',
      templateExplodedView: 'Exploded View',
      templateFinalPackshot: 'Final Packshot',
    },
    map: {
      navigationLabel: 'Canvas navigation',
      mapTitle: 'Canvas map',
      miniatureLabel: 'Canvas map. Drag the visible area to pan the canvas.',
      zoomControls: 'Canvas zoom controls',
      zoomOut: 'Zoom out canvas',
      fit: 'Fit canvas',
      zoomIn: 'Zoom in canvas',
    },
  },
  timeline: {
    tools: {
      videoTimeline: 'Video timeline',
      resizeTimeline: 'Resize montage timeline',
      resizeTimelineTitle: 'Drag to resize montage timeline',
      undoTooltip: 'Undo (Cmd/Ctrl + Z)',
      undoTitle: 'Undo timeline edit (Cmd/Ctrl + Z)',
      undo: 'Undo timeline edit',
      redoTooltip: 'Redo (Cmd/Ctrl + Shift + Z)',
      redoTitle: 'Redo timeline edit (Cmd/Ctrl + Shift + Z)',
      redo: 'Redo timeline edit',
      editingTools: 'Timeline editing tools',
      selectionTooltip: 'Selection tool (V)',
      selectionTitle: 'Selection tool. Drag clips, marquee empty space, and Shift/Cmd-click to toggle selection. (V)',
      selection: 'Selection tool',
      bladeTooltip: 'Blade / Cut tool (C)',
      bladeTitle: 'Blade / Cut tool. Click a clip to split, or press S to split selected at the playhead. (C)',
      blade: 'Blade / Cut tool',
      zoom: 'Timeline zoom',
      zoomOutTooltip: 'Zoom out (Cmd/Ctrl + -)',
      zoomOutTitle: 'Zoom out timeline (Cmd/Ctrl + -)',
      zoomOut: 'Zoom out timeline',
      zoomInTooltip: 'Zoom in (Cmd/Ctrl + +)',
      zoomInTitle: 'Zoom in timeline (Cmd/Ctrl + +)',
      zoomIn: 'Zoom in timeline',
      zoomLevel: 'Timeline zoom level',
      snappingTooltip: 'Snapping: clips, playhead, zero (M)',
      snappingTitle: 'Snapping to clip edges, playhead, and zero (M)',
      toggleSnapping: 'Toggle snapping',
      insertIntoClipTooltip: 'Splice insert inside clips',
      insertIntoClipTitle: 'Allow insert drags to split the clip under the drop point',
      toggleInsertIntoClip: 'Toggle insert into clip',
      dragPlayhead: 'Drag timeline playhead',
      scrubber: 'Timeline scrubber',
    },
    tracks: {
      audioTrack: 'Audio {index}',
      addVideoTrack: 'Add video track',
      addAudioTrack: 'Add audio track',
      rightClickActions: 'Right-click for track actions',
      showTrack: 'Show {track} track',
      hideTrack: 'Hide {track} track',
      muteTrack: 'Mute {track} track',
      unmuteTrack: 'Unmute {track} track',
      lockTrack: 'Lock {track} track',
      unlockTrack: 'Unlock {track} track',
      emptyLaneTitle: 'Click empty timeline space to move the playhead, or drag to select clips',
      dragPlayheadOnTrack: 'Drag timeline playhead on {track} track',
      invalidDrop: 'Invalid drop',
      emptyTrack: 'Drop generated outputs here',
      clipSelected: '{count} clip selected',
      clipsSelected: '{count} clips selected',
      trackContextLabel: '{track} track',
      addTrack: 'Add {kind} track',
      deleteTrack: 'Delete {kind} track',
    },
    clips: {
      trackLocked: 'Track locked',
      clickToCut: 'Click to cut this clip',
      dragToMove: 'Drag to move this clip',
      useTrimHandles: 'Use the trim handles for this tool',
      timelineClip: '{title} timeline clip',
      trimStart: 'Trim clip start',
      trimEnd: 'Trim clip end',
      moveLeft: 'Move clip left',
      moveRight: 'Move clip right',
      sourceIn: 'in {time}',
      unlinkSelected: 'Unlink selected clips',
      linkSelected: 'Link selected clips',
    },
    inspector: {
      clipSettings: 'Timeline clip settings',
      clipInspector: 'Clip inspector',
      selectClip: 'Select a timeline clip to edit',
      timelineFirst: 'Timeline first',
      emptyBody: 'Pick a clip in the timeline to adjust its edit properties.',
      sequenceSettings: 'Sequence settings',
      sequenceName: 'Sequence name',
      sequenceFormat: 'Sequence format',
      format: 'Format',
      aspectRatio: 'Aspect ratio',
      resolution: 'Resolution',
      fps: 'FPS',
      sequenceDetails: 'Sequence details',
      duration: 'Duration',
      clips: 'Clips',
      frame: 'Frame',
      clipName: 'Clip name',
      clip: 'clip',
      clipTransform: 'Clip transform',
      transform: 'Transform',
      resetTransform: 'Reset clip transform',
      scale: 'Scale',
      positionX: 'Position X',
      positionY: 'Position Y',
      rotation: 'Rotation',
      opacity: 'Opacity',
      clipAudio: 'Clip audio',
      audio: 'Audio',
      volume: 'Volume',
      muteClip: 'Mute clip',
      clipTransition: 'Clip transition',
      transition: 'Transition',
      crossfade: 'Crossfade to next clip',
      clipTimingDetails: 'Clip timing details',
      start: 'Start',
      end: 'End',
      sourceIn: 'Source in',
    },
  },
  viewer: {
    controls: {
      scrubPreview: 'Program scrub preview',
      previousCutTitle: 'Go to previous edit cut',
      previousCut: 'Previous cut',
      nextCutTitle: 'Go to next edit cut',
      nextCut: 'Next cut',
      pauseTitle: 'Pause montage (Space)',
      playTitle: 'Play montage (Space)',
      pauseTimeline: 'Pause timeline',
      playTimeline: 'Play timeline',
      markInTitle: 'Mark In (I)',
      markIn: 'Mark In',
      markOutTitle: 'Mark Out (O)',
      markOut: 'Mark Out',
      in: 'In',
      out: 'Out',
      snapshotTitle: 'Send current frame snapshot to canvas',
      snapshotAria: 'Send snapshot to canvas',
      snapshot: 'Snapshot',
      clearTitle: 'Clear In and Out marks',
      clearAria: 'Clear In and Out',
      clear: 'Clear',
    },
    monitor: {
      viewerLabel: 'Montage video viewer',
      program: 'Program',
      zoom: 'Zoom',
      zoomTitle: 'Program monitor zoom. Fit shows the whole sequence frame; 100% maps sequence pixels to preview pixels.',
      zoomAria: 'Program monitor zoom',
      fit: 'Fit',
      toggleZoom: 'Toggle program zoom',
      noPlayableClip: 'No playable clip selected',
      emptyBody: 'Send a generated video to the timeline, then select it for preview.',
    },
    projectMedia: {
      sidebarLabel: 'Project media library',
      title: 'Project media',
      subtitle: 'Assets, sequences and generated clips',
      importMedia: 'Import media',
      searchLabel: 'Search media',
      searchPlaceholder: 'Search media...',
      viewTools: 'Project media view tools',
      filterMedia: 'Filter media',
      gridView: 'Grid view',
      backToProjectMedia: 'Back to Project media',
      projectMediaGrid: '{project} project media',
      moreActions: 'More actions for {title}',
      actionsLabel: '{title} actions',
      openSequence: 'Open sequence',
      openFolder: 'Open folder',
      insertAtPlayhead: 'Insert at playhead',
      duplicate: 'Duplicate',
      renameFolder: 'Rename folder',
      moveToFolder: 'Move to folder',
      delete: 'Delete',
      newFolder: 'New folder',
      newFolderDefaultName: 'New folder {index}',
      mainSequenceName: 'Main sequence',
      sequenceName: 'Sequence {index}',
      sequenceCopyName: '{name} copy',
      untitledSequenceName: 'Untitled sequence',
      untitledFolderName: 'Untitled folder',
      moveDialogTitle: 'Move to folder',
      moveDialogDescription: 'Choose a destination for {title}.',
      folderDialogDescription: 'Name this Project media folder.',
      closeDialog: 'Close dialog',
      folderDestination: 'Project media folder destination',
      folderName: 'Folder name',
      cancel: 'Cancel',
      create: 'Create',
      rename: 'Rename',
      move: 'Move',
      clipSingular: 'clip',
      clipPlural: 'clips',
      folderEmpty: 'This folder is empty.',
      noSearchMatches: 'No media matches this search.',
      empty: 'Import media or create a sequence to start.',
      itemSingular: 'item',
      itemPlural: 'items',
      newSequence: 'New sequence',
    },
  },
  exportDialog: {
    title: 'Export sequence',
    close: 'Close export dialog',
    videoExport: 'Video export',
    formatMp4: 'MP4 H.264',
    sequence: 'Sequence',
    project: 'Project',
    range: 'Range',
    inOut: 'In/Out',
    fullSequenceRange: 'Sequence',
    duration: 'Duration',
    tracks: 'Tracks',
    exportRange: 'Export range',
    fullSequence: 'Full sequence',
    inOutRange: 'In/Out range',
    qualityPreset: 'Quality preset',
    preflight: 'Preflight',
    ready: 'Ready',
    blocked: 'Blocked',
    queueing: 'Queueing...',
    exportQueued: 'Export queued',
    retryExport: 'Retry export',
    exportVideo: 'Export video',
    serverRender: 'Server render',
    freeExport: 'Free export {remaining}/{limit}',
    estimating: 'Estimating...',
    estimateUnavailable: 'Estimate unavailable',
    queuedServerWorker: 'Queued on the server. A Fargate worker will claim this job and render the MP4.',
    serverWorkerRendering: 'Server worker is rendering the MP4.',
    paidExport: 'Paid export',
    serverMp4: 'Server MP4',
    freeExportsRemaining: '{count} free server export remaining',
    freeExportsRemainingPlural: '{count} free server exports remaining',
    finalRenderJob: 'Final render job runs on MaxVideoAI servers.',
    serverProgress: 'Server export progress',
    downloadMp4: 'Download MP4',
    advanced: 'Advanced',
    exportEdl: 'Export EDL',
    prepareRenderJson: 'Prepare render JSON',
    queued: 'Queued',
    rendering: 'Rendering',
    failed: 'Failed',
    canceled: 'Canceled',
    draftPreset: 'Draft',
    draftPresetDescription: 'Fast review export with lighter compression.',
    standardPreset: 'Standard',
    standardPresetDescription: 'Balanced MP4 for normal delivery.',
    highPreset: 'High',
    highPresetDescription: 'Higher bitrate master for final review.',
    readinessMedia: 'Media',
    readinessMediaBlocked: 'Some clips are missing media or still processing.',
    readinessMediaReadySingular: '{count} clip ready for export.',
    readinessMediaReadyPlural: '{count} clips ready for export.',
    readinessTimeline: 'Timeline',
    readinessTimelineBlocked: 'Fix overlapping clips before export.',
    readinessTimelineWarnings: 'Timeline has warnings, but export can be prepared.',
    readinessTimelineReady: 'No blocking timeline conflicts.',
    readinessRange: 'Range',
    readinessRangeInOut: 'In/Out range is exportable.',
    readinessRangeFullSequence: 'Full sequence range is exportable.',
    readinessRangeBlocked: 'Select a range with duration before export.',
    readinessAudio: 'Audio',
    readinessAudioIncludedSingular: '{count} audio clip included.',
    readinessAudioIncludedPlural: '{count} audio clips included.',
    readinessAudioEmbedded: 'No separate audio clips; embedded clip audio is preserved when available.',
    renderBlockedSingular: 'Render blocked: {count} issue to fix.',
    renderBlockedPlural: 'Render blocked: {count} issues to fix.',
    renderReadySingular: 'Render manifest ready: {count} clip, {duration}s.',
    renderReadyPlural: 'Render manifest ready: {count} clips, {duration}s.',
    exportWorkerNotConfigured: 'Server export is not configured yet. Set the ECS worker environment variables before launching MP4 renders.',
    exportWorkerStartFailed: 'The export job was created, but the server render worker could not start. Billing was released for this failed launch.',
    exportWorkerEmpty: 'The server accepted the export request but did not return a render task. Billing was released for this failed launch.',
    insufficientWalletBalance: 'Your wallet balance is too low for this export.',
    exportCreateFailed: 'The export job could not be created.',
    exportJobInvalid: 'The export job response was invalid.',
  },
  assetLibrary: {
    library: 'Library',
    selectAsset: 'Select {type}',
    selectForNode: 'Select {type} for {node}',
    closeLibrary: 'Close library',
    closeProjectMediaLibrary: 'Close project media library',
    upload: 'Upload',
    uploading: 'Uploading...',
    uploadFailed: 'Upload {kind} failed. Please try again.',
    importProjectMedia: 'Import project media',
    importProjectMediaSubtitle: 'Import media into Project media',
    noProjectMedia: 'No media in your project library yet.',
    invalidProjectMediaUpload: 'Upload image, video, or audio media for the project.',
    searchAssets: 'Search assets',
    searchPlaceholder: 'Search assets...',
    sourceFilters: 'Library asset filters',
    showingDevAssets: 'Showing dev assets while your app library is empty.',
    loadingLibrary: 'Loading your app library...',
    loading: 'Loading',
    signInToAccessLibrary: 'Sign in to access your app library.',
    unableToLoadLibrary: 'Unable to load your app library.',
    assetSingular: 'asset',
    assetPlural: 'assets',
    emptyLibrary: 'No matching media in your app library yet.',
    emptySearch: 'No assets match this search.',
    useAsset: 'Use {name}',
    image: 'image',
    video: 'video',
    audio: 'audio',
    asset: 'asset',
  },
  notices: {
    canvasTemplateNotFound: 'Canvas template not found.',
    projectMediaAssetNotFound: 'Project media asset not found.',
    projectMediaFolderNotFound: 'Project media folder not found.',
    generatedClipNotFound: 'Generated clip not found.',
    unlockBeforeMoving: 'Unlock the track before moving clips.',
    unlockBeforeCutting: 'Unlock the track before cutting clips.',
    unlockBeforeTrimming: 'Unlock the track before trimming clips.',
    unlockBeforeDeleting: 'Unlock the track before deleting clips.',
    selectedClipsUnlinked: 'Selected timeline clips unlinked.',
    selectedClipsLinked: 'Selected timeline clips linked.',
    unlockBeforeUnlinking: 'Unlock the track before unlinking clips.',
    unlockBeforeLinking: 'Unlock the track before linking clips.',
    inPointSet: 'In point set at {timecode}.',
    outPointSet: 'Out point set at {timecode}.',
    inOutPointsCleared: 'In and Out points cleared.',
    workspaceSavedReturningToProjects: 'Workspace saved. Returning to projects.',
    projectLoadedCleanSequence: '{name} project loaded with a clean sequence.',
    deleteTrackWithClipsConfirm: 'Delete {track} and all clips on this track?',
    deleteTrackConfirm: 'Delete {track}?',
    timelineTrackDeleted: '{track} deleted.',
    sequenceNotFound: 'Sequence not found.',
    keepAtLeastOneSequence: 'Keep at least one sequence in the project.',
    sequenceSelected: '{name} selected.',
    sequenceCreated: '{name} created.',
    deleteSequenceConfirm: 'Delete "{name}"? This removes its timeline from the project.',
    sequenceDeleted: '{name} deleted.',
    exportEstimateFailed: 'Export estimate failed.',
    exportReadyDownload: 'Export ready. Download available.',
    exportCompleted: 'Export completed.',
    serverExportFailed: 'Server export failed.',
    serverExportRendering: 'Server export rendering.',
    queueingServerExport: 'Queueing server export.',
    serverExportAlreadyQueued: 'Server export already queued.',
    serverExportQueued: 'Server export queued.',
    serverExportFailedToStart: 'Server export failed to start.',
    exportEdlReady: 'EDL ready for {range} export.',
    projectMediaAdded: '{filename} added to Project media.',
    projectMediaRoot: 'Project media',
    projectMediaFallbackFolder: 'folder',
    projectMediaImportedInto: '{filename} imported into {target}.',
    deleteProjectAssetConfirm: 'Delete "{filename}" from Project media? Timeline clips already placed will stay in the edit.',
    projectAssetRemoved: '{filename} removed from Project media.',
    deleteGeneratedClipConfirm: 'Delete "{title}" from Project media? Timeline clips already placed will stay in the edit.',
    generatedClipRemoved: '{title} removed from Project media.',
    generatedOutputSubtitle: 'Generated output',
    newProjectMediaFolderName: 'New folder {index}',
    projectMediaFolderCreated: '{name} folder created in Project media.',
    deleteProjectMediaFolderConfirm: 'Delete "{name}" from Project media?',
    projectMediaFolderDeleted: '{name} folder deleted from Project media.',
    projectMediaFolderRenamed: '{oldName} renamed to {newName}.',
    projectAssetMovedToFolder: '{filename} moved to {folder}.',
    generatedClipMovedToFolder: '{title} moved to {folder}.',
    projectMediaNotPlayable: '{filename} is not a playable timeline media asset.',
    unlockTrackBeforeProjectMediaDrop: 'Unlock {track} before dropping media on it.',
    projectMediaCannotBePlaced: '{filename} cannot be placed on the timeline.',
    projectMediaNotCompatibleWithTrack: '{filename} is not compatible with the {track} track.',
    unlockTargetTrackBeforeProjectMediaInsert: 'Unlock the target track before inserting project media.',
    projectMediaInsertNeedsEditPoint: 'Place the playhead on an edit point or enable Insert into clip.',
    projectMediaCouldNotBeInserted: '{filename} could not be inserted on the timeline.',
    projectMediaDroppedOnTimeline: '{filename} dropped on {track} at {time}s.',
    projectMediaInsertedAtPlayhead: '{filename} inserted at the playhead on the {track} track.',
    completedServerExportSubtitle: 'Server export',
    deleteCanvasTemplateConfirm: 'Delete "{name}"?',
    canvasTemplateApplied: '{name} canvas template applied.',
    defaultCanvasTemplateName: 'Canvas template {index}',
    canvasTemplateSavedAs: '{name} saved as a canvas template.',
    canvasTemplateDuplicateName: '{name} copy',
    canvasTemplateSaved: '{name} saved.',
    canvasTemplateDeleted: '{name} deleted.',
    textPastedIntoPrompt: '{source} pasted into the prompt block.',
    sourceAddedToCanvas: '{source} added to the canvas.',
    pastedTextFilename: 'pasted-text.txt',
    untitledFile: 'Untitled file',
    couldNotReadTextFile: 'Could not read {filename}.',
    fileAttachedToMediaBlock: '{filename} attached to the media block.',
    fileAddedToCanvas: '{filename} added to the canvas.',
    localImportSizeLabel: 'Local import',
    canvasImportImageLabel: 'Image',
    canvasImportVideoLabel: 'Video',
    canvasImportAudioLabel: 'Audio',
    localImageFallbackName: 'local-image',
    localVideoFallbackName: 'local-video',
    localAudioFallbackName: 'local-audio',
    localPromptFallbackName: 'local-prompt.txt',
    adHocImageReferenceTitle: 'Image Reference',
    adHocVideoReferenceTitle: 'Video Reference',
    adHocAudioReferenceTitle: 'Audio Reference',
    adHocPromptTitle: 'Prompt',
    adHocNoteTitle: 'Note',
    adHocShotTitle: 'Shot',
    noImageSelected: 'No image selected',
    noVideoSelected: 'No video selected',
    noAudioSelected: 'No audio selected',
    promptFileSubtitle: 'prompt.txt',
    canvasTextSubtitle: 'Canvas text',
    defaultPromptText: 'Describe the next shot with subject, motion, lighting, lens, and mood.',
    defaultNoteText: 'Write a free note for this canvas.',
    newGenerationBlockSubtitle: 'New generation block',
    newShotOutputName: 'New Shot',
    generatedOutputTitle: 'Generated Output',
    generatedOutputBlockSubtitle: 'Reusable output block',
    outputProcessingRender: 'Processing render...',
    outputWaitingForMedia: 'Waiting for generated media',
    textPromptSourceSubtitle: 'Text prompt source',
    imageSourceBlockSubtitle: 'Image source block',
    videoSourceBlockSubtitle: 'Video source block',
    audioSourceBlockSubtitle: 'Audio source block',
    promptNodeTitle: '{label} Prompt',
    imageNodeTitle: '{label} Image',
    videoNodeTitle: '{label} Video',
    audioNodeTitle: '{label} Audio',
    dragCreatedPromptSubtitle: 'drag_created_prompt.txt',
    draftHandlePromptText: 'Draft {label} input...',
    readyForGeneratedMedia: 'Ready for generated media',
    unsupportedFile: 'Unsupported file: {files}.',
    unsupportedFiles: 'Unsupported files: {files}.',
    noSnapshotFrame: 'No visible program frame is available for a snapshot.',
    programSnapshotTitle: 'Program Snapshot',
    snapshotSubtitle: 'Snapshot · {timecode}',
    snapshotSentToCanvas: '{filename} sent to the canvas.',
    assetAttachedToMediaBlock: '{name} attached to the media block.',
    graphFallbackLabel: 'Graph',
    connectorFallbackLabel: 'connector',
    graphLinkConnected: '{label} link connected.',
    noMatchingBlockForConnector: 'No matching block is available for this connector.',
    nodeCreatedFromConnector: '{title} created from the {connector} connector.',
    nodeDroppedOntoCanvas: '{title} dropped onto the canvas.',
    linkNeedsSourceAndTarget: 'This link needs a source and a target connector.',
    blockCannotLinkToItself: 'A block cannot link to itself.',
    connectorsNotCompatible: 'These block connectors are not compatible.',
    connectorFull: '{connector} is full.',
    selectGeneratedOutputOrMedia: 'Select a generated output or media block before sending it to the timeline.',
    outputNotReadyForTimeline: 'This output is not ready for the timeline yet.',
    selectPlayableMediaForTimeline: 'Select a playable media file before sending this block to the timeline.',
    blockCannotBePlacedOnTimeline: 'This block cannot be placed on the timeline yet.',
    timelineDropNeedsEditPoint: 'Drop on an edit point or enable Insert into clip to splice inside an existing clip.',
    blockCouldNotBeInsertedOnTimeline: 'This block could not be inserted on the timeline.',
    nodeDroppedOnTimeline: '{title} dropped on {track} at {time}s.',
    unlockTrackBeforeDroppingMedia: 'Unlock the track before dropping media on it.',
    blockNotCompatibleWithTimelineTrack: 'This block is not compatible with that timeline track.',
    generationInvalidInputs: 'This shot has incompatible or missing inputs for the selected model.',
    generationStarted: '{title} generation started.',
    generationStartedMock: '{title} generation started in mock mode.',
    generationOutputCreated: '{model} output created. Send it to the timeline when ready.',
    generationOutputFailed: '{model} generation failed.',
    generationStillProcessing: '{model} render is still processing. It will be available when the job completes.',
    generationFailed: 'Generation failed.',
    invalidProjectMediaUpload: 'Upload image, video, or audio media for the project.',
  },
};

function readObject(source: Dictionary, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (!current || typeof current !== 'object') return undefined;
    return (current as Record<string, unknown>)[key];
  }, source);
}

function mergeCopy<T extends Record<string, unknown>>(fallback: T, value: unknown): T {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback;

  const source = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(fallback).map(([key, fallbackValue]) => {
      const sourceValue = source[key];
      if (
        fallbackValue &&
        typeof fallbackValue === 'object' &&
        !Array.isArray(fallbackValue) &&
        sourceValue &&
        typeof sourceValue === 'object' &&
        !Array.isArray(sourceValue)
      ) {
        return [key, mergeCopy(fallbackValue as Record<string, unknown>, sourceValue)];
      }
      return [key, typeof sourceValue === typeof fallbackValue ? sourceValue : fallbackValue];
    })
  ) as T;
}

export function resolveStudioCopy(dictionary: Dictionary | null | undefined): StudioCopy {
  if (!dictionary) return DEFAULT_STUDIO_COPY;
  return mergeCopy(
    DEFAULT_STUDIO_COPY as unknown as Record<string, unknown>,
    readObject(dictionary, 'workspace.studio')
  ) as unknown as StudioCopy;
}

type StudioTemplateSummaryLike = {
  badge?: string;
  description: string;
  flow?: string;
  id: string;
  name: string;
};

export function localizeStudioTemplateSummary<T extends StudioTemplateSummaryLike>(
  summary: T,
  copy: StudioCopy
): T {
  const localized = copy.canvas.templateSummaries[summary.id];
  if (!localized) return summary;
  return {
    ...summary,
    name: localized.name || summary.name,
    description: localized.description || summary.description,
    flow: localized.flow || summary.flow,
    badge: localized.badge || summary.badge,
  };
}

export function localizeStudioTemplateSummaries<T extends StudioTemplateSummaryLike>(
  summaries: T[],
  copy: StudioCopy
): T[] {
  return summaries.map((summary) => localizeStudioTemplateSummary(summary, copy));
}

function formatStudioCopyValue(value: string, replacements: Record<string, string | number>): string {
  return Object.entries(replacements).reduce(
    (current, [key, replacement]) => current.replaceAll(`{${key}}`, String(replacement)),
    value
  );
}

function normalizedGeneratedName(value: string): string {
  return value
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function localizeSequenceDefaultName(
  name: string,
  copy: StudioCopy['viewer']['projectMedia']
): { matched: boolean; value: string } {
  const trimmedName = name.trim();
  const normalizedName = normalizedGeneratedName(trimmedName);

  if (['main sequence', 'sequence principale', 'secuencia principal'].includes(normalizedName)) {
    return { matched: true, value: copy.mainSequenceName };
  }

  if (['untitled sequence', 'sequence sans titre', 'secuencia sin titulo'].includes(normalizedName)) {
    return { matched: true, value: copy.untitledSequenceName };
  }

  const indexedSequenceMatch = normalizedName.match(/^(?:sequence|secuencia)\s+(\d+)$/);
  if (indexedSequenceMatch) {
    return {
      matched: true,
      value: formatStudioCopyValue(copy.sequenceName, { index: indexedSequenceMatch[1] }),
    };
  }

  return { matched: false, value: name };
}

export function localizeStudioGeneratedSequenceDisplayName(
  name: string,
  copy: StudioCopy['viewer']['projectMedia']
): string {
  const trimmedName = name.trim();
  const defaultName = localizeSequenceDefaultName(trimmedName, copy);
  if (defaultName.matched) return defaultName.value;

  const copyMatch = trimmedName.match(/^(.*)\s+(copy|copie|copia)$/i);
  if (!copyMatch) return name;

  const baseName = localizeSequenceDefaultName(copyMatch[1], copy);
  return baseName.matched
    ? formatStudioCopyValue(copy.sequenceCopyName, { name: baseName.value })
    : name;
}

export function localizeStudioGeneratedFolderDisplayName(
  name: string,
  copy: StudioCopy['viewer']['projectMedia']
): string {
  const trimmedName = name.trim();
  const normalizedName = normalizedGeneratedName(trimmedName);

  if (['untitled folder', 'dossier sans titre', 'carpeta sin titulo'].includes(normalizedName)) {
    return copy.untitledFolderName;
  }

  const indexedFolderMatch = normalizedName.match(/^(?:new folder|nouveau dossier|nueva carpeta)\s+(\d+)$/);
  if (!indexedFolderMatch) return name;

  return formatStudioCopyValue(copy.newFolderDefaultName, { index: indexedFolderMatch[1] });
}

export function localizeStudioGeneratedProjectDisplayName(name: string, copy: StudioCopy): string {
  const normalizedName = normalizedGeneratedName(name);
  if (!['untitled edit', 'montage sans titre', 'edicion sin titulo'].includes(normalizedName)) return name;
  return copy.projects.untitledProject;
}

const STUDIO_EDGE_COPY_KEYS: Record<string, string> = {
  reference: 'edgeReference',
  start_image: 'edgeStartImage',
  end_image: 'edgeEndImage',
  product: 'edgeProduct',
  character: 'edgeCharacter',
  style: 'edgeStyle',
  composition: 'edgeComposition',
  logo: 'edgeLogo',
  prompt: 'edgePrompt',
  negative_prompt: 'edgeNegativePrompt',
  camera: 'edgeCamera',
  dialogue: 'edgeDialogue',
  narration: 'edgeNarration',
  audio: 'edgeAudio',
  voiceover: 'edgeVoiceover',
  music: 'edgeMusic',
  sfx: 'edgeSfx',
  motion_reference: 'edgeMotionReference',
  previous_shot: 'edgePreviousShot',
  continuity: 'edgeContinuity',
  generated_output: 'edgeGeneratedOutput',
  output_to_timeline: 'edgeOutputToTimeline',
  video_reference: 'edgeVideoReference',
};

const STUDIO_CANVAS_TEXT_COPY_KEYS: Record<string, string> = {
  'product image': 'templateProductImage',
  'image produit': 'templateProductImage',
  'imagen de producto': 'templateProductImage',
  'style reference': 'templateStyleReference',
  'reference de style': 'templateStyleReference',
  'referencia de estilo': 'templateStyleReference',
  'camera movement': 'templateCameraMovement',
  'mouvement camera': 'templateCameraMovement',
  'movimiento de camara': 'templateCameraMovement',
  'audio reference': 'templateAudioReference',
  'reference audio': 'templateAudioReference',
  'referencia de audio': 'templateAudioReference',
  'voice over': 'templateVoiceOver',
  'voix off': 'templateVoiceOver',
  'voz en off': 'templateVoiceOver',
  'hero reveal': 'templateHeroReveal',
  'revelation hero': 'templateHeroReveal',
  'revelacion heroe': 'templateHeroReveal',
  'macro details': 'templateMacroDetails',
  'details macro': 'templateMacroDetails',
  'detalles macro': 'templateMacroDetails',
  'exploded view': 'templateExplodedView',
  'vue eclatee': 'templateExplodedView',
  'vista explosionada': 'templateExplodedView',
  'final packshot': 'templateFinalPackshot',
  'packshot final': 'templateFinalPackshot',
};

export function localizeStudioEdgeKindLabel(kind: string, copy: StudioCopy['canvas']['nodes']): string {
  const key = STUDIO_EDGE_COPY_KEYS[kind];
  return key ? copy[key] ?? kind : kind;
}

export function localizeStudioConnectorDisplayLabel(label: string, copy: StudioCopy['canvas']['nodes']): string {
  const normalizedLabel = normalizedGeneratedName(label);
  if (['negative prompt', 'prompt negatif', 'prompt negativo'].includes(normalizedLabel)) {
    return copy.connectorNegativePrompt;
  }
  if (['start image', 'start frame', 'first frame', 'image de depart', 'primera imagen'].includes(normalizedLabel)) {
    return copy.connectorStartFrame;
  }
  if (['end frame (optional)', 'end frame', 'image finale (optionnel)', 'imagen final (opcional)'].includes(normalizedLabel)) {
    return copy.connectorEndFrameOptional;
  }
  if (['last frame', 'derniere image', 'ultimo fotograma'].includes(normalizedLabel)) {
    return copy.connectorLastFrame;
  }
  if (['reference images', 'images de reference', 'imagenes de referencia'].includes(normalizedLabel)) {
    return copy.connectorReferenceImages;
  }
  if (['source video', 'video source', 'video de origen'].includes(normalizedLabel)) {
    return copy.connectorSourceVideo;
  }
  return label;
}

export function localizeStudioGeneratedCanvasText(value: string, copy: StudioCopy['canvas']['nodes']): string {
  const normalizedValue = normalizedGeneratedName(value);
  const shotAudioMatch = normalizedValue.match(/^shot\s+(\d+)\s+-\s+(.+)\s+audio$/);
  if (shotAudioMatch) {
    const shotName = formatStudioCopyValue(copy.templateShotName, { index: shotAudioMatch[1] });
    const shotDescription = localizeStudioGeneratedCanvasText(shotAudioMatch[2], copy);
    return formatStudioCopyValue(copy.templateShotAudioName, { name: `${shotName} - ${shotDescription}` });
  }

  const shotWithDescriptionMatch = normalizedValue.match(/^shot\s+(\d+)\s+-\s+(.+)$/);
  if (shotWithDescriptionMatch) {
    const shotName = formatStudioCopyValue(copy.templateShotName, { index: shotWithDescriptionMatch[1] });
    const shotDescription = localizeStudioGeneratedCanvasText(shotWithDescriptionMatch[2], copy);
    return `${shotName} - ${shotDescription}`;
  }

  const shotMatch = normalizedValue.match(/^shot\s+(\d+)$/);
  if (shotMatch) return formatStudioCopyValue(copy.templateShotName, { index: shotMatch[1] });

  const outputMatch = normalizedValue.match(/^output\s+(\d+)$/);
  if (outputMatch) return formatStudioCopyValue(copy.templateOutputName, { index: outputMatch[1] });

  const key = STUDIO_CANVAS_TEXT_COPY_KEYS[normalizedValue];
  return key ? copy[key] ?? value : value;
}

export function formatStudioProjectDate(locale: AppLocale, value: string, copy: StudioCopy): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return copy.projects.localDraft;

  return new Intl.DateTimeFormat(localeRegions[locale] ?? 'en-US', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
