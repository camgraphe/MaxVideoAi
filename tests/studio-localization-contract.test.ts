import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import type { Dictionary } from '../frontend/lib/i18n/types';
import {
  DEFAULT_STUDIO_COPY,
  formatStudioProjectDate,
  resolveStudioCopy,
} from '../frontend/app/(core)/(workspace)/app/studio/_lib/studio-copy';

const root = process.cwd();
const locales = ['en', 'fr', 'es'] as const;
const requiredPaths = [
  'workspace.studio.projects.metaTitle',
  'workspace.studio.projects.heroBadge',
  'workspace.studio.projects.title',
  'workspace.studio.projects.subtitle',
  'workspace.studio.projects.createTitle',
  'workspace.studio.projects.createSubtitle',
  'workspace.studio.projects.projectNameLabel',
  'workspace.studio.projects.projectNamePlaceholder',
  'workspace.studio.projects.canvasTemplateLabel',
  'workspace.studio.projects.browseTemplates',
  'workspace.studio.projects.createProject',
  'workspace.studio.projects.creating',
  'workspace.studio.projects.recentTitle',
  'workspace.studio.projects.recentSubtitle',
  'workspace.studio.projects.emptyRecent',
  'workspace.studio.projects.viewAllProjects',
  'workspace.studio.projects.rename',
  'workspace.studio.projects.duplicate',
  'workspace.studio.projects.delete',
  'workspace.studio.projects.renameTitle',
  'workspace.studio.projects.renameSubmit',
  'workspace.studio.projects.deleteTitle',
  'workspace.studio.projects.deleteBody',
  'workspace.studio.projects.deleteConfirm',
  'workspace.studio.projects.cancel',
  'workspace.studio.projects.untitledProject',
  'workspace.studio.projects.localDraft',
  'workspace.studio.projects.customCanvas',
  'workspace.studio.topbar.productName',
  'workspace.studio.topbar.breadcrumbProjects',
  'workspace.studio.topbar.breadcrumbWorkspace',
  'workspace.studio.topbar.workspaceViewLabel',
  'workspace.studio.topbar.canvas',
  'workspace.studio.topbar.viewer',
  'workspace.studio.topbar.export',
  'workspace.studio.topbar.exportAria',
  'workspace.studio.topbar.mock',
  'workspace.studio.topbar.live',
  'workspace.studio.topbar.mockAria',
  'workspace.studio.topbar.switchToLight',
  'workspace.studio.topbar.switchToDark',
  'workspace.studio.common.secondsShort',
  'workspace.studio.common.itemSingular',
  'workspace.studio.common.itemPlural',
  'workspace.studio.common.folder',
  'workspace.studio.common.generatedClip',
  'workspace.studio.notices.canvasTemplateNotFound',
  'workspace.studio.notices.projectMediaAssetNotFound',
  'workspace.studio.notices.projectMediaFolderNotFound',
  'workspace.studio.notices.generatedClipNotFound',
  'workspace.studio.notices.unlockBeforeMoving',
  'workspace.studio.notices.unlockBeforeCutting',
  'workspace.studio.notices.unlockBeforeTrimming',
  'workspace.studio.notices.unlockBeforeDeleting',
  'workspace.studio.notices.selectedClipsUnlinked',
  'workspace.studio.notices.selectedClipsLinked',
];

function readPath(source: unknown, keyPath: string): unknown {
  return keyPath.split('.').reduce<unknown>((current, key) => {
    if (!current || typeof current !== 'object') return undefined;
    return (current as Record<string, unknown>)[key];
  }, source);
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
  assert.equal(copy.notices.unlockBeforeMoving, 'Unlock first.');
  assert.equal(copy.notices.unlockBeforeCutting, DEFAULT_STUDIO_COPY.notices.unlockBeforeCutting);
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
