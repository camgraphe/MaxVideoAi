import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const page = readFileSync(resolve('frontend/app/(core)/(workspace)/app/studio/projects/StudioProjectsPage.client.tsx'), 'utf8');
const copy = readFileSync(resolve('frontend/app/(core)/(workspace)/app/studio/_lib/studio-copy.ts'), 'utf8');
const styles = readFileSync(resolve('frontend/app/(core)/(workspace)/app/studio/projects/studio-projects.module.css'), 'utf8');

test('Projects presents one outcome sentence per starter and keeps the single global generation disclaimer', () => {
  assert.doesNotMatch(page, /studioCopy\.projects\.starterSubtitle/u);
  assert.doesNotMatch(page, /studioCopy\.projects\.recentSubtitle/u);
  assert.doesNotMatch(page, /template\.flow/u);
  assert.match(page, /\{template\.description\}/u);
  assert.match(page, /studioCopy\.projects\.starterDisclaimer/u);
  assert.match(page, /canvasPreviewLabel/u);
  assert.match(page, /resultPreviewLabel/u);
  assert.match(copy, /description: 'Prepare a four-shot product ad from your image and brand\.'/u);
  assert.match(copy, /description: 'Prepare video shots from your storyboard\.'/u);
  assert.match(copy, /description: 'Prepare a trailer with a consistent visual style and sound mood\.'/u);
});

test('connected montage cards do not promise legacy-only project mutations', () => {
  assert.match(page, /const connectedProject = project\.persistenceMode === 'connected'/u);
  assert.match(page, /const connectedActionsDescriptionId = `connected-project-actions-\$\{project\.id\}`/u);
  assert.match(page, /id=\{connectedActionsDescriptionId\}[\s\S]*connectedActionsUnavailable/u);
  for (const action of ['openRenameDialog', 'duplicateProject', 'requestDeleteProject']) {
    assert.match(page, new RegExp(`disabled=\\{connectedProject\\}[\\s\\S]{0,420}${action}\\(project\\)`, 'u'));
  }
});

test('Projects and montage dialog use the Studio matte palette and one mobile scroll surface', () => {
  assert.match(styles, /--studio-project-bg:\s*#eeeee6/u);
  assert.match(styles, /--studio-project-text:\s*#20261b/u);
  assert.match(styles, /--studio-project-accent:\s*#d6ad5d/u);
  assert.match(styles, /:global\(\[data-theme="dark"\]\) \.projectsShell \{[\s\S]*--studio-project-bg:\s*#171918[\s\S]*--studio-project-accent:\s*#e6bf76/u);
  assert.match(styles, /@media \(max-width: 720px\) \{[\s\S]*\.montageOrder ol \{[\s\S]*max-height:\s*none;[\s\S]*overflow:\s*visible;/u);
});
