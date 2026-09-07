import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { I18nProvider } from '../frontend/lib/i18n/I18nProvider';
import type { Dictionary } from '../frontend/lib/i18n/types';
import { listFalEngines } from '../frontend/src/config/falEngines';
import type { AssetFieldConfig, ComposerAttachment } from '../frontend/components/Composer';
import { getReferenceCommandAvailability } from '../frontend/components/composer/workspace-reference-availability';
import {
  getWorkspaceReferenceFields,
  type WorkspaceReferenceAvailability,
} from '../frontend/app/(core)/(workspace)/app/_lib/workspace-reference-fields';

const modelRestriction = 'Model restriction';
const clearReferences = 'Clear references to use start and end frames.';
const clearFrames = 'Clear start and end frames to add references.';
const startField: AssetFieldConfig = {
  field: { id: 'image_url', type: 'image', label: 'Start image', maxCount: 1 },
  required: false,
  role: 'primary',
};
const endField: AssetFieldConfig = {
  field: { id: 'end_image_url', type: 'image', label: 'End image', maxCount: 1 },
  required: false,
  role: 'frame',
};
const referenceField: AssetFieldConfig = {
  field: { id: 'image_urls', type: 'image', label: 'Reference images', maxCount: 9 },
  required: false,
  role: 'reference',
};
const audioField: AssetFieldConfig = {
  field: { id: 'audio_urls', type: 'audio', label: 'Reference audio', maxCount: 3 },
  required: false,
  role: 'reference',
};
const videoField: AssetFieldConfig = {
  field: { id: 'video_urls', type: 'video', label: 'Reference videos', maxCount: 3 },
  required: false,
  role: 'reference',
};
const imageAsset: ComposerAttachment = {
  kind: 'image', name: 'Reference.png', type: 'image/png', size: 1, previewUrl: '/reference.png',
};
const unlockedOptions: WorkspaceReferenceAvailability = {
  inputAssets: {},
  isUnifiedSeedance: false,
  isUnifiedKlingO3: false,
  klingO3VideoToVideoSupported: true,
  hasAnyVideoInput: false,
  guestUploadLockedReason: null,
  workflowCopy: { clearReferencesToUseStartEnd: clearReferences, clearStartEndToUseReferences: clearFrames },
  showOmniStudioPanel: false,
  showLumaRay32KeyframeEditor: false,
};

async function loadReferenceSection() {
  const require = createRequire(import.meta.url);
  const previousCssLoader = require.extensions['.css'];
  require.extensions['.css'] = () => {};
  try { return await import('../frontend/components/composer/WorkspaceReferenceSection.client'); } finally {
    if (previousCssLoader) require.extensions['.css'] = previousCssLoader;
    else delete require.extensions['.css'];
  }
}

async function mount(element: React.ReactNode) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/app', pretendToBeVisual: true });
  const globals = {
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    React,
    IS_REACT_ACT_ENVIRONMENT: true,
  };
  const previous = new Map(Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  dom.window.HTMLElement.prototype.getClientRects = function () {
    return [{ width: 10, height: 10 }] as unknown as DOMRectList;
  };
  const container = dom.window.document.getElementById('root')!;
  const root = createRoot(container);
  const render = async (child: React.ReactNode) => {
    await act(async () => root.render(React.createElement(I18nProvider, {
      locale: 'en', dictionary: {} as Dictionary, fallback: {} as Dictionary, children: child,
    })));
  };
  await render(element);
  return { container, dom, render, async cleanup() {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  } };
}

test('workspace reference projection preserves authored disabled restrictions', () => {
  const upstream = { ...startField, disabled: true, disabledReason: modelRestriction };
  const result = getWorkspaceReferenceFields([upstream], unlockedOptions);
  assert.equal(result[0].disabled, true);
  assert.equal(result[0].disabledReason, modelRestriction);
  assert.equal(result[0].field, upstream.field);
});

test('compact availability blocks only empty fully locked commands and deduplicates explanations', () => {
  const lockedStart = { ...startField, disabled: true, disabledReason: modelRestriction };
  const lockedEnd = { ...endField, disabled: true, disabledReason: modelRestriction };
  assert.deepEqual(getReferenceCommandAvailability([lockedStart, lockedEnd], {}), {
    addDisabled: true,
    canOpen: false,
    reasons: [modelRestriction],
  });
  assert.deepEqual(getReferenceCommandAvailability([lockedStart], { image_url: [imageAsset] }), {
    addDisabled: true,
    canOpen: true,
    reasons: [modelRestriction],
  });
  assert.deepEqual(getReferenceCommandAvailability([lockedStart, audioField], {}), {
    addDisabled: false,
    canOpen: true,
    reasons: [modelRestriction],
  });
});

