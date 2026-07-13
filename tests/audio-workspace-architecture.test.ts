import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import {
  buildAudioModeOptions,
  DEFAULT_AUDIO_WORKSPACE_COPY,
} from '../frontend/app/(core)/(workspace)/app/audio/copy';
import {
  DEFAULT_PACK,
  resolveProviderLabel,
} from '../frontend/app/(core)/(workspace)/app/audio/_lib/audio-workspace-helpers';

const root = process.cwd();
const audioDir = join(root, 'frontend/app/(core)/(workspace)/app/audio');
const workspacePath = join(audioDir, 'AudioWorkspace.tsx');
const latestRendersRailPath = join(audioDir, 'AudioLatestRendersRail.tsx');
const controlsPath = join(audioDir, '_components/audio-workspace-controls.tsx');
const composerSurfacePath = join(audioDir, '_components/audio-workspace-composer-surface.tsx');
const generatedPickerPath = join(audioDir, '_components/audio-generated-video-picker.tsx');
const optionsSectionPath = join(audioDir, '_components/audio-options-section.tsx');
const sourceVideoSectionPath = join(audioDir, '_components/audio-source-video-section.tsx');
const generationDockPath = join(audioDir, '_components/audio-generation-dock.tsx');
const voiceSectionPath = join(audioDir, '_components/audio-voice-section.tsx');
const helpersPath = join(audioDir, '_lib/audio-workspace-helpers.ts');
const typesPath = join(audioDir, '_lib/audio-workspace-types.ts');
const activeJobHookPath = join(audioDir, '_hooks/useAudioActiveJobPolling.ts');
const generatedVideosHookPath = join(audioDir, '_hooks/useAudioGeneratedVideos.ts');
const generationRunnerHookPath = join(audioDir, '_hooks/useAudioGenerationRunner.ts');
const sourceMediaHandlersHookPath = join(audioDir, '_hooks/useAudioSourceMediaHandlers.ts');
const restorationHookPath = join(audioDir, '_hooks/useAudioWorkspaceRestoration.ts');

const workspaceSource = readFileSync(workspacePath, 'utf8');
const latestRendersRailSource = readFileSync(latestRendersRailPath, 'utf8');
const composerSurfaceSource = readFileSync(composerSurfacePath, 'utf8');

function getFileInputBlock(source: string, accept: string): string {
  const acceptIndex = source.indexOf(`accept="${accept}"`);
  assert.notEqual(acceptIndex, -1, `expected file input accepting ${accept}`);

  const inputStart = source.lastIndexOf('<input', acceptIndex);
  const inputEnd = source.indexOf('/>', acceptIndex);

  assert.notEqual(inputStart, -1, `expected input start before ${accept}`);
  assert.notEqual(inputEnd, -1, `expected input end after ${accept}`);

  return source.slice(inputStart, inputEnd);
}

