import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const timelineStyles = readFileSync(resolve('frontend/app/(core)/(workspace)/app/studio/workspace/_styles/timeline.module.css'), 'utf8');
const shellStyles = readFileSync(resolve('frontend/app/(core)/(workspace)/app/studio/workspace/_styles/shell.module.css'), 'utf8');
const trackRow = readFileSync(resolve('frontend/app/(core)/(workspace)/app/studio/workspace/_components/timeline/TimelineTrackRow.tsx'), 'utf8');
const trackMenus = readFileSync(resolve('frontend/app/(core)/(workspace)/app/studio/workspace/_components/timeline/TimelineContextMenus.tsx'), 'utf8');

test('the default timeline gives the creative surface back vertical room', () => {
  assert.match(shellStyles, /--timeline-panel-fallback-height:\s*220px/);
  assert.match(timelineStyles, /\.timelineTrack\s*\{[^}]*height:\s*64px;[^}]*min-height:\s*64px;/s);
  assert.match(timelineStyles, /@media\(max-width:620px\)[\s\S]*\.timelineTrack\s*\{\s*height:64px;\s*min-height:64px;/u);
  assert.doesNotMatch(timelineStyles, /\.timelineTrack\s*\{\s*min-height:94px/u);
  assert.match(timelineStyles, /@media\(max-height:500px\) and \(min-width:621px\)[\s\S]*\.timelineViewport\s*\{\s*scrollbar-width:none;[\s\S]*\.timelineRuler\s*\{\s*position:relative;/u);
  assert.doesNotMatch(timelineStyles, /\.trackLabel\s*\{[^}]*flex-wrap:\s*wrap/s);
});

test('compact rows keep quick media state visible and move the overflowing lock command into the tactile menu', () => {
  assert.match(trackRow, /data-timeline-track-actions=\{track\.id\}/);
  assert.match(trackRow, /data-timeline-video-visibility/);
  assert.match(trackRow, /data-timeline-audio-mute/);
  assert.match(trackRow, /data-timeline-track-lock/);
  assert.match(timelineStyles, /@media \(max-width: 1120px\)[\s\S]*\.trackLockButton\s*\{[^}]*display:\s*none/s);
  assert.match(trackMenus, /toggle-lock/);
});

test('the expanded track menu reserves enough viewport room for lock, add and delete', () => {
  const contextMenus = readFileSync(resolve('frontend/app/(core)/(workspace)/app/studio/workspace/_components/timeline/useTimelineContextMenus.ts'), 'utf8');

  assert.match(contextMenus, /TRACK_CONTEXT_MENU_ESTIMATED_HEIGHT = 188/u);
  assert.match(contextMenus, /viewportHeight - TRACK_CONTEXT_MENU_ESTIMATED_HEIGHT/u);
  assert.doesNotMatch(contextMenus, /trackMenu[\s\S]{0,900}viewportHeight - 160/u);
});
