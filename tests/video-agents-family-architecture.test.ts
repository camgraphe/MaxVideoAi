import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const videoAgentsDir = join(root, 'frontend/app/(core)/(workspace)/app/video-agents');
const pagePath = join(videoAgentsDir, 'page.tsx');
const workspacePath = join(videoAgentsDir, 'VideoAgentsWorkspace.tsx');
const settingsStripPath = join(videoAgentsDir, '_components/VideoAgentSettingsStrip.tsx');
const chatPath = join(videoAgentsDir, '_components/VideoAgentChat.tsx');
const previewPath = join(videoAgentsDir, '_components/VideoAgentPreview.tsx');
const configPath = join(videoAgentsDir, '_lib/video-agent-config.ts');
const visitorAccessPath = join(root, 'frontend/lib/visitor-access.ts');
const appSidebarPath = join(root, 'frontend/components/AppSidebar.tsx');

test('video agents family is a top-level workspace app route', () => {
  assert.ok(existsSync(pagePath), 'video agents should live at /app/video-agents, not /app/tools');
  const pageSource = readFileSync(pagePath, 'utf8');

  assert.match(pageSource, /HeaderBar/, 'route should use the app header');
  assert.match(pageSource, /AppSidebar/, 'route should use the app sidebar');
  assert.match(pageSource, /VideoAgentsWorkspace/, 'page.tsx should delegate rendering to the route workspace');
  assert.doesNotMatch(pageSource, /tools\/commercial-video/, 'video agents must not be implemented under app tools');
});

test('video agents UI responsibilities stay route-local and split', () => {
  [workspacePath, settingsStripPath, chatPath, previewPath, configPath].forEach((path) => {
    assert.ok(existsSync(path), `${path} should exist`);
  });

  const workspaceSource = readFileSync(workspacePath, 'utf8');
  assert.match(workspaceSource, /VideoAgentSettingsStrip/, 'settings strip should be split from the workspace');
  assert.match(workspaceSource, /VideoAgentChat/, 'chat surface should be split from the workspace');
  assert.match(workspaceSource, /VideoAgentPreview/, 'preview surface should be split from the workspace');
  assert.doesNotMatch(workspaceSource, /\/api\/generate/, 'mockup workspace should not duplicate generation submission');
});

test('video agent chat keeps a fixed panel and scrollable conversation', () => {
  const chatSource = readFileSync(chatPath, 'utf8');

  assert.match(chatSource, /h-\[580px\].*md:h-\[640px\]/, 'chat panel should keep a stable height');
  assert.match(chatSource, /overflow-hidden/, 'chat panel should not grow with message content');
  assert.match(chatSource, /overflow-y-auto/, 'conversation stream should be the scrollable region');
  assert.match(chatSource, /scrollTop\s*=\s*messagesElement\.scrollHeight/, 'new messages should keep the conversation pinned to the latest reply');
});

test('seedance commercial preset is configuration-driven for future engines', () => {
  const configSource = readFileSync(configPath, 'utf8');

  assert.match(configSource, /agentType:\s*'commercial-video'/, 'commercial agent preset should be explicit');
  assert.match(configSource, /engineFamily:\s*'seedance'/, 'Seedance should be an engine family setting');
  assert.match(configSource, /engineId:\s*'seedance-2-0'/, 'V1 should default to Seedance 2.0');
  assert.match(configSource, /estimateVideoAgentPriceCents/, 'pricing estimate should be owned by config helpers');
});

test('video agents route is available to the public workspace visitor flow', () => {
  const visitorAccessSource = readFileSync(visitorAccessPath, 'utf8');

  assert.match(
    visitorAccessSource,
    /normalized === '\/app\/video-agents'/,
    'the public explainer/chat agent should render before login'
  );
});

test('video agents appears as a first-class app family in the sidebar', () => {
  const appSidebarSource = readFileSync(appSidebarPath, 'utf8');

  assert.match(appSidebarSource, /id:\s*'video-agents'/, 'sidebar should expose Video Agents as its own app family');
  assert.match(appSidebarSource, /href:\s*'\/app\/video-agents'/, 'sidebar should link to the top-level video agents route');
  assert.doesNotMatch(appSidebarSource, /href:\s*'\/app\/tools\/video-agents'/, 'video agents should not be nested under tools');
});