test('audio workspace delegates local controls, helpers, and contracts', () => {
  assert.ok(existsSync(controlsPath), 'audio control components should live in a route-local component module');
  assert.ok(existsSync(composerSurfacePath), 'audio composer surface should live in a route-local component module');
  assert.ok(existsSync(generatedPickerPath), 'generated video picker should live in a route-local component module');
  assert.ok(existsSync(optionsSectionPath), 'audio options section should live in a route-local component module');
  assert.ok(existsSync(sourceVideoSectionPath), 'source video section should live in a route-local component module');
  assert.ok(existsSync(generationDockPath), 'generation dock should live in a route-local component module');
  assert.ok(existsSync(voiceSectionPath), 'voice section should live in a route-local component module');
  assert.ok(existsSync(helpersPath), 'audio browser/API helpers should live in a route-local helper module');
  assert.ok(existsSync(typesPath), 'audio local contracts should live in a route-local type module');
  assert.ok(existsSync(activeJobHookPath), 'active audio job polling should live in a route-local hook');
  assert.ok(existsSync(generatedVideosHookPath), 'generated video loading should live in a route-local hook');
  assert.ok(existsSync(generationRunnerHookPath), 'audio generation runner should live in a route-local hook');
  assert.ok(existsSync(sourceMediaHandlersHookPath), 'audio source/voice media handlers should live in a route-local hook');
  assert.ok(existsSync(restorationHookPath), 'audio job restoration should live in a route-local hook');

  assert.match(workspaceSource, /from '\.\/_components\/audio-workspace-composer-surface'/);
  assert.match(workspaceSource, /from '\.\/_components\/audio-generated-video-picker'/);
  assert.match(composerSurfaceSource, /from '\.\/audio-workspace-controls'/);
  assert.match(composerSurfaceSource, /from '\.\/audio-options-section'/);
  assert.match(composerSurfaceSource, /from '\.\/audio-source-video-section'/);
  assert.match(composerSurfaceSource, /from '\.\/audio-generation-dock'/);
  assert.match(composerSurfaceSource, /from '\.\/audio-voice-section'/);
  assert.match(workspaceSource, /from '\.\/_hooks\/useAudioActiveJobPolling'/);
  assert.match(workspaceSource, /from '\.\/_hooks\/useAudioGeneratedVideos'/);
  assert.match(workspaceSource, /from '\.\/_hooks\/useAudioGenerationRunner'/);
  assert.match(workspaceSource, /from '\.\/_hooks\/useAudioSourceMediaHandlers'/);
  assert.match(workspaceSource, /from '\.\/_hooks\/useAudioWorkspaceRestoration'/);
  assert.match(workspaceSource, /from '\.\/_lib\/audio-workspace-helpers'/);
  assert.match(workspaceSource, /from '\.\/_lib\/audio-workspace-types'/);
});