test('removing the final upstream-locked frame or collection restores focus to its guarded command', async () => {
  const { WorkspaceReferenceSection } = await loadReferenceSection();
  const engine = listFalEngines().find((entry) => entry.id === 'seedance-2-0')!.engine;

  for (const [field, commandId] of [[startField, 'image_url'], [referenceField, 'collections']] as const) {
    function Fixture() {
      const [assets, setAssets] = React.useState<Record<string, (ComposerAttachment | null)[]>>({
        [field.field.id]: [imageAsset],
      });
      return React.createElement(WorkspaceReferenceSection, {
        engine,
        referenceWarning: '',
        assets,
        assetFields: [{ ...field, disabled: true, disabledReason: modelRestriction }],
        onAssetRemove: (removedField: AssetFieldConfig['field'], index: number) => {
          setAssets((current) => ({
            ...current,
            [removedField.id]: (current[removedField.id] ?? []).map((asset, slotIndex) => slotIndex === index ? null : asset),
          }));
        },
      });
    }

    const fixture = await mount(React.createElement(Fixture));
    const doc = fixture.dom.window.document;
    try {
      const command = fixture.container.querySelector<HTMLButtonElement>(`[data-reference-command="${commandId}"]`)!;
      assert.equal(command.getAttribute('aria-disabled'), null);
      await act(async () => command.click());
      const dialog = doc.querySelector<HTMLElement>('[role="dialog"]')!;
      const remove = dialog.querySelector<HTMLButtonElement>('button[aria-label^="Remove"]')!;
      remove.focus();
      await act(async () => remove.click());
      assert.equal(command.isConnected, true);
      assert.equal(command.disabled, false, 'the stable popup opener remains programmatically focusable');
      assert.equal(command.getAttribute('aria-disabled'), 'true');
      assert.ok(dialog.contains(doc.activeElement), 'focus first recovers inside the still-open popup');
      await act(async () => doc.activeElement?.dispatchEvent(new fixture.dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
      assert.equal(doc.querySelector('[role="dialog"]'), null);
      assert.equal(doc.activeElement, command, 'Escape restores focus to the stable meaningful command');
      await act(async () => command.click());
      assert.equal(doc.querySelector('[role="dialog"]'), null, 'the guarded empty command cannot reopen upload or Library controls');
    } finally { await fixture.cleanup(); }
  }
});

test('partially available collections open allowed controls while locked empty commands stay inert', async () => {
  const { WorkspaceReferenceSection } = await loadReferenceSection();
  const engine = listFalEngines().find((entry) => entry.id === 'seedance-2-0')!.engine;
  const library: Array<[string, number]> = [];
  const fixture = await mount(React.createElement(WorkspaceReferenceSection, {
    engine,
    referenceWarning: '',
    assets: {},
    assetFields: [
      { ...referenceField, disabled: true, disabledReason: modelRestriction },
      { ...audioField, disabled: true, disabledReason: modelRestriction },
    ],
    onOpenLibrary: (field, index) => library.push([field.id, index]),
  }));
  try {
    const locked = fixture.container.querySelector<HTMLButtonElement>('[data-reference-command="collections"]')!;
    assert.equal(locked.disabled, false);
    assert.equal(locked.getAttribute('aria-disabled'), 'true');
    assert.equal(fixture.dom.window.document.querySelector('[role="dialog"]'), null);
    await act(async () => locked.click());
    assert.equal(fixture.dom.window.document.querySelector('[role="dialog"]'), null);
    assert.equal(fixture.container.querySelectorAll('.app-reference-restrictions p').length, 1);
    assert.equal(fixture.container.querySelector('.app-reference-restrictions')?.textContent, modelRestriction);

    await fixture.render(React.createElement(WorkspaceReferenceSection, {
      engine,
      referenceWarning: '',
      assets: {},
      assetFields: [{ ...referenceField, disabled: true, disabledReason: modelRestriction }, videoField],
      onOpenLibrary: (field, index) => library.push([field.id, index]),
    }));
    const partial = fixture.container.querySelector<HTMLButtonElement>('[data-reference-command="collections"]')!;
    assert.equal(partial.disabled, false);
    assert.equal(partial.getAttribute('aria-disabled'), null);
    await act(async () => partial.click());
    const dialog = fixture.dom.window.document.querySelector<HTMLElement>('[role="dialog"]')!;
    assert.ok(dialog);
    assert.equal(dialog.querySelector<HTMLButtonElement>('[data-reference-field="image_urls"] .app-reference-add-target')?.disabled, true);
    const allowedLibrary = dialog.querySelector<HTMLButtonElement>('[data-reference-field="video_urls"] .app-reference-library-target')!;
    assert.equal(allowedLibrary.disabled, false);
    await act(async () => allowedLibrary.click());
    assert.deepEqual(library, [['video_urls', 0]]);
    assert.equal(fixture.dom.window.document.querySelector('[role="dialog"]'), null);
    assert.equal(fixture.dom.window.document.activeElement, partial);
  } finally { await fixture.cleanup(); }
});

test('Seedance commands lock and unlock as start and reference assets are added and removed', async () => {
  const { WorkspaceReferenceSection } = await loadReferenceSection();
  const engine = listFalEngines().find((entry) => entry.id === 'seedance-2-0')!.engine;
  function Fixture() {
    const [assets, setAssets] = React.useState<Record<string, (ComposerAttachment | null)[]>>({});
    const fields = getWorkspaceReferenceFields([startField, endField, referenceField], {
      ...unlockedOptions,
      inputAssets: assets,
      isUnifiedSeedance: true,
    });
    return React.createElement(WorkspaceReferenceSection, {
      engine,
      referenceWarning: '',
      assets,
      assetFields: fields,
      onOpenLibrary: (field: AssetFieldConfig['field'], index: number) => {
        setAssets((current) => ({ ...current, [field.id]: [index === 0 ? imageAsset : null] }));
      },
      onAssetRemove: (field: AssetFieldConfig['field'], index: number) => {
        setAssets((current) => ({
          ...current,
          [field.id]: (current[field.id] ?? []).map((asset, slotIndex) => slotIndex === index ? null : asset),
        }));
      },
    });
  }
  const fixture = await mount(React.createElement(Fixture));
  const doc = fixture.dom.window.document;
  const click = async (button: HTMLButtonElement) => act(async () => button.click());
  try {
    let start = fixture.container.querySelector<HTMLButtonElement>('[data-reference-command="image_url"]')!;
    let references = fixture.container.querySelector<HTMLButtonElement>('[data-reference-command="collections"]')!;
    assert.equal(start.disabled, false);
    assert.equal(references.disabled, false);
    assert.equal(start.getAttribute('aria-disabled'), null);
    assert.equal(references.getAttribute('aria-disabled'), null);
    await click(start);
    await click(doc.querySelector<HTMLButtonElement>('[data-reference-field="image_url"] .app-reference-library-target')!);
    references = fixture.container.querySelector<HTMLButtonElement>('[data-reference-command="collections"]')!;
    assert.equal(references.getAttribute('aria-disabled'), 'true', 'adding a start frame locks empty reference additions');
    assert.match(fixture.container.textContent!, new RegExp(clearFrames.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

    start = fixture.container.querySelector<HTMLButtonElement>('[data-reference-command="image_url"]')!;
    await click(start);
    await click(doc.querySelector<HTMLButtonElement>('[data-reference-field="image_url"] button[aria-label^="Remove"]')!);
    references = fixture.container.querySelector<HTMLButtonElement>('[data-reference-command="collections"]')!;
    assert.equal(references.getAttribute('aria-disabled'), null, 'removing the start frame unlocks references');
    await click(references);
    await click(doc.querySelector<HTMLButtonElement>('[data-reference-field="image_urls"] .app-reference-library-target')!);

    start = fixture.container.querySelector<HTMLButtonElement>('[data-reference-command="image_url"]')!;
    const end = fixture.container.querySelector<HTMLButtonElement>('[data-reference-command="end_image_url"]')!;
    references = fixture.container.querySelector<HTMLButtonElement>('[data-reference-command="collections"]')!;
    assert.equal(start.getAttribute('aria-disabled'), 'true');
    assert.equal(end.getAttribute('aria-disabled'), 'true');
    assert.equal(references.getAttribute('aria-disabled'), null, 'existing locked references remain manageable');
    await click(references);
    const remove = doc.querySelector<HTMLButtonElement>('[data-reference-field="image_urls"] button[aria-label^="Remove"]')!;
    remove.focus();
    await click(remove);
    assert.ok(doc.querySelector('[role="dialog"]')?.contains(doc.activeElement));
    await act(async () => doc.activeElement?.dispatchEvent(new fixture.dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    assert.equal(doc.querySelector('[role="dialog"]'), null);
    assert.equal(doc.activeElement, references);
    assert.equal(fixture.container.querySelector<HTMLButtonElement>('[data-reference-command="image_url"]')!.getAttribute('aria-disabled'), null);
  } finally { await fixture.cleanup(); }
});
