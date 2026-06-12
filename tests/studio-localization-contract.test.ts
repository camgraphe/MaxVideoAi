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

function requiredStudioCopyPaths(source: unknown, prefix = 'workspace.studio'): string[] {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return [];
  return Object.entries(source as Record<string, unknown>).flatMap(([key, value]) => {
    const keyPath = `${prefix}.${key}`;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return requiredStudioCopyPaths(value, keyPath);
    }
    return [keyPath];
  });
}

const requiredPaths = requiredStudioCopyPaths(DEFAULT_STUDIO_COPY);

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

test('Studio source files do not keep legacy English UI copy outside the copy owner', () => {
  const bannedFiles = [
    'frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceProjectMediaActions.ts',
    'frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceSequenceActions.ts',
    'frontend/app/(core)/(workspace)/app/studio/workspace/_components/NodeLibrarySidebar.tsx',
  ];

  const bannedPatterns = [
    /media assets?/,
    /generated clips?/,
    /\bfolders?\b/,
    /\bBlock templates\b/,
    /\bCanvas templates\b/,
    /\bTemplate name\b/,
    /\bNo saved canvas templates yet\b/,
  ];

  bannedFiles.forEach((relativePath) => {
    const absolutePath = path.join(root, relativePath);
    if (!fs.existsSync(absolutePath)) return;
    const source = fs.readFileSync(absolutePath, 'utf8');
    bannedPatterns.forEach((pattern) => {
      assert.doesNotMatch(source, pattern, `${relativePath} should route visible copy through studio-copy.ts`);
    });
  });
});
