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
const promptPreviewPath = join(videoAgentsDir, '_components/VideoAgentPromptPreview.tsx');
const configPath = join(videoAgentsDir, '_lib/video-agent-config.ts');
const flowPath = join(videoAgentsDir, '_hooks/useVideoAgentFlow.ts');
const apiContractPath = join(videoAgentsDir, '_lib/video-agent-api.ts');
const apiRoutePath = join(root, 'frontend/app/api/video-agents/commercial/chat/route.ts');
const apiOpenAiPath = join(root, 'frontend/app/api/video-agents/commercial/chat/_lib/video-agent-openai.ts');
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

test('video agent chat accepts multiline commercial briefs', () => {
  const chatSource = readFileSync(chatPath, 'utf8');

  assert.match(chatSource, /<textarea/, 'chat composer should support pasted multiline briefs');
  assert.doesNotMatch(chatSource, /<input/, 'commercial intake should not be limited to one-line input');
});

test('seedance commercial preset is configuration-driven for future engines', () => {
  const configSource = readFileSync(configPath, 'utf8');

  assert.match(configSource, /agentType:\s*'commercial-video'/, 'commercial agent preset should be explicit');
  assert.match(configSource, /engineFamily:\s*'seedance'/, 'Seedance should be an engine family setting');
  assert.match(configSource, /engineId:\s*'seedance-2-0'/, 'V1 should default to Seedance 2.0');
  assert.match(configSource, /generationMode:\s*'t2v'/, 'V1 should force text-to-video mode');
  assert.match(configSource, /defaultModel:\s*'gpt-5\.4-mini'/, 'Video Agents should document the default orchestration LLM');
  assert.match(configSource, /futureImageEngineFamily:\s*'seedream'/, 'future image preparation should be modeled as Seedream-ready config');
  assert.match(configSource, /estimateVideoAgentPriceCents/, 'pricing estimate should be owned by config helpers');
});

test('video agents V1 does not expose image reference inputs', () => {
  const chatSource = readFileSync(chatPath, 'utf8');

  assert.doesNotMatch(chatSource, /Add product image/, 'V1 prototype should not expose product image upload');
  assert.doesNotMatch(chatSource, /ImageIcon/, 'V1 prototype should not render image upload icons');
});

test('video agent flow builds prompt package only after confirmation', () => {
  const flowSource = readFileSync(flowPath, 'utf8');
  const apiContractSource = readFileSync(apiContractPath, 'utf8');

  assert.match(
    flowSource,
    /VIDEO_AGENT_CHAT_API_PATH/,
    'flow should call the route-local video agent chat API'
  );
  assert.match(apiContractSource, /\/api\/video-agents\/commercial\/chat/, 'API path should stay centralized');
  assert.match(flowSource, /isThinking/, 'flow should expose a thinking state while the agent works');
  assert.match(
    flowSource,
    /confirmPrototype[\s\S]*prepare-prompt/,
    'flow should prepare the final prompt package only after user confirmation'
  );
  assert.doesNotMatch(flowSource, /from ['"]openai['"]/, 'client flow must not import the OpenAI SDK');
});

test('video agent LLM work is isolated behind a server route with fallback behavior', () => {
  assert.ok(existsSync(apiRoutePath), 'video agent chat should be handled by a server route');
  assert.ok(existsSync(apiOpenAiPath), 'OpenAI calls should live in a route-local server helper');

  const routeSource = readFileSync(apiRoutePath, 'utf8');
  const openAiSource = readFileSync(apiOpenAiPath, 'utf8');

  assert.match(routeSource, /runtime\s*=\s*['"]nodejs['"]/, 'OpenAI SDK work should run in the Node runtime');
  assert.match(routeSource, /POST/, 'chat route should expose a POST handler');
  assert.match(openAiSource, /from ['"]openai['"]/, 'OpenAI SDK should only be imported by the server helper');
  assert.match(openAiSource, /OPENAI_API_KEY/, 'server helper should read the API key on the server');
  assert.match(openAiSource, /local-fallback/, 'route helper should keep a deterministic fallback path');
});

test('video agent preview has a dedicated prompt package inspector', () => {
  assert.ok(existsSync(promptPreviewPath), 'visible prompt package output should live in a split component');

  const previewSource = readFileSync(previewPath, 'utf8');
  const promptPreviewSource = readFileSync(promptPreviewPath, 'utf8');

  assert.match(previewSource, /VideoAgentPromptPreview/, 'preview should render the prompt inspector after confirmation');
  assert.match(promptPreviewSource, /finalPrompt/, 'prompt inspector should expose the final prompt for manual tests');
  assert.match(promptPreviewSource, /structuredScenario/, 'prompt inspector should expose the generated scenario beats');
  assert.match(promptPreviewSource, /navigator\.clipboard/, 'prompt inspector should support copying the prompt');
});

test('prompt-ready preview does not waste space on disabled video actions', () => {
  const previewSource = readFileSync(previewPath, 'utf8');

  assert.match(
    previewSource,
    /phase !== 'prompt-ready'[\s\S]*VIDEO_AGENT_COPY\.preview\.actions\.regenerate/,
    'disabled video actions should be hidden once the prompt package is visible'
  );
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
