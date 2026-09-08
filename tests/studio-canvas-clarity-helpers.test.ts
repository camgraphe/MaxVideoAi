import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import {
  projectWorkspaceShotConnectorPresentation,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-shot-connector-presentation';
import {
  workspaceCanvasFitViewOptions,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-canvas-fit';
import type {
  WorkspaceEdgeKind,
  WorkspaceInputConnector,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-types';

const handles: WorkspaceEdgeKind[] = ['prompt', 'start_image', 'end_image', 'reference', 'audio'];

function connector(
  kind: WorkspaceEdgeKind,
  patch: Partial<WorkspaceInputConnector> = {},
): WorkspaceInputConnector {
  return {
    kind,
    label: kind,
    required: false,
    sourceType: 'control',
    maxCount: 1,
    connectedCount: 0,
    remainingCount: 1,
    capacityLabel: '1/1',
    ...patch,
  };
}

test('shot connector presentation keeps required, connected and incomplete inputs visible without changing order or metadata', () => {
  const connectors = [
    connector('prompt', { required: true }),
    connector('start_image', { connectedCount: 1, remainingCount: 0, capacityLabel: '0/1' }),
    connector('end_image'),
    connector('reference', { connectedCount: 9, remainingCount: 0, maxCount: 9, capacityLabel: '0/9', disabledReason: 'Full' }),
  ];
  const snapshot = structuredClone(connectors);
  const projected = projectWorkspaceShotConnectorPresentation(handles, connectors);

  assert.deepEqual(projected.visible.map(({ handle }) => handle), ['prompt', 'start_image', 'reference', 'audio']);
  assert.deepEqual(projected.optionalEmpty.map(({ handle }) => handle), ['end_image']);
  assert.equal(projected.visible[1]?.connector, connectors[1]);
  assert.equal(projected.visible[2]?.connector?.disabledReason, 'Full', 'a full connected collection stays repairable');
  assert.equal(projected.visible[3]?.connector, null, 'missing metadata fails open visually');
  assert.deepEqual(connectors, snapshot, 'presentation never mutates policy facts');
});

test('shot connector presentation preserves distinct semantic handles and every budget object', () => {
  const connectors = handles.map((handle, index) => connector(handle, {
    maxCount: index + 1,
    remainingCount: index + 1,
    capacityLabel: `${index + 1}/${index + 1}`,
  }));
  const projected = projectWorkspaceShotConnectorPresentation(handles, connectors);
  const all = [...projected.visible, ...projected.optionalEmpty];

  assert.deepEqual(all.map(({ handle }) => handle).sort(), [...handles].sort());
  assert.equal(new Set(all.map(({ handle }) => handle)).size, handles.length);
  for (const entry of all) {
    assert.equal(entry.connector, connectors.find(({ kind }) => kind === entry.handle));
  }
});

test('canvas fit reserves the shared useful surface and adapts the map inset without overwriting viewport policy', () => {
  assert.deepEqual(workspaceCanvasFitViewOptions({ viewportWidth: 1440, viewportHeight: 900, mapExpanded: true }), {
    includeHiddenNodes: false,
    padding: { top: '76px', right: '204px', bottom: '86px', left: '24px' },
  });
  assert.deepEqual(workspaceCanvasFitViewOptions({ viewportWidth: 390, viewportHeight: 844, mapExpanded: false }), {
    includeHiddenNodes: false,
    padding: { top: '128px', right: '20px', bottom: '128px', left: '20px' },
  });
  assert.deepEqual(workspaceCanvasFitViewOptions({ viewportWidth: 601, viewportHeight: 844, mapExpanded: true }), {
    includeHiddenNodes: false,
    padding: { top: '128px', right: '204px', bottom: '128px', left: '20px' },
  });
  assert.deepEqual(workspaceCanvasFitViewOptions({ viewportWidth: 700, viewportHeight: 844, mapExpanded: true }), {
    includeHiddenNodes: false,
    padding: { top: '128px', right: '204px', bottom: '128px', left: '20px' },
  });
  assert.deepEqual(workspaceCanvasFitViewOptions({ viewportWidth: 844, viewportHeight: 390, mapExpanded: false }), {
    includeHiddenNodes: false,
    padding: { top: '8px', right: '152px', bottom: '64px', left: '312px' },
  });
  assert.deepEqual(workspaceCanvasFitViewOptions({ viewportWidth: 667, viewportHeight: 375, mapExpanded: false }), {
    includeHiddenNodes: false,
    padding: { top: '8px', right: '152px', bottom: '64px', left: '312px' },
  });
  assert.deepEqual(workspaceCanvasFitViewOptions({ viewportWidth: 621, viewportHeight: 375, mapExpanded: false }), {
    includeHiddenNodes: false,
    padding: { top: '8px', right: '152px', bottom: '64px', left: '312px' },
  });
});

test('both initial and explicit fit consume the same useful-surface helper and handles refresh their React Flow internals', () => {
  const canvas = readFileSync(resolve('frontend/app/(core)/(workspace)/app/studio/workspace/_components/WorkspaceCanvas.client.tsx'), 'utf8');
  const map = readFileSync(resolve('frontend/app/(core)/(workspace)/app/studio/workspace/_components/canvas/CanvasMap.tsx'), 'utf8');
  const dock = readFileSync(resolve('frontend/app/(core)/(workspace)/app/studio/workspace/_components/nodes/workspace-shot-input-dock.tsx'), 'utf8');
  const actionStyles = readFileSync(resolve('frontend/app/(core)/(workspace)/app/studio/workspace/_styles/canvas-actions.module.css'), 'utf8');
  const mapStyles = readFileSync(resolve('frontend/app/(core)/(workspace)/app/studio/workspace/_styles/canvas-map.module.css'), 'utf8');
  const navigatorStyles = readFileSync(resolve('frontend/app/(core)/(workspace)/app/studio/workspace/_styles/canvas-navigator.module.css'), 'utf8');
  const toolbarStyles = readFileSync(resolve('frontend/app/(core)/(workspace)/app/studio/workspace/_styles/canvas-toolbar.module.css'), 'utf8');
  const shellStyles = readFileSync(resolve('frontend/app/(core)/(workspace)/app/studio/workspace/_styles/shell.module.css'), 'utf8');

  assert.match(canvas, /fitViewOptions=\{workspaceCanvasFitViewOptions\(/);
  assert.match(canvas, /fitView=\{!initialViewport\}/, 'saved viewports remain authoritative');
  assert.match(canvas, /mapExpanded: typeof window === 'undefined' \|\| \(window\.innerWidth > 600 && window\.innerHeight > 500\)/);
  assert.match(map, /reactFlow\.fitView\(\{[\s\S]*workspaceCanvasFitViewOptions\(/);
  assert.match(dock, /useUpdateNodeInternals\(\)/);
  assert.match(dock, /outputs\.join\(/, 'output-handle changes also refresh React Flow internals');
  assert.match(dock, /data-shot-hidden-connector-anchor/);
  assert.match(shellStyles, /@media\(max-height:500px\) and \(min-width:621px\)[\s\S]*\.canvasEditorBody \{ padding-top:0; \}/);
  assert.match(shellStyles, /@media\(max-height:500px\) and \(min-width:621px\)[\s\S]*\.canvasEditorBody \.mobilePanelRail \{ display:none; \}/);
  assert.doesNotMatch(actionStyles, /\.selectionActions\s*\{[^}]*top:12px;[^}]*left:50%/s, 'selection commands must not cover the canvas as a wide floating bar');
  assert.match(toolbarStyles, /\.canvasToolbar\s*\{[^}]*height:\s*44px;/s);
  assert.match(navigatorStyles, /@media\(max-height:500px\) and \(min-width:621px\)[\s\S]*\.canvasNavigator \{[\s\S]*top:70px;[\s\S]*left:8px;/);
  assert.match(navigatorStyles, /@media\(max-height:500px\) and \(min-width:621px\)[\s\S]*\.navigatorPanel \{[\s\S]*position:fixed;[\s\S]*top:8px;[\s\S]*bottom:8px;/);
  assert.match(navigatorStyles, /@media \(max-width: 760px\) \{[\s\S]*\.canvasNavigator \{[\s\S]*top:\s*76px;[\s\S]*bottom:\s*auto;/);
  assert.match(navigatorStyles, /\.navigatorPanel \{[\s\S]*box-sizing:border-box;[\s\S]*overflow:\s*auto;/);
  assert.match(navigatorStyles, /\.navigatorPanel \{[\s\S]*position:\s*fixed;[\s\S]*top:\s*60px;[\s\S]*max-height:\s*calc\(100dvh - 72px\)/);
  assert.match(navigatorStyles, /@media \(max-width: 760px\) \{[\s\S]*\.navigatorPanel \{[\s\S]*position:fixed;[\s\S]*bottom:12px;/);
  assert.match(mapStyles, /@media\(max-height:500px\) and \(min-width:621px\)[\s\S]*\.canvasNavigatorCollapsed \{[\s\S]*width:132px;/);
  assert.match(navigatorStyles, /\.navigatorTrigger \{[\s\S]*min-height: 44px;/);
  assert.match(map, /const collapseMapForFit = window\.innerWidth <= 600 \|\| window\.innerHeight <= 500/);
  assert.match(map, /setIsOpen\(false\)[\s\S]*mapExpanded: collapseMapForFit \? false : isOpen/);
});

test('Connections explains separate remaining capacity and restores focus to its persistent card command', () => {
  const picker = readFileSync(resolve('frontend/app/(core)/(workspace)/app/studio/workspace/_components/canvas/CanvasConnectionPicker.tsx'), 'utf8');

  assert.match(picker, /copy\.remainingCapacity/);
  assert.match(picker, /connector\.remainingCount/);
  assert.match(picker, /connector\.maxCount/);
  assert.match(picker, /data-canvas-connections-fallback/);
  assert.match(picker, /data-studio-canvas-shell/);
});

test('Settings keeps card and keyboard access while actions stay in the selected card', () => {
  const canvas = readFileSync(resolve('frontend/app/(core)/(workspace)/app/studio/workspace/_components/WorkspaceCanvas.client.tsx'), 'utf8');
  const selectionActions = readFileSync(resolve('frontend/app/(core)/(workspace)/app/studio/workspace/_components/canvas/CanvasSelectionActions.tsx'), 'utf8');
  const selectionHook = readFileSync(resolve('frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceSelectionActions.ts'), 'utf8');
  const nodeFrame = readFileSync(resolve('frontend/app/(core)/(workspace)/app/studio/workspace/_components/nodes/workspace-node-frame.tsx'), 'utf8');
  const shotControls = readFileSync(resolve('frontend/app/(core)/(workspace)/app/studio/workspace/_components/nodes/workspace-shot-node-controls.tsx'), 'utf8');

  assert.doesNotMatch(selectionActions, /data-canvas-selection-settings/u);
  assert.match(nodeFrame, /data-canvas-node-inspect-button=\{nodeId\}[\s\S]*aria-label=/u);
  assert.match(nodeFrame, /CanvasNodeActionsMenu/u);
  assert.match(canvas, /event\.key\.toLowerCase\(\) !== 'i'[\s\S]*onInspectNode\(selectedNodeId\)/u);
  assert.match(selectionHook, /lastInspectedCanvasNodeIdRef[\s\S]*data-canvas-node-inspect-button/u);
  assert.doesNotMatch(selectionHook, /data-canvas-selection-settings/u);
  assert.doesNotMatch(shotControls, /shotOptionsButton/u);
});

test('compact add palette stays above the editor shell and inside short landscape viewports', () => {
  const toolbarStyles = readFileSync(resolve('frontend/app/(core)/(workspace)/app/studio/workspace/_styles/canvas-toolbar.module.css'), 'utf8');
  const shellStyles = readFileSync(resolve('frontend/app/(core)/(workspace)/app/studio/workspace/_styles/shell.module.css'), 'utf8');

  assert.match(toolbarStyles, /data-canvas-toolbar-popover-open='true'[\s\S]*z-index:\s*140/u);
  assert.match(toolbarStyles, /\.toolbarPopover\s*\{[\s\S]*box-sizing:\s*border-box/u);
  assert.match(toolbarStyles, /@media \(max-width: 760px\)[\s\S]*max-height:min\(40dvh,340px\)/u);
  assert.match(shellStyles, /toolbarPopover[\s\S]*navigatorPanel[\s\S]*max-height:\s*min\(40dvh, 340px\)/u);
  assert.match(toolbarStyles, /@media \(max-height: 500px\)[\s\S]*max-height:\s*min\(37dvh, 144px\)/u);
  assert.match(shellStyles, /@media\(max-height:500px\) and \(min-width:621px\)[\s\S]*toolbarPopover[\s\S]*max-height:min\(37dvh,144px\)/u);
});
