import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const tabsPath = join(root, 'frontend/components/marketing/SoraPromptingTabs.client.tsx');
const tabListPath = join(root, 'frontend/components/marketing/SoraPromptingTabList.tsx');
const tabPanelPath = join(root, 'frontend/components/marketing/SoraPromptingTabPanel.tsx');
const sidebarPath = join(root, 'frontend/components/marketing/SoraPromptingSidebar.tsx');
const contentPath = join(root, 'frontend/components/marketing/sora-prompting-content.ts');

const readSource = (path: string) => readFileSync(path, 'utf8');
const lineCount = (source: string) => source.split('\n').length;

test('sora prompting tabs delegate tab chrome, panels, sidebar, and template content', () => {
  for (const path of [tabsPath, tabListPath, tabPanelPath, sidebarPath, contentPath]) {
    assert.ok(existsSync(path), `${path} should exist`);
  }

  const tabsSource = readSource(tabsPath);
  const tabListSource = readSource(tabListPath);
  const tabPanelSource = readSource(tabPanelPath);
  const sidebarSource = readSource(sidebarPath);
  const contentSource = readSource(contentPath);

  assert.match(tabsSource, /<SoraPromptingTabList/, 'SoraPromptingTabs should compose a focused tab list');
  assert.match(tabsSource, /<SoraPromptingTabPanel/, 'SoraPromptingTabs should compose focused tab panels');
  assert.match(tabsSource, /<SoraPromptingSidebar/, 'SoraPromptingTabs should compose a focused sidebar');
  assert.doesNotMatch(tabsSource, /STRUCTURED_TEMPLATE|CopyPromptButton|role="tab"|Global principles/, 'SoraPromptingTabs should not own templates or repeated panel chrome');
  assert.match(tabListSource, /role="tab"|buildTabId|buildPanelId/, 'SoraPromptingTabList should own tab button wiring');
  assert.match(tabPanelSource, /CopyPromptButton|Template \(copy\/paste\)|QUICK_EXAMPLE/, 'SoraPromptingTabPanel should own template display and examples');
  assert.match(sidebarSource, /PromptingRuleCard|Engine quirks/, 'SoraPromptingSidebar should own side guidance cards');
  assert.match(contentSource, /STRUCTURED_TEMPLATE|VIDEO_TABS|IMAGE_TABS|DEFAULT_TAB_NOTES/, 'sora prompting content should own templates and defaults');
});

test('sora prompting tab modules stay focused', () => {
  const tabsSource = readSource(tabsPath);
  const tabListSource = readSource(tabListPath);
  const tabPanelSource = readSource(tabPanelPath);
  const sidebarSource = readSource(sidebarPath);
  const contentSource = readSource(contentPath);

  assert.ok(lineCount(tabsSource) <= 130, `SoraPromptingTabs should stay below 130 lines, got ${lineCount(tabsSource)}`);
  assert.ok(lineCount(tabListSource) <= 60, `SoraPromptingTabList should stay below 60 lines, got ${lineCount(tabListSource)}`);
  assert.ok(lineCount(tabPanelSource) <= 90, `SoraPromptingTabPanel should stay below 90 lines, got ${lineCount(tabPanelSource)}`);
  assert.ok(lineCount(sidebarSource) <= 60, `SoraPromptingSidebar should stay below 60 lines, got ${lineCount(sidebarSource)}`);
  assert.ok(lineCount(contentSource) <= 380, `sora prompting content should stay below 380 lines, got ${lineCount(contentSource)}`);
});