test('audio workspace does not regain extracted ownership', () => {
  assert.doesNotMatch(workspaceSource, /type SourceVideoState =/, 'source video contract belongs in _lib/audio-workspace-types.ts');
  assert.doesNotMatch(workspaceSource, /type AudioJobDetail =/, 'job detail contract belongs in _lib/audio-workspace-types.ts');
  assert.doesNotMatch(workspaceSource, /const DEFAULT_PACK:/, 'default audio settings belong in _lib/audio-workspace-helpers.ts');
  assert.doesNotMatch(workspaceSource, /function probeVideoDuration\(/, 'browser duration probing belongs in _lib/audio-workspace-helpers.ts');
  assert.doesNotMatch(workspaceSource, /async function uploadAsset\(/, 'upload helper belongs in _lib/audio-workspace-helpers.ts');
  assert.doesNotMatch(workspaceSource, /function AudioModePicker\(/, 'audio controls belong in _components/audio-workspace-controls.tsx');
  assert.doesNotMatch(workspaceSource, /function AudioSelectControl\(/, 'audio controls belong in _components/audio-workspace-controls.tsx');
  assert.doesNotMatch(workspaceSource, /generated-source-skeleton/, 'generated video picker UI belongs in _components/audio-generated-video-picker.tsx');
  assert.doesNotMatch(workspaceSource, /copy\.picker\.audioBadge/, 'generated video picker card UI belongs in _components/audio-generated-video-picker.tsx');
  assert.doesNotMatch(workspaceSource, /copy\.source\.useGenerated/, 'source video section UI belongs in _components/audio-source-video-section.tsx');
  assert.doesNotMatch(workspaceSource, /fixed bottom-0 left-0 right-0/, 'generation dock UI belongs in _components/audio-generation-dock.tsx');
  assert.doesNotMatch(workspaceSource, /copy\.controls\.uploadVoiceSampleHint/, 'voice section UI belongs in _components/audio-voice-section.tsx');
  assert.doesNotMatch(workspaceSource, /getJobStatus/, 'active job polling belongs in useAudioActiveJobPolling');
  assert.doesNotMatch(workspaceSource, /surface=video&limit=60/, 'generated video loading belongs in useAudioGeneratedVideos');
  assert.doesNotMatch(workspaceSource, /runAudioGenerate/, 'audio generation submission belongs in useAudioGenerationRunner');
  assert.doesNotMatch(workspaceSource, /fetchJobDetail\(queryJobId\)/, 'query job restoration belongs in useAudioWorkspaceRestoration');
  assert.doesNotMatch(workspaceSource, /authFetch\('\/api\/jobs\?surface=audio&limit=12'\)/, 'latest audio restoration belongs in useAudioWorkspaceRestoration');
  assert.doesNotMatch(workspaceSource, /const hydrateSourceVideo = useCallback/, 'source hydration belongs in useAudioWorkspaceRestoration');
  assert.doesNotMatch(workspaceSource, /const handleSourceFileSelect = useCallback/, 'source upload handling belongs in useAudioSourceMediaHandlers');
  assert.doesNotMatch(workspaceSource, /const handleVoiceFileSelect = useCallback/, 'voice upload handling belongs in useAudioSourceMediaHandlers');
  assert.doesNotMatch(workspaceSource, /const handleSelectGeneratedVideo = useCallback/, 'generated video selection belongs in useAudioSourceMediaHandlers');
  assert.doesNotMatch(workspaceSource, /resolveUiErrorMessage\(error, copy\.messages\.generationFailed/, 'generation failure mapping belongs in useAudioGenerationRunner');
  assert.doesNotMatch(workspaceSource, /<AudioSelectControl/, 'audio option selectors belong in audio-options-section.tsx');
  assert.doesNotMatch(workspaceSource, /copy\.controls\.providerStack/, 'provider stack UI belongs in audio-options-section.tsx');
  assert.doesNotMatch(workspaceSource, /SlidersHorizontal/, 'advanced options UI belongs in audio-options-section.tsx');
  assert.doesNotMatch(workspaceSource, /<AudioModePicker/, 'audio mode picker composition belongs in audio-workspace-composer-surface.tsx');
  assert.doesNotMatch(workspaceSource, /<AudioGenerationDock/, 'audio generation dock composition belongs in audio-workspace-composer-surface.tsx');
  assert.doesNotMatch(workspaceSource, /<AudioVoiceSection/, 'voice section composition belongs in audio-workspace-composer-surface.tsx');
  assert.doesNotMatch(workspaceSource, /copy\.hero\.title/, 'audio hero UI belongs in audio-workspace-composer-surface.tsx');
  assert.doesNotMatch(workspaceSource, /copy\.controls\.estimatedDuration/, 'script composer UI belongs in audio-workspace-composer-surface.tsx');

  const lineCount = workspaceSource.split('\n').length;
  assert.ok(lineCount <= 520, `AudioWorkspace should stay below 520 lines after media/restoration extraction, got ${lineCount}`);
});

test('audio helper modules expose the expected workspace contract', () => {
  const controlsSource = readFileSync(controlsPath, 'utf8');
  const generatedPickerSource = readFileSync(generatedPickerPath, 'utf8');
  const optionsSectionSource = readFileSync(optionsSectionPath, 'utf8');
  const sourceVideoSectionSource = readFileSync(sourceVideoSectionPath, 'utf8');
  const generationDockSource = readFileSync(generationDockPath, 'utf8');
  const voiceSectionSource = readFileSync(voiceSectionPath, 'utf8');
  const helpersSource = readFileSync(helpersPath, 'utf8');
  const typesSource = readFileSync(typesPath, 'utf8');
  const activeJobHookSource = readFileSync(activeJobHookPath, 'utf8');
  const generatedVideosHookSource = readFileSync(generatedVideosHookPath, 'utf8');
  const generationRunnerHookSource = readFileSync(generationRunnerHookPath, 'utf8');
  const sourceMediaHandlersHookSource = readFileSync(sourceMediaHandlersHookPath, 'utf8');
  const restorationHookSource = readFileSync(restorationHookPath, 'utf8');

  for (const exportName of [
    'AudioModePicker',
    'AudioSelectControl',
    'ToggleRow',
  ]) {
    assert.match(controlsSource, new RegExp(`export function ${exportName}`), `${exportName} should be exported`);
  }

  assert.match(
    generatedPickerSource,
    /export function AudioGeneratedVideoPickerModal/,
    'AudioGeneratedVideoPickerModal should be exported'
  );
  assert.match(composerSurfaceSource, /export function AudioWorkspaceComposerSurface/, 'AudioWorkspaceComposerSurface should be exported');
  assert.match(composerSurfaceSource, /AudioModePicker/, 'composer surface should own mode picker composition');
  assert.match(composerSurfaceSource, /AudioGenerationDock/, 'composer surface should own generation dock composition');
  assert.match(composerSurfaceSource, /AudioLatestRendersRail/, 'composer surface should own mobile latest renders rail');
  assert.match(optionsSectionSource, /export function AudioOptionsSection/, 'AudioOptionsSection should be exported');
  assert.match(optionsSectionSource, /AudioSelectControl/, 'audio options section should own select controls');
  assert.match(optionsSectionSource, /resolveProviderLabel/, 'audio options section should own provider stack rendering');
  assert.match(optionsSectionSource, /SlidersHorizontal/, 'audio options section should own advanced options UI');
  assert.match(sourceVideoSectionSource, /export function AudioSourceVideoSection/, 'AudioSourceVideoSection should be exported');
  assert.match(sourceVideoSectionSource, /copy\.source\.useGenerated/, 'source video section should own generated picker trigger copy');
  assert.match(generationDockSource, /export function AudioGenerationDock/, 'AudioGenerationDock should be exported');
  assert.match(generationDockSource, /fixed bottom-0 left-0 right-0/, 'generation dock should own fixed dock layout');
  assert.match(voiceSectionSource, /export function AudioVoiceSection/, 'AudioVoiceSection should be exported');
  assert.match(voiceSectionSource, /copy\.controls\.uploadVoiceSampleHint/, 'voice section should own voice sample copy');
  assert.match(activeJobHookSource, /export function useAudioActiveJobPolling/, 'active job polling hook should be exported');
  assert.match(activeJobHookSource, /getJobStatus/, 'active job polling hook should poll job status');
  assert.match(generatedVideosHookSource, /export function useAudioGeneratedVideos/, 'generated videos hook should be exported');
  assert.match(generatedVideosHookSource, /surface=video&limit=60/, 'generated videos hook should load video jobs');
  assert.match(generationRunnerHookSource, /export function useAudioGenerationRunner/, 'generation runner hook should be exported');
  assert.match(generationRunnerHookSource, /runAudioGenerate/, 'generation runner hook should submit generation requests');
  assert.match(generationRunnerHookSource, /resolveUiErrorMessage/, 'generation runner hook should map generation failures');
  assert.match(sourceMediaHandlersHookSource, /export function useAudioSourceMediaHandlers/, 'source media handlers hook should be exported');
  assert.match(sourceMediaHandlersHookSource, /handleSourceFileSelect/, 'source media handlers hook should own source upload selection');
  assert.match(sourceMediaHandlersHookSource, /handleVoiceFileSelect/, 'source media handlers hook should own voice sample upload selection');
  assert.match(sourceMediaHandlersHookSource, /handleSelectGeneratedVideo/, 'source media handlers hook should own generated video source selection');
  assert.match(restorationHookSource, /export function useAudioWorkspaceRestoration/, 'restoration hook should be exported');
  assert.match(restorationHookSource, /fetchJobDetail\(queryJobId\)/, 'restoration hook should load query jobs');
  assert.match(restorationHookSource, /surface=audio&limit=12/, 'restoration hook should restore latest audio jobs');
  assert.match(restorationHookSource, /hydrateSourceVideo/, 'restoration hook should own source video hydration');

  for (const exportName of [
    'DEFAULT_PACK',
    'DEFAULT_MOOD',
    'DEFAULT_INTENSITY',
    'AUDIO_VOICE_GENDER_VALUES',
    'resolveProviderLabel',
    'formatDateTime',
    'formatCopy',
    'formatCurrency',
    'resolveUiErrorMessage',
    'inferOutputKind',
    'probeVideoDuration',
    'uploadAsset',
    'fetchJobDetail',
  ]) {
    assert.match(helpersSource, new RegExp(`export (const|function|async function) ${exportName}`), `${exportName} should be exported`);
  }

  for (const typeName of [
    'SourceVideoState',
    'GeneratedSourceVideo',
    'AudioJobSettingsSnapshot',
    'AudioJobDetail',
    'ActiveAudioJobState',
    'AudioResultState',
  ]) {
    assert.match(typesSource, new RegExp(`export type ${typeName}`), `${typeName} should be exported`);
  }
});

test('audio generation dock keeps icon-only controls accessible', () => {
  const generationDockSource = readFileSync(generationDockPath, 'utf8');

  assert.match(generationDockSource, /aria-label="Audio generation options"/);
  assert.match(generationDockSource, /<ChevronDown className="h-4 w-4" aria-hidden/);
});

test('audio upload inputs stay hidden from keyboard traversal', () => {
  const sourceVideoSectionSource = readFileSync(sourceVideoSectionPath, 'utf8');
  const voiceSectionSource = readFileSync(voiceSectionPath, 'utf8');

  for (const inputBlock of [
    getFileInputBlock(sourceVideoSectionSource, 'video/*'),
    getFileInputBlock(voiceSectionSource, 'audio/*'),
  ]) {
    assert.match(inputBlock, /type="file"/);
    assert.match(inputBlock, /aria-hidden="true"/);
    assert.match(inputBlock, /tabIndex=\{-1\}/);
  }
});

test('audio history renders playable audio files inline', () => {
  assert.match(latestRendersRailSource, /<audio/, 'audio history should mount an audio element for audio jobs');
  assert.match(latestRendersRailSource, /controls/, 'audio history audio element should expose native playback controls');
  assert.match(latestRendersRailSource, /src=\{job\.audioUrl\}/, 'audio history should play the stored job audio URL');
  assert.doesNotMatch(latestRendersRailSource, /0:00 \//, 'audio history should not render a fake playback timestamp');
  assert.doesNotMatch(latestRendersRailSource, /<UIIcon icon=\{Play\}/, 'audio history should not render a fake play button');
});

test('audio workspace keeps voice script duration estimates internal for pricing', () => {
  const generationDockSource = readFileSync(generationDockPath, 'utf8');

  assert.match(workspaceSource, /quotePublicAudioPricingSnapshot\(\{[\s\S]*durationSec: estimatedDurationSec/, 'pricing should keep using the internal estimated duration');
  assert.match(workspaceSource, /const displayDurationSec = pack === 'voice_only' \? null : estimatedDurationSec/, 'voice-only duration estimates should be hidden from the UI');
  assert.doesNotMatch(composerSurfaceSource, /copy\.controls\.estimatedDuration/, 'script composer should not display estimated read duration');
  assert.match(generationDockSource, /\{durationLabel \? \(/, 'generation dock should render the duration card only when a display duration exists');
});

test('audio generation publishes job status updates for history refresh', () => {
  const generationRunnerSource = readFileSync(generationRunnerHookPath, 'utf8');

  assert.match(generationRunnerSource, /new CustomEvent\('jobs:status'/, 'audio generation should notify job history listeners');
  assert.match(generationRunnerSource, /audioUrl: response\.audioUrl \?\? null/, 'audio generation status event should include audio media');
  assert.match(generationRunnerSource, /pricing: response\.pricing/, 'audio generation status event should include pricing metadata');
});

test('audio workspace supports parallel generations with an in-progress banner', () => {
  const generationRunnerSource = readFileSync(generationRunnerHookPath, 'utf8');
  const generationDockSource = readFileSync(generationDockPath, 'utf8');

  assert.match(workspaceSource, /pendingAudioGenerations/, 'audio workspace should track multiple local pending generations');
  assert.match(workspaceSource, /setPendingAudioGenerations/, 'audio workspace should expose pending generation updates to the runner');
  assert.doesNotMatch(workspaceSource, /!isGenerating\s*&&/, 'audio generation should not be globally blocked while another run is in flight');
  assert.match(composerSurfaceSource, /inProgressMessage/, 'composer surface should accept an in-progress banner message');
  assert.match(composerSurfaceSource, /aria-live="polite"/, 'in-progress banner should announce updates politely');
  assert.match(generationRunnerSource, /crypto\.randomUUID/, 'audio runner should create a local pending generation id before the server responds');
  assert.match(generationRunnerSource, /setPendingAudioGenerations/, 'audio runner should add and remove local pending generations');
  assert.doesNotMatch(generationDockSource, /copy\.pricing\.generating/, 'generate button should remain available while other audio runs continue');
});

test('audio voice sample placeholder renders below audio options', () => {
  const optionsIndex = composerSurfaceSource.indexOf('<AudioOptionsSection');
  const voiceSampleIndex = composerSurfaceSource.indexOf('<AudioVoiceSection');

  assert.notEqual(optionsIndex, -1, 'composer surface should render audio options');
  assert.notEqual(voiceSampleIndex, -1, 'composer surface should render the voice sample placeholder');
  assert.ok(
    optionsIndex < voiceSampleIndex,
    'voice sample placeholder should render below the audio options section'
  );
});

test('audio voice selection uses a compact dropdown with sample playback in the menu', () => {
  const optionsSectionSource = readFileSync(optionsSectionPath, 'utf8');

  assert.match(optionsSectionSource, /function SeedAudioVoiceDropdown/, 'voice selector should use a dedicated dropdown');
  assert.match(optionsSectionSource, /<summary/, 'voice selector should render a compact select-style trigger');
  assert.match(optionsSectionSource, /role="listbox"/, 'voice selector menu should expose listbox semantics');
  assert.match(optionsSectionSource, /<audio/, 'voice selector menu should support sample playback');
  assert.match(optionsSectionSource, /document\.addEventListener\('pointerdown'/, 'voice selector should listen for outside clicks');
  assert.match(optionsSectionSource, /dropdownRef\.current\?\.contains/, 'voice selector should only close when the click is outside');
  assert.doesNotMatch(optionsSectionSource, /grid-cols-\[minmax\(0,1fr\)_minmax\(128px,0\.8fr\)\]/, 'voice selector should not render persistent voice cards');
  assert.doesNotMatch(optionsSectionSource, /seedAudioSampleText/, 'sample text should not be rendered in the picker UI');
});

test('audio workspace keeps music and cinematic modes while adding Seed Audio voice-over', () => {
  assert.equal(DEFAULT_PACK, 'music_only');
  assert.deepEqual(buildAudioModeOptions(DEFAULT_AUDIO_WORKSPACE_COPY), [
    {
      id: 'music_only',
      label: 'Music Only',
      description: 'Background music or ambience.',
    },
    {
      id: 'voice_only',
      label: 'Voice Over',
      description: 'Seed Audio narration as an audio file.',
    },
    {
      id: 'cinematic',
      label: 'Cinematic',
      description: 'SFX + optional background music.',
    },
    {
      id: 'cinematic_voice',
      label: 'Cinematic + Voice',
      description: 'SFX + background music + VO.',
    },
  ]);
  assert.equal(resolveProviderLabel(DEFAULT_AUDIO_WORKSPACE_COPY, 'voice_only'), 'Seed Audio 1.0');
});
