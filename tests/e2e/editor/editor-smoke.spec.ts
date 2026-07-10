import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  assertNoEditorClientErrors,
  canvasNodeCount,
  dropProjectMediaAssetOnTimelineTrack,
  openEditorWorkspace,
  openFreshEditorWorkspace,
  switchEditorFocus,
  timelineItemCount,
  trackEditorClientErrors,
} from './editor-helpers';

type LocalFileDropFixture = {
  name: string;
  type: string;
  content: string;
};

type CanvasMarqueeBounds = {
  bottom: number;
  left: number;
  right: number;
  top: number;
};

type RgbaColor = [number, number, number, number];

type ReadabilityMetrics = {
  background: string;
  backgroundLuminance: number;
  color: string;
  contrast: number;
  textLuminance: number;
};

type CssVariableColorMetrics = {
  backgroundColors: Array<{
    color: RgbaColor;
    name: string;
    value: string;
  }>;
  foregroundColor: {
    color: RgbaColor;
    value: string;
  };
};

function timelineTrackNoticeLabel(track: string): string {
  const match = /^(audio|video)(?:-(\d+))?$/.exec(track);
  if (!match) return track;
  const [, kind, index = '1'] = match;
  return `${kind === 'video' ? 'Video' : 'Audio'} ${index}`;
}

function relativeLuminance(color: RgbaColor): number {
  const [red, green, blue] = color.slice(0, 3).map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(color: RgbaColor, background: RgbaColor): number {
  const foregroundLuminance = relativeLuminance(color);
  const backgroundLuminance = relativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

async function readabilityMetrics(locator: Locator): Promise<ReadabilityMetrics> {
  const metrics = await locator.first().evaluate((element) => {
    type BrowserRgbaColor = [number, number, number, number];

    const parseCssColor = (value: string): BrowserRgbaColor => {
      if (!value || value === 'transparent') return [0, 0, 0, 0];
      const matches = value.match(/[\d.]+/g)?.map(Number) ?? [];
      return [
        matches[0] ?? 0,
        matches[1] ?? matches[0] ?? 0,
        matches[2] ?? matches[1] ?? matches[0] ?? 0,
        matches[3] ?? 1,
      ];
    };

    const composite = (foreground: BrowserRgbaColor, background: BrowserRgbaColor): BrowserRgbaColor => {
      const alpha = foreground[3] + background[3] * (1 - foreground[3]);
      if (alpha <= 0) return [0, 0, 0, 0];
      return [
        (foreground[0] * foreground[3] + background[0] * background[3] * (1 - foreground[3])) / alpha,
        (foreground[1] * foreground[3] + background[1] * background[3] * (1 - foreground[3])) / alpha,
        (foreground[2] * foreground[3] + background[2] * background[3] * (1 - foreground[3])) / alpha,
        alpha,
      ];
    };

    const elements: Element[] = [];
    let current: Element | null = element;
    while (current) {
      elements.unshift(current);
      current = current.parentElement;
    }

    let backgroundColor: BrowserRgbaColor = [255, 255, 255, 1];
    for (const candidate of elements) {
      backgroundColor = composite(parseCssColor(getComputedStyle(candidate).backgroundColor), backgroundColor);
    }

    const styles = getComputedStyle(element);
    return {
      background: `rgba(${backgroundColor.map((channel, index) => (index < 3 ? Math.round(channel) : Number(channel.toFixed(3)))).join(', ')})`,
      backgroundColor,
      color: styles.color,
      colorValue: parseCssColor(styles.color),
    };
  });

  return {
    background: metrics.background,
    backgroundLuminance: relativeLuminance(metrics.backgroundColor as RgbaColor),
    color: metrics.color,
    contrast: contrastRatio(metrics.colorValue as RgbaColor, metrics.backgroundColor as RgbaColor),
    textLuminance: relativeLuminance(metrics.colorValue as RgbaColor),
  };
}

async function expectReadable(locator: Locator, label: string, minimumContrast = 4.5): Promise<ReadabilityMetrics> {
  await expect(locator.first(), `${label} should be visible before checking colors`).toBeVisible();
  const metrics = await readabilityMetrics(locator);
  expect(metrics.contrast, `${label} contrast: ${metrics.color} on ${metrics.background}`).toBeGreaterThanOrEqual(minimumContrast);
  return metrics;
}

async function expectLightReadableSurface(locator: Locator, label: string): Promise<void> {
  const metrics = await expectReadable(locator, label);
  expect(metrics.backgroundLuminance, `${label} should not render as a dark zone in light mode`).toBeGreaterThan(0.58);
  expect(metrics.textLuminance, `${label} should use dark text in light mode`).toBeLessThan(0.42);
}

async function expectDarkReadableSurface(locator: Locator, label: string): Promise<void> {
  const metrics = await expectReadable(locator, label);
  expect(metrics.backgroundLuminance, `${label} should use a dark theme background`).toBeLessThan(0.24);
}

async function cssVariableColorMetrics(
  locator: Locator,
  foregroundVariable: string,
  backgroundVariables: string[]
): Promise<CssVariableColorMetrics> {
  return locator.first().evaluate(
    (element, { backgroundVariables: evaluatedBackgroundVariables, foregroundVariable: evaluatedForegroundVariable }) => {
      type BrowserRgbaColor = [number, number, number, number];

      const parseCssColor = (value: string): BrowserRgbaColor => {
        if (!value || value === 'transparent') return [0, 0, 0, 0];
        const matches = value.match(/[\d.]+/g)?.map(Number) ?? [];
        return [
          matches[0] ?? 0,
          matches[1] ?? matches[0] ?? 0,
          matches[2] ?? matches[1] ?? matches[0] ?? 0,
          matches[3] ?? 1,
        ];
      };

      const resolveColor = (value: string) => {
        const probe = document.createElement('span');
        probe.style.color = value;
        document.body.append(probe);
        const resolvedValue = getComputedStyle(probe).color;
        probe.remove();
        return {
          color: parseCssColor(resolvedValue),
          value: resolvedValue,
        };
      };

      const styles = getComputedStyle(element);

      return {
        backgroundColors: evaluatedBackgroundVariables.map((name) => ({
          ...resolveColor(styles.getPropertyValue(name).trim()),
          name,
        })),
        foregroundColor: resolveColor(styles.getPropertyValue(evaluatedForegroundVariable).trim()),
      };
    },
    { backgroundVariables, foregroundVariable }
  );
}

async function expectCssVariableContrast(
  locator: Locator,
  label: string,
  foregroundVariable: string,
  backgroundVariables: string[],
  minimumContrast = 4.5
): Promise<void> {
  await expect(locator.first(), `${label} should be visible before checking theme colors`).toBeVisible();
  const metrics = await cssVariableColorMetrics(locator, foregroundVariable, backgroundVariables);

  for (const backgroundColor of metrics.backgroundColors) {
    const contrast = contrastRatio(metrics.foregroundColor.color, backgroundColor.color);
    expect(
      contrast,
      `${label} contrast: ${foregroundVariable} ${metrics.foregroundColor.value} on ${backgroundColor.name} ${backgroundColor.value}`
    ).toBeGreaterThanOrEqual(minimumContrast);
  }
}

async function expectActiveControlFillReadable(locator: Locator, label: string, minimumContrast = 4.5): Promise<void> {
  await expect(locator.first(), `${label} should be visible before checking active colors`).toBeVisible();
  const metrics = await locator.first().evaluate((element) => {
    type BrowserRgbaColor = [number, number, number, number];

    const parseCssColor = (value: string): BrowserRgbaColor => {
      if (!value || value === 'transparent') return [0, 0, 0, 0];
      const matches = value.match(/[\d.]+/g)?.map(Number) ?? [];
      return [
        matches[0] ?? 0,
        matches[1] ?? matches[0] ?? 0,
        matches[2] ?? matches[1] ?? matches[0] ?? 0,
        matches[3] ?? 1,
      ];
    };

    const composite = (foreground: BrowserRgbaColor, background: BrowserRgbaColor): BrowserRgbaColor => {
      const alpha = foreground[3] + background[3] * (1 - foreground[3]);
      if (alpha <= 0) return [0, 0, 0, 0];
      return [
        (foreground[0] * foreground[3] + background[0] * background[3] * (1 - foreground[3])) / alpha,
        (foreground[1] * foreground[3] + background[1] * background[3] * (1 - foreground[3])) / alpha,
        (foreground[2] * foreground[3] + background[2] * background[3] * (1 - foreground[3])) / alpha,
        alpha,
      ];
    };

    const colorValue = (color: BrowserRgbaColor) => {
      const [red, green, blue, alpha] = color;
      return `rgba(${Math.round(red)}, ${Math.round(green)}, ${Math.round(blue)}, ${Number(alpha.toFixed(3))})`;
    };

    const styles = getComputedStyle(element);
    const ancestors: Element[] = [];
    let current = element.parentElement;
    while (current) {
      ancestors.unshift(current);
      current = current.parentElement;
    }

    let backgroundBehindElement: BrowserRgbaColor = [255, 255, 255, 1];
    for (const candidate of ancestors) {
      backgroundBehindElement = composite(parseCssColor(getComputedStyle(candidate).backgroundColor), backgroundBehindElement);
    }

    const backgroundUnderFill = composite(parseCssColor(styles.backgroundColor), backgroundBehindElement);
    const gradientStopValues = styles.backgroundImage.match(/rgba?\([^)]+\)/g) ?? [];
    const sampledFillColors = gradientStopValues.length
      ? gradientStopValues.map((value, index) => {
        const color = composite(parseCssColor(value), backgroundUnderFill);
        return {
          color,
          source: `gradient stop ${index + 1}`,
          value: colorValue(color),
        };
      })
      : [{
        color: backgroundUnderFill,
        source: 'background color',
        value: colorValue(backgroundUnderFill),
      }];

    const midpointFillColors = sampledFillColors.slice(0, -1).map((fillColor, index) => {
      const nextFillColor = sampledFillColors[index + 1];
      const color: BrowserRgbaColor = [
        (fillColor.color[0] + nextFillColor.color[0]) / 2,
        (fillColor.color[1] + nextFillColor.color[1]) / 2,
        (fillColor.color[2] + nextFillColor.color[2]) / 2,
        1,
      ];

      return {
        color,
        source: `${fillColor.source}/${nextFillColor.source} midpoint`,
        value: colorValue(color),
      };
    });

    return {
      backgroundImage: styles.backgroundImage,
      color: styles.color,
      fillColors: [...sampledFillColors, ...midpointFillColors],
      foregroundColor: parseCssColor(styles.color),
    };
  });

  expect(metrics.fillColors.length, `${label} should expose an active fill color`).toBeGreaterThan(0);
  for (const fillColor of metrics.fillColors) {
    const contrast = contrastRatio(metrics.foregroundColor as RgbaColor, fillColor.color as RgbaColor);
    expect(
      contrast,
      `${label} contrast: ${metrics.color} on ${fillColor.source} ${fillColor.value} from ${metrics.backgroundImage}`
    ).toBeGreaterThanOrEqual(minimumContrast);
  }
}

async function expectTapTarget(locator: Locator, label: string, minSize = 40): Promise<void> {
  await expect(locator.first(), `${label} should be visible before measuring tap target`).toBeVisible();
  const box = await locator.first().boundingBox();
  expect(box, `${label} should have a measurable bounding box`).not.toBeNull();
  if (!box) return;
  expect(box.width, `${label} should be at least ${minSize}px wide`).toBeGreaterThanOrEqual(minSize);
  expect(box.height, `${label} should be at least ${minSize}px tall`).toBeGreaterThanOrEqual(minSize);
}

async function expectWithinViewport(page: Page, locator: Locator, label: string): Promise<void> {
  await expect(locator.first(), `${label} should be visible before viewport bounds check`).toBeVisible();
  const viewport = page.viewportSize();
  expect(viewport, `${label} should have a known viewport`).not.toBeNull();
  if (!viewport) return;
  await expect.poll(async () => {
    const box = await locator.first().boundingBox();
    if (!box) return false;
    return (
      box.x >= 0 &&
      box.y >= 0 &&
      box.x + box.width <= viewport.width + 1 &&
      box.y + box.height <= viewport.height + 1
    );
  }, { message: `${label} should settle within the viewport` }).toBe(true);
}

async function dropLocalFileOnCanvas(
  page: Page,
  fixture: LocalFileDropFixture,
  targetSelector = '.react-flow',
  ratio = { x: 0.5, y: 0.42 }
): Promise<void> {
  const target = page.locator(targetSelector).first();
  await expect(target).toBeVisible();
  const box = await target.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;

  await target.evaluate(
    (element, { clientX, clientY, file }) => {
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(new File([file.content], file.name, { type: file.type }));
      element.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, clientX, clientY, dataTransfer }));
      element.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, clientX, clientY, dataTransfer }));
    },
    {
      clientX: box.x + box.width * ratio.x,
      clientY: box.y + box.height * ratio.y,
      file: fixture,
    }
  );
}

async function dropLocalFileOnProjectMedia(page: Page, fixture: LocalFileDropFixture): Promise<void> {
  const target = page.locator('[data-project-media-grid="true"]').first();
  await expect(target).toBeVisible();
  const box = await target.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;

  await target.evaluate(
    (element, { clientX, clientY, file }) => {
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(new File([file.content], file.name, { type: file.type }));
      element.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, clientX, clientY, dataTransfer }));
      element.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, clientX, clientY, dataTransfer }));
    },
    {
      clientX: box.x + box.width * 0.5,
      clientY: box.y + box.height * 0.42,
      file: fixture,
    }
  );
}

async function pasteFileOnCanvas(page: Page, fixture: LocalFileDropFixture): Promise<void> {
  await page.locator('.react-flow').evaluate((element, file) => {
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(new File([file.content], file.name, { type: file.type }));
    element.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dataTransfer }));
  }, fixture);
}

async function pasteTextOnCanvas(page: Page, text: string): Promise<void> {
  await page.locator('.react-flow').evaluate((element, pastedText) => {
    const dataTransfer = new DataTransfer();
    dataTransfer.setData('text/plain', pastedText);
    element.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dataTransfer }));
  }, text);
}

async function copyCanvasGraphSelection(page: Page): Promise<void> {
  await page.locator('.react-flow').evaluate((element) => {
    element.dispatchEvent(new ClipboardEvent('copy', {
      bubbles: true,
      cancelable: true,
      clipboardData: new DataTransfer(),
    }));
  });
}

async function pasteClipboardOnDocumentBody(page: Page, payload: { text: string; type?: string }): Promise<void> {
  await page.evaluate(({ text, type }) => {
    const clipboardData = new DataTransfer();
    clipboardData.setData('text/plain', text);
    if (type) clipboardData.setData(type, '1');
    document.body.dispatchEvent(new ClipboardEvent('paste', {
      bubbles: true,
      cancelable: true,
      clipboardData,
    }));
  }, payload);
}

async function canvasMarqueeBoundsForNodes(page: Page, nodeIds: string[]): Promise<CanvasMarqueeBounds | null> {
  const pane = page.locator('.react-flow__pane');
  await expect(pane).toBeVisible();
  const paneBox = await pane.boundingBox();
  expect(paneBox).not.toBeNull();
  if (!paneBox) return null;

  const nodeBoxes = await Promise.all(nodeIds.map(async (nodeId) => {
    const node = page.locator(`.react-flow__node[data-id="${nodeId}"]`);
    await expect(node).toBeVisible();
    const box = await node.boundingBox();
    expect(box).not.toBeNull();
    return box;
  }));
  if (nodeBoxes.some((box) => !box)) return null;

  const left = Math.max(paneBox.x + 8, Math.min(...nodeBoxes.map((box) => box?.x ?? paneBox.x)) - 22);
  const top = Math.max(paneBox.y + 8, Math.min(...nodeBoxes.map((box) => box?.y ?? paneBox.y)) - 22);
  const right = Math.min(
    paneBox.x + paneBox.width - 8,
    Math.max(...nodeBoxes.map((box) => (box?.x ?? 0) + (box?.width ?? 0))) + 22
  );
  const bottom = Math.min(
    paneBox.y + paneBox.height - 8,
    Math.max(...nodeBoxes.map((box) => (box?.y ?? 0) + (box?.height ?? 0))) + 22
  );

  return { bottom, left, right, top };
}

async function marqueeSelectCanvasNodes(page: Page, nodeIds: string[]): Promise<void> {
  const bounds = await canvasMarqueeBoundsForNodes(page, nodeIds);
  if (!bounds) return;

  const { bottom, left, right, top } = bounds;
  await page.mouse.move(left, top);
  await page.mouse.down();
  await page.mouse.move(right, bottom, { steps: 14 });
  await page.mouse.up();
}

async function mockStudioPersistenceApi(page: Page): Promise<void> {
  await page.route('**/api/member-status', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ tier: 'Member' }),
    });
  });
  await page.route('**/api/studio/canvas-templates', async (route) => {
    if (route.request().method() === 'POST') {
      const payload = route.request().postDataJSON() as { template?: Record<string, unknown> } | null;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, template: payload?.template ?? {} }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, templates: [] }),
    });
  });
  await page.route('**/api/studio/canvas-templates/*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });
  await page.route('**/api/studio/projects', async (route) => {
    if (route.request().method() === 'POST') {
      const now = new Date().toISOString();
      const payload = route.request().postDataJSON() as { project?: Record<string, unknown> } | null;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          project: {
            createdAt: now,
            updatedAt: now,
            ...payload?.project,
          },
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, projects: [] }),
    });
  });
  await page.route('**/api/studio/projects/*/sequences', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, sequences: [] }),
    });
  });
  await page.route('**/api/studio/projects/*/sequences/*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });
  await page.route('**/api/studio/projects/*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: false }),
    });
  });
}

async function dismissCookieBanner(page: Page): Promise<void> {
  for (const label of ['Reject all', 'Accept all']) {
    const consentButton = page.getByRole('button', { name: label }).first();
    await consentButton.waitFor({ state: 'visible', timeout: 2_000 }).catch(() => undefined);
    if (await consentButton.isVisible().catch(() => false)) {
      await consentButton.click();
      return;
    }
  }
}

test.beforeEach(async ({ page }) => {
  await mockStudioPersistenceApi(page);
});

test('Studio projects uses localized copy', async ({ page, context }) => {
  await context.setExtraHTTPHeaders({ 'x-next-intl-locale': 'fr' });
  await context.addCookies([
    { name: 'NEXT_LOCALE', value: 'fr', domain: 'localhost', path: '/' },
    { name: 'mvid_locale', value: 'fr', domain: 'localhost', path: '/' },
  ]);
  await page.goto('/app/studio/projects', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Mes projets' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Nouveau projet/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Ouvrir un projet/ })).toBeVisible();
});

test('unauthenticated Studio API responses keep local draft mode quiet', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await page.route('**/api/studio/**', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ ok: false, error: 'Unauthorized' }),
    });
  });
  await page.route('**/_next/static/css/app/**/studio/workspace/**/page.css*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/css',
      body: '',
    });
  });
  await page.addInitScript(() => {
    window.localStorage.removeItem('maxvideoai.editor.projects.v1');
    window.localStorage.removeItem('maxvideoai.editor.workspace.v1.project_unauthorized');
  });

  await page.goto('/app/studio/projects', { waitUntil: 'domcontentloaded' });
  await dismissCookieBanner(page);

  await expect(page.getByRole('heading', { name: 'My projects' })).toBeVisible();
  await expect(page.getByText(/sign in.*local draft mode/i)).toBeVisible();

  await page.goto('/app/studio/workspace/project_unauthorized', { waitUntil: 'domcontentloaded' });
  await dismissCookieBanner(page);

  await expect(page.locator('header').getByText('MaxVideoAI Editor')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Canvas', exact: true })).toBeVisible();
  await expect(page.getByText(/local draft mode/i)).toBeVisible();
  assertNoEditorClientErrors(errors, {
    allowedResourceFailures: [
      { status: 401, urlPattern: /\/api\/studio\// },
      { status: 404, urlPattern: /\/api\/studio\// },
    ],
  });
});

test('Studio projects dark theme keeps core surfaces readable', async ({ page }) => {
  const errors = trackEditorClientErrors(page);
  const darkProject = {
    id: 'project-theme-dark',
    name: 'Dark Theme Cut',
    createdAt: '2026-06-11T19:00:00.000Z',
    updatedAt: '2026-06-11T19:19:00.000Z',
    settings: {
      aspectRatio: '16:9',
      resolution: '1920x1080',
      fps: 24,
    },
    canvasTemplateId: 'cinematic-scene',
  };

  await page.route('**/api/studio/projects', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, projects: [darkProject] }),
    });
  });
  await page.addInitScript(() => {
    window.localStorage.removeItem('maxvideoai.editor.projects.v1');
    window.localStorage.setItem('mv-theme', 'dark');
    window.localStorage.setItem('maxvideoai.studio.theme.v1', 'dark');
    window.localStorage.setItem('maxvideoai.studio.theme.userOverride.v1', 'true');
  });

  await page.goto('/app/studio/projects', { waitUntil: 'domcontentloaded' });
  await dismissCookieBanner(page);

  const shell = page.locator('[class*="projectsShell"]');
  await expectDarkReadableSurface(shell, 'dark Studio projects shell');
  await expect(page.getByRole('heading', { name: 'My projects' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Open a project/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /New project/ })).toBeEnabled();
  await expect(page.getByRole('group', { name: 'Canvas template' })).toHaveCount(0);
  await expectDarkReadableSurface(page.getByRole('button', { name: /Open a project/ }), 'dark open project button');
  await expectDarkReadableSurface(page.locator('[class*="newProjectLaunchCard"]').first(), 'dark new project card');
  await expectDarkReadableSurface(page.locator('[aria-label="Recent projects"]').first(), 'dark recent projects panel');

  await page.getByRole('button', { name: 'Project actions for Dark Theme Cut' }).click();
  await expectDarkReadableSurface(page.getByRole('menu', { name: 'Project actions for Dark Theme Cut' }), 'dark recent project action menu');
  await page.getByRole('menuitem', { name: 'Rename' }).click();
  const renameDialog = page.getByRole('dialog', { name: 'Rename project' });
  await expectDarkReadableSurface(renameDialog, 'dark rename project dialog');
  await expectReadable(renameDialog.getByRole('button', { name: 'Save name' }), 'dark rename project filled action');
  await renameDialog.getByRole('button', { name: 'Cancel' }).click();

  await page.getByRole('button', { name: 'Project actions for Dark Theme Cut' }).click();
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  const deleteDialog = page.getByRole('dialog', { name: 'Delete project' });
  await expectDarkReadableSurface(deleteDialog, 'dark delete project dialog');
  await expectReadable(deleteDialog.getByRole('button', { name: 'Delete project' }), 'dark delete project filled action');

  assertNoEditorClientErrors(errors);
});

test('MaxVideoAI editor loads canvas, viewer, and timeline without client errors', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await openFreshEditorWorkspace(page);
  const initialTimelineItems = await timelineItemCount(page);
  expect(initialTimelineItems).toBeGreaterThan(0);
  await expect(page.getByLabel('Studio account status')).toBeVisible();
  await expect(page.getByLabel(/Studio wallet balance/)).toBeVisible();
  await expect(page.getByLabel('Canvas creation toolbar')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save canvas' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open canvas navigation' })).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Node settings' })).toHaveCount(0);

  const firstCanvasNode = page.locator('.react-flow__node').first();
  await firstCanvasNode.click();
  await expect(page.getByRole('complementary', { name: 'Node settings' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Open .* settings/ }).first()).toBeVisible();

  await page.getByRole('button', { name: /Open .* settings/ }).first().click();
  await expect(page.getByRole('complementary', { name: 'Node settings' })).toBeVisible();

  await page.locator('.react-flow__pane').click({ position: { x: 24, y: 24 } });
  await expect(page.getByRole('complementary', { name: 'Node settings' })).toHaveCount(0);

  await firstCanvasNode.click();
  await expect(page.getByRole('complementary', { name: 'Node settings' })).toHaveCount(0);
  await page.keyboard.press('i');
  await expect(page.getByRole('complementary', { name: 'Node settings' })).toBeVisible();

  await page.locator('.react-flow__pane').click({ position: { x: 24, y: 24 } });
  await expect(page.getByRole('complementary', { name: 'Node settings' })).toHaveCount(0);

  await firstCanvasNode.dblclick();
  await expect(page.getByRole('complementary', { name: 'Node settings' })).toBeVisible();

  await page.locator('.react-flow__pane').click({ position: { x: 24, y: 24 } });
  await expect(page.getByRole('complementary', { name: 'Node settings' })).toHaveCount(0);

  await switchEditorFocus(page, 'Viewer');
  const projectMediaSidebar = page.getByRole('complementary', { name: 'Project media library' });
  await expect(projectMediaSidebar).toBeVisible();
  await expect(projectMediaSidebar.getByText('Project media')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Import media' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'New folder' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'New sequence' })).toBeVisible();
  await expect(page.getByLabel('Canvas creation toolbar')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Save canvas' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Open canvas navigation' })).toHaveCount(0);
  await expect(page.getByTestId('editor-video-viewer')).toBeVisible();
  await expect(page.getByTestId('editor-program-monitor')).toBeVisible();
  await expect(page.getByTestId('editor-program-frame')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play timeline' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Blade / Cut tool' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Toggle snapping' })).toBeVisible();
  expect(await timelineItemCount(page)).toBe(initialTimelineItems);

  await switchEditorFocus(page, 'Canvas');
  await expect(page.getByLabel('Canvas creation toolbar')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save canvas' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open canvas navigation' })).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Project media library' })).toHaveCount(0);
  expect(await timelineItemCount(page)).toBe(initialTimelineItems);

  assertNoEditorClientErrors(errors);
});

test('mobile drawer controls open project media and inspector drawers with focus return', async ({ page }) => {
  test.setTimeout(60_000);
  const errors = trackEditorClientErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Viewer');

  const mediaToggle = page.getByRole('button', { name: 'Project media', exact: true });
  await expect(mediaToggle).toBeVisible();
  await expect(mediaToggle).toHaveAttribute('aria-controls', 'studio-project-media-panel');
  await expect(mediaToggle).toHaveAttribute('aria-expanded', 'false');
  await expectTapTarget(mediaToggle, 'mobile Project media drawer toggle');

  await mediaToggle.click();
  await expect(mediaToggle).toHaveAttribute('aria-expanded', 'true');
  const mediaDrawer = page.locator('#studio-project-media-panel');
  await expect(mediaDrawer).toBeVisible();
  await expectWithinViewport(page, mediaDrawer, 'mobile Project media drawer');
  await expect(mediaDrawer.getByRole('searchbox', { name: 'Search media' })).toBeVisible();
  const closeMediaDrawer = mediaDrawer.getByRole('button', { name: 'Close dialog: Project media' });
  await expectTapTarget(closeMediaDrawer, 'mobile Project media drawer close');
  await expect(closeMediaDrawer).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect.poll(() => mediaDrawer.evaluate((drawer) => drawer.contains(document.activeElement))).toBe(false);
  await closeMediaDrawer.click();
  await expect(mediaToggle).toHaveAttribute('aria-expanded', 'false');
  await expect(mediaToggle).toBeFocused();

  const inspectorToggle = page.getByRole('button', { name: 'Clip inspector', exact: true });
  await expect(inspectorToggle).toHaveAttribute('aria-controls', 'studio-inspector-panel');
  await expect(inspectorToggle).toHaveAttribute('aria-expanded', 'false');
  await expectTapTarget(inspectorToggle, 'mobile Inspector drawer toggle');

  await inspectorToggle.click();
  await expect(inspectorToggle).toHaveAttribute('aria-expanded', 'true');
  const inspectorDrawer = page.locator('#studio-inspector-panel');
  await expect(inspectorDrawer).toBeVisible();
  await expectWithinViewport(page, inspectorDrawer, 'mobile Inspector drawer');
  await expect(inspectorDrawer.getByText('Clip name')).toBeVisible();
  const closeInspectorDrawer = inspectorDrawer.getByRole('button', { name: 'Close dialog: Clip inspector' });
  await expectTapTarget(closeInspectorDrawer, 'mobile Inspector drawer close');
  await expect(closeInspectorDrawer).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(inspectorToggle).toHaveAttribute('aria-expanded', 'false');
  await expect(inspectorToggle).toBeFocused();

  assertNoEditorClientErrors(errors);
});

test('mobile responsive canvas controls timeline scroll and export dialog stay usable', async ({ page }) => {
  test.setTimeout(60_000);
  const errors = trackEditorClientErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Canvas');

  const canvasToolbar = page.getByLabel('Canvas creation toolbar');
  await expectWithinViewport(page, canvasToolbar, 'mobile canvas creation toolbar');
  const imageTools = page.getByRole('button', { name: 'Image tools' });
  await expectTapTarget(imageTools, 'mobile Image tools button', 38);
  await imageTools.click();
  const imageMenu = page.getByRole('menu', { name: 'Image tools' });
  await expectWithinViewport(page, imageMenu, 'mobile Image tools drawer menu');
  await expect(imageMenu.locator('[data-canvas-toolbar-block-id="generate-image"]')).toBeVisible();
  await page.keyboard.press('Escape');

  const canvasNavigation = page.getByRole('button', { name: 'Open canvas navigation' });
  await expectTapTarget(canvasNavigation, 'mobile canvas navigator button', 38);
  await canvasNavigation.click();
  const canvasNavigationId = await canvasNavigation.getAttribute('aria-controls');
  expect(canvasNavigationId).toBeTruthy();
  const canvasPopover = page.locator(`#${canvasNavigationId}`);
  await expectWithinViewport(page, canvasPopover, 'mobile canvas navigator drawer');
  await expect(canvasPopover.getByRole('group', { name: 'Canvas' })).toBeVisible();
  await page.keyboard.press('Escape');

  await switchEditorFocus(page, 'Viewer');
  const timelineViewport = page.locator('[class*="timelineViewport"]').first();
  await expect(timelineViewport).toBeVisible();
  const timelineScrollMetrics = await timelineViewport.evaluate((element) => {
    const before = element.scrollLeft;
    element.scrollLeft = 160;
    element.dispatchEvent(new Event('scroll', { bubbles: true }));
    return {
      before,
      clientWidth: element.clientWidth,
      scrollLeft: element.scrollLeft,
      scrollWidth: element.scrollWidth,
    };
  });
  expect(timelineScrollMetrics.scrollWidth).toBeGreaterThan(timelineScrollMetrics.clientWidth);
  expect(timelineScrollMetrics.scrollLeft).toBeGreaterThan(timelineScrollMetrics.before);

  const exportTrigger = page.getByRole('button', { name: 'Open export dialog' });
  await expectTapTarget(exportTrigger, 'mobile export dialog trigger', 38);
  await exportTrigger.click();
  const exportDialog = page.getByRole('dialog', { name: 'Export sequence' });
  await expectWithinViewport(page, exportDialog, 'mobile export dialog');
  await expect(exportDialog.getByRole('button', { name: 'Export video' })).toBeVisible();
  await page.getByRole('button', { name: 'Close export dialog' }).click();

  assertNoEditorClientErrors(errors);
});

test('Studio workspace dark theme keeps key editor surfaces readable', async ({ page }) => {
  test.setTimeout(60_000);
  const errors = trackEditorClientErrors(page);

  await page.addInitScript(() => {
    window.localStorage.setItem('maxvideoai.studio.theme.v1', 'dark');
    window.localStorage.setItem('maxvideoai.studio.theme.userOverride.v1', 'true');
  });
  await openFreshEditorWorkspace(page);
  const shell = page.locator('[data-studio-theme="dark"]');
  await expectDarkReadableSurface(shell, 'dark Studio workspace shell');
  await expectDarkReadableSurface(page.locator('[class*="editorTopbar"]').first(), 'dark Studio workspace topbar');
  await expect(page.getByRole('button', { name: 'Switch Studio to light mode' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Canvas', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Viewer', exact: true })).toBeVisible();

  await expectDarkReadableSurface(page.locator('[class*="canvasNavigator"]').first(), 'dark canvas map');
  await expectDarkReadableSurface(page.locator('[class*="graphNode"]').first(), 'dark canvas node card');
  await expectDarkReadableSurface(page.locator('[class*="nodeActionButton"]').first(), 'dark canvas node action button');

  await switchEditorFocus(page, 'Viewer');
  const projectMediaSidebar = page.getByRole('complementary', { name: 'Project media library' });
  await expectDarkReadableSurface(projectMediaSidebar, 'dark project media sidebar');
  await expectDarkReadableSurface(projectMediaSidebar.getByRole('searchbox', { name: 'Search media' }), 'dark project media search');
  await expectDarkReadableSurface(projectMediaSidebar.locator('[data-project-media-card]').first(), 'dark project media card');
  await expectDarkReadableSurface(page.getByTestId('editor-program-monitor'), 'dark viewer program monitor');
  await expectDarkReadableSurface(page.locator('[class*="viewerProgramControlsPanel"]').first(), 'dark viewer controls');

  await projectMediaSidebar.getByRole('button', { name: 'New sequence' }).click();
  await expectDarkReadableSurface(page.getByRole('complementary', { name: 'Sequence settings' }), 'dark sequence inspector');
  await expectActiveControlFillReadable(page.locator('[data-timeline-tool="select"]'), 'dark active timeline selection tool');
  await expectActiveControlFillReadable(page.getByRole('button', { name: 'Toggle snapping' }), 'dark active snapping timeline control');
  await page.getByRole('button', { name: 'Blade / Cut tool' }).click();
  await expectActiveControlFillReadable(page.getByRole('button', { name: 'Blade / Cut tool' }), 'dark active timeline blade tool');

  assertNoEditorClientErrors(errors);
});

test('Studio workspace can switch to light appearance', async ({ page }) => {
  test.setTimeout(60_000);
  const errors = trackEditorClientErrors(page);

  await openFreshEditorWorkspace(page);
  const shell = page.locator('[data-studio-theme]');
  await expect(shell).toHaveAttribute('data-studio-theme', 'light');
  await expect(page.getByRole('button', { name: 'Switch Studio to dark mode' })).toBeVisible();

  await page.getByRole('button', { name: 'Switch Studio to dark mode' }).click();
  await expect(shell).toHaveAttribute('data-studio-theme', 'dark');
  await expect(page.getByRole('button', { name: 'Switch Studio to light mode' })).toBeVisible();

  await page.getByRole('button', { name: 'Switch Studio to light mode' }).click();
  await expect(shell).toHaveAttribute('data-studio-theme', 'light');
  await expect(page.getByRole('button', { name: 'Switch Studio to dark mode' })).toBeVisible();
  const shellColors = await page.locator('[data-studio-theme="light"]').evaluate((element) => {
    const styles = getComputedStyle(element);
    return {
      background: styles.backgroundColor,
      text: styles.color,
    };
  });
  expect(shellColors.background).not.toBe('rgb(5, 9, 17)');
  expect(shellColors.text).not.toBe('rgb(238, 242, 255)');

  await expectLightReadableSurface(page.locator('[data-studio-theme="light"]'), 'light Studio workspace shell');
  await expectLightReadableSurface(page.getByRole('button', { name: 'Switch Studio to dark mode' }), 'light Studio theme toggle');
  await expect(page.getByRole('button', { name: 'Open export dialog' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save canvas' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open canvas navigation' })).toBeVisible();
  await expect(page.getByLabel('Canvas creation toolbar')).toBeVisible();

  await page.getByRole('button', { name: 'Save canvas' }).click();
  await expectLightReadableSurface(page.getByRole('dialog', { name: 'Save canvas' }), 'light canvas save popover');
  await expectLightReadableSurface(page.getByLabel('Canvas name'), 'light canvas save input');
  await page.getByRole('button', { name: 'Save canvas' }).click();

  await expectLightReadableSurface(page.locator('[class*="canvasNavigator"]').first(), 'light canvas map');
  await expectLightReadableSurface(page.locator('[class*="graphNode"]').first(), 'light canvas node card');
  await expectLightReadableSurface(page.locator('[class*="nodeActionButton"]').first(), 'light canvas node action button');

  await switchEditorFocus(page, 'Viewer');
  await expect(page.getByRole('complementary', { name: 'Project media library' })).toBeVisible();
  await expectLightReadableSurface(page.getByRole('complementary', { name: 'Project media library' }), 'light project media sidebar');
  await expectLightReadableSurface(page.getByRole('searchbox', { name: 'Search media' }), 'light project media search');
  await expectLightReadableSurface(page.locator('[data-project-media-card]').first(), 'light project media card');
  await expectLightReadableSurface(page.getByTestId('editor-program-monitor'), 'light viewer program monitor');
  await expectLightReadableSurface(page.locator('[class*="viewerProgramControlsPanel"]').first(), 'light viewer controls');

  await page.getByRole('button', { name: 'New folder' }).click();
  const folderDialog = page.getByRole('dialog', { name: 'New folder' });
  await expectLightReadableSurface(folderDialog, 'light project media folder dialog');
  await expectLightReadableSurface(folderDialog.getByRole('textbox'), 'light project media folder input');
  await folderDialog.getByRole('button', { name: 'Cancel' }).click();

  await page.getByRole('button', { name: 'New sequence' }).click();
  await expectLightReadableSurface(page.getByRole('complementary', { name: 'Sequence settings' }), 'light sequence inspector');

  await page.getByRole('button', { name: 'Lock V1 track' }).click();
  await expectLightReadableSurface(page.locator('[data-timeline-track-label="video"]'), 'light locked timeline track controls');
  await expectLightReadableSurface(page.getByRole('button', { name: 'Blade / Cut tool' }), 'light timeline blade control');
  await expectActiveControlFillReadable(page.locator('[data-timeline-tool="select"]'), 'light active timeline selection tool');
  await expectActiveControlFillReadable(page.getByRole('button', { name: 'Toggle snapping' }), 'light active snapping timeline control');
  await page.getByRole('button', { name: 'Blade / Cut tool' }).click();
  await expectActiveControlFillReadable(page.getByRole('button', { name: 'Blade / Cut tool' }), 'light active timeline blade tool');

  await page.getByRole('button', { name: 'Open export dialog' }).click();
  const exportDialog = page.getByRole('dialog', { name: 'Export sequence' });
  await expectLightReadableSurface(exportDialog, 'light export dialog');
  await expectLightReadableSurface(page.locator('[class*="exportReadinessItem"]').first(), 'light export readiness item');
  await expect(page.getByRole('button', { name: 'Export video' })).toBeVisible();
  await page.getByRole('button', { name: 'Close export dialog' }).click();

  assertNoEditorClientErrors(errors);
});

test('light Studio keeps sequence inspector form text readable', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await openFreshEditorWorkspace(page);
  await expect(page.locator('[data-studio-theme]')).toHaveAttribute('data-studio-theme', 'light');
  await switchEditorFocus(page, 'Viewer');

  const projectMediaSidebar = page.getByRole('complementary', { name: 'Project media library' });
  await projectMediaSidebar.getByRole('button', { name: 'New sequence' }).click();

  const sequenceSettings = page.getByRole('complementary', { name: 'Sequence settings' });
  await expect(sequenceSettings).toBeVisible();

  const colorMetrics = await sequenceSettings.evaluate((panel) => {
    const input = panel.querySelector('input');
    const select = panel.querySelector('select');
    if (!(input instanceof HTMLElement) || !(select instanceof HTMLElement)) {
      return null;
    }

    const luminance = (color: string) => {
      const channels = color.match(/\d+(\.\d+)?/g)?.slice(0, 3).map(Number) ?? [255, 255, 255];
      const [red, green, blue] = channels.map((channel) => {
        const value = channel / 255;
        return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    };

    const inputColor = getComputedStyle(input).color;
    const selectColor = getComputedStyle(select).color;
    return {
      inputColor,
      inputLuminance: luminance(inputColor),
      selectColor,
      selectLuminance: luminance(selectColor),
    };
  });

  expect(colorMetrics).not.toBeNull();
  expect(colorMetrics?.inputLuminance).toBeLessThan(0.2);
  expect(colorMetrics?.selectLuminance).toBeLessThan(0.2);

  assertNoEditorClientErrors(errors);
});

test('viewer project media grid scrolls without shrinking media cards', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Viewer');

  const projectMediaGrid = page.locator('[class*="projectMediaGrid"]');
  await expect(projectMediaGrid).toBeVisible();

  for (let index = 0; index < 18; index += 1) {
    await page.getByRole('button', { name: 'New sequence' }).click();
  }

  await expect(projectMediaGrid.locator('[data-project-media-card]')).toHaveCount(21);
  const beforeMetrics = await projectMediaGrid.evaluate((grid) => {
    const cardHeights = Array.from(grid.querySelectorAll('[data-project-media-card]'))
      .map((card) => Math.round(card.getBoundingClientRect().height));
    const styles = getComputedStyle(grid);
    return {
      cardHeights: Array.from(new Set(cardHeights)),
      clientHeight: grid.clientHeight,
      gridAutoRows: styles.gridAutoRows,
      scrollHeight: grid.scrollHeight,
      scrollbarWidth: styles.scrollbarWidth,
    };
  });

  expect(beforeMetrics.scrollHeight).toBeGreaterThan(beforeMetrics.clientHeight);
  expect(beforeMetrics.cardHeights).toEqual([121]);
  expect(beforeMetrics.gridAutoRows).toBe('max-content');
  expect(beforeMetrics.scrollbarWidth).toBe('none');

  const gridBox = await projectMediaGrid.boundingBox();
  expect(gridBox).not.toBeNull();
  if (!gridBox) return;

  await page.mouse.move(gridBox.x + gridBox.width / 2, gridBox.y + gridBox.height / 2);
  await page.mouse.wheel(0, 520);

  await expect.poll(async () => projectMediaGrid.evaluate((grid) => grid.scrollTop)).toBeGreaterThan(0);
  const afterCardHeights = await projectMediaGrid.evaluate((grid) =>
    Array.from(new Set(Array.from(grid.querySelectorAll('[data-project-media-card]'))
      .map((card) => Math.round(card.getBoundingClientRect().height))))
  );
  expect(afterCardHeights).toEqual([121]);

  assertNoEditorClientErrors(errors);
});

test('viewer project media supports range selection and bulk delete', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Viewer');

  const projectMediaSidebar = page.getByRole('complementary', { name: 'Project media library' });
  const projectMediaGrid = projectMediaSidebar.locator('[class*="projectMediaGrid"]');
  await expect(projectMediaGrid).toBeVisible();

  for (let index = 0; index < 3; index += 1) {
    await projectMediaSidebar.getByRole('button', { name: 'New sequence' }).click();
  }

  const sequence2 = projectMediaGrid.locator('[data-project-sequence-id]', { hasText: 'Sequence 2' });
  const sequence3 = projectMediaGrid.locator('[data-project-sequence-id]', { hasText: 'Sequence 3' });
  const sequence4 = projectMediaGrid.locator('[data-project-sequence-id]', { hasText: 'Sequence 4' });

  await sequence2.click();
  await sequence4.click({ modifiers: ['Shift'] });
  await expect(projectMediaGrid.locator('[data-project-media-card][data-selected="true"]')).toHaveCount(3);

  await sequence3.click({ modifiers: ['ControlOrMeta'] });
  await expect(projectMediaGrid.locator('[data-project-media-card][data-selected="true"]')).toHaveCount(2);
  await expect(sequence2).toHaveAttribute('data-selected', 'true');
  await expect(sequence3).not.toHaveAttribute('data-selected', 'true');
  await expect(sequence4).toHaveAttribute('data-selected', 'true');

  let dialogCount = 0;
  page.on('dialog', async (dialog) => {
    dialogCount += 1;
    await dialog.accept();
  });
  await projectMediaSidebar.getByRole('button', { name: 'Delete' }).click();

  await expect(sequence2).toHaveCount(0);
  await expect(sequence3).toBeVisible();
  await expect(sequence4).toHaveCount(0);
  await expect(projectMediaGrid.locator('[data-project-media-card][data-selected="true"]')).toHaveCount(0);
  expect(dialogCount).toBe(1);

  assertNoEditorClientErrors(errors);
});

test('viewer project media bulk deletes generated thumbnails with one confirmation', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Viewer');

  const projectMediaSidebar = page.getByRole('complementary', { name: 'Project media library' });
  const projectMediaGrid = projectMediaSidebar.locator('[class*="projectMediaGrid"]');
  const output1 = projectMediaGrid.locator('[data-project-media-generated-id]', { hasText: 'Output 01' });
  const output2 = projectMediaGrid.locator('[data-project-media-generated-id]', { hasText: 'Output 02' });

  await output1.click();
  await output2.click({ modifiers: ['ControlOrMeta'] });
  await expect(projectMediaGrid.locator('[data-project-media-card][data-selected="true"]')).toHaveCount(2);

  let dialogCount = 0;
  page.on('dialog', async (dialog) => {
    dialogCount += 1;
    await dialog.accept();
  });
  await projectMediaSidebar.getByRole('button', { name: 'Delete' }).click();

  await expect(output1).toHaveCount(0);
  await expect(output2).toHaveCount(0);
  expect(dialogCount).toBe(1);

  assertNoEditorClientErrors(errors);
});

test('canvas toolbar can marquee select multiple nodes and delete them', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Canvas');

  const selectedNodeIds = ['asset-product-image', 'asset-style-reference'];
  const initialNodeCount = await canvasNodeCount(page);
  expect(initialNodeCount).toBeGreaterThan(selectedNodeIds.length);

  const marqueeSelect = page.getByRole('button', { name: 'Marquee select canvas nodes' });
  await expect(marqueeSelect).toBeVisible();
  await marqueeSelect.click();
  await expect(marqueeSelect).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Delete selected canvas nodes' })).toBeDisabled();

  await marqueeSelectCanvasNodes(page, selectedNodeIds);

  const selectedNodes = page.locator('.react-flow__node.selected');
  await expect.poll(() => selectedNodes.count()).toBeGreaterThanOrEqual(selectedNodeIds.length);
  const selectedCount = await selectedNodes.count();
  for (const nodeId of selectedNodeIds) {
    await expect(page.locator(`.react-flow__node[data-id="${nodeId}"]`)).toHaveClass(/selected/);
  }
  await expect(page.getByText(/\d+ selected/)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Delete selected canvas nodes' })).toBeEnabled();
  await page.getByRole('button', { name: 'Delete selected canvas nodes' }).click();

  await expect.poll(() => canvasNodeCount(page)).toBe(initialNodeCount - selectedCount);
  for (const nodeId of selectedNodeIds) {
    await expect(page.locator(`.react-flow__node[data-id="${nodeId}"]`)).toHaveCount(0);
  }
  await expect(page.getByText(/\d+ selected/)).toHaveCount(0);
  assertNoEditorClientErrors(errors);
});

test('canvas marquee selection draws a visible dashed selection rectangle', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Canvas');

  const selectedNodeIds = ['asset-product-image', 'asset-style-reference'];
  const bounds = await canvasMarqueeBoundsForNodes(page, selectedNodeIds);
  expect(bounds).not.toBeNull();
  if (!bounds) return;

  const marqueeSelect = page.getByRole('button', { name: 'Marquee select canvas nodes' });
  await expect(marqueeSelect).toBeVisible();
  await marqueeSelect.click();

  await page.mouse.move(bounds.left, bounds.top);
  await page.mouse.down();
  await page.mouse.move(bounds.right, bounds.bottom, { steps: 14 });

  const selectionRect = page.locator('[data-canvas-selection-box="true"]');
  try {
    await expect(selectionRect).toBeVisible();
    const selectionStyle = await selectionRect.evaluate((element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return {
        backgroundColor: style.backgroundColor,
        borderTopColor: style.borderTopColor,
        borderTopStyle: style.borderTopStyle,
        borderTopWidth: style.borderTopWidth,
        height: rect.height,
        width: rect.width,
      };
    });

    expect(selectionStyle.width).toBeGreaterThan(24);
    expect(selectionStyle.height).toBeGreaterThan(24);
    expect(selectionStyle.borderTopStyle).toBe('dashed');
    expect(selectionStyle.borderTopWidth).not.toBe('0px');
    expect(selectionStyle.borderTopColor).not.toBe('rgba(0, 0, 0, 0)');
    expect(selectionStyle.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
  } finally {
    await page.mouse.up();
  }

  assertNoEditorClientErrors(errors);
});

test('canvas toolbar groups creation tools by media workflow', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Canvas');

  await expect(page.getByRole('button', { name: 'Undo canvas edit' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Redo canvas edit' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Select canvas nodes', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Marquee select canvas nodes' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Image tools' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Video tools' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Audio tools' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Text tools' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save canvas' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open canvas navigation' })).toBeVisible();

  await expect(page.getByRole('button', { name: /^\+$/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Media blocks' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Text blocks' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Generate blocks' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Quick add' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Import media' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Canvas tools' })).toHaveCount(0);
  await expect(page.getByText('Fit graph')).toHaveCount(0);

  await page.getByRole('button', { name: 'Image tools' }).click();
  const imageMenu = page.getByRole('menu', { name: 'Image tools' });
  await expect(imageMenu).toBeVisible();
  await expect(imageMenu.locator('[data-canvas-toolbar-block-id="image"]')).toContainText('Image');
  await expect(imageMenu.locator('[data-canvas-toolbar-block-id="generate-image"]')).toContainText('Generate image');
  await expect(imageMenu.locator('[data-canvas-toolbar-block-id="character-builder"]')).toContainText('Character Builder');
  await expect(imageMenu.locator('[data-canvas-toolbar-block-id="angle"]')).toContainText('Angle');
  await expect(imageMenu.locator('[data-canvas-toolbar-block-id="upscale-image"]')).toContainText('Upscale image');

  await page.getByRole('button', { name: 'Video tools' }).click();
  const videoMenu = page.getByRole('menu', { name: 'Video tools' });
  await expect(videoMenu).toBeVisible();
  await expect(videoMenu.locator('[data-canvas-toolbar-block-id="video"]')).toContainText('Video');
  await expect(videoMenu.locator('[data-canvas-toolbar-block-id="generate-video"]')).toContainText('Generate video');
  await expect(videoMenu.locator('[data-canvas-toolbar-block-id="modify-video"]')).toContainText('Modify video');
  await expect(videoMenu.locator('[data-canvas-toolbar-block-id="storyboard-video"]')).toHaveCount(0);
  await expect(videoMenu.locator('[data-canvas-toolbar-block-id="character-video"]')).toHaveCount(0);
  await expect(videoMenu.locator('[data-canvas-toolbar-block-id="upscale-video"]')).toContainText('Upscale video');

  await page.getByRole('button', { name: 'Audio tools' }).click();
  const audioMenu = page.getByRole('menu', { name: 'Audio tools' });
  await expect(audioMenu).toBeVisible();
  await expect(audioMenu.locator('[data-canvas-toolbar-block-id="music"]')).toContainText('Music');
  await expect(audioMenu.locator('[data-canvas-toolbar-block-id="audio-music"]')).toContainText('Generate music');
  await expect(audioMenu.locator('[data-canvas-toolbar-block-id="audio-voiceover"]')).toContainText('Voice over');
  await expect(audioMenu.locator('[data-canvas-toolbar-block-id="audio-sfx"]')).toContainText('SFX');
  await expect(audioMenu.locator('[data-canvas-toolbar-block-id="audio-sound-design"]')).toContainText('Sound design');
  await expect(audioMenu.locator('[data-canvas-toolbar-block-id="audio-sound-design-voice"]')).toContainText('Sound design + voice');

  await page.getByRole('button', { name: 'Text tools' }).click();
  const textMenu = page.getByRole('menu', { name: 'Text tools' });
  await expect(textMenu).toBeVisible();
  await expect(textMenu.locator('[data-canvas-toolbar-block-id="free-text"]')).toContainText('Free text');
  await expect(textMenu.locator('[data-canvas-toolbar-block-id="chat-box"]')).toContainText('Chat box');
  await expect(textMenu.locator('[data-canvas-toolbar-block-kind="text-prompt"]')).toBeVisible();
  assertNoEditorClientErrors(errors);
});

test('studio menu popover and dialog controls support keyboard focus return', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Canvas');

  const imageTools = page.getByRole('button', { name: 'Image tools' });
  await imageTools.focus();
  await page.keyboard.press('Enter');
  await expect(imageTools).toHaveAttribute('aria-expanded', 'true');
  const imageMenuId = await imageTools.getAttribute('aria-controls');
  expect(imageMenuId).toBeTruthy();
  const imageMenu = page.locator(`#${imageMenuId}`);
  await expect(imageMenu).toHaveAttribute('role', 'menu');
  await expect(imageMenu.getByRole('menuitem').first()).toBeFocused();

  await page.keyboard.press('ArrowDown');
  await expect(imageMenu.getByRole('menuitem').nth(1)).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(imageMenu.getByRole('menuitem').first()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(imageMenu).toHaveCount(0);
  await expect(imageTools).toBeFocused();
  await expect(imageTools).toHaveAttribute('aria-expanded', 'false');

  const canvasNavigation = page.getByRole('button', { name: 'Open canvas navigation' });
  await canvasNavigation.focus();
  await page.keyboard.press('Enter');
  await expect(canvasNavigation).toHaveAttribute('aria-expanded', 'true');
  const canvasNavigationId = await canvasNavigation.getAttribute('aria-controls');
  expect(canvasNavigationId).toBeTruthy();
  const canvasPopover = page.locator(`#${canvasNavigationId}`);
  await expect(canvasPopover).toHaveAttribute('role', 'dialog');
  await expect(canvasPopover.getByRole('group', { name: 'Canvas' })).toBeVisible();
  await expect(canvasPopover.getByRole('button', { name: 'My canvases' })).toHaveAttribute('aria-pressed', 'true');
  await canvasPopover.getByRole('button', { name: 'Templates' }).click();
  await expect(canvasPopover.getByRole('button', { name: 'Templates' })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
  await expect(canvasPopover).toHaveCount(0);
  await expect(canvasNavigation).toBeFocused();

  await switchEditorFocus(page, 'Viewer');
  const exportTrigger = page.getByRole('button', { name: 'Open export dialog' });
  await exportTrigger.focus();
  await page.keyboard.press('Enter');
  const exportDialog = page.getByRole('dialog', { name: 'Export sequence' });
  await expect(exportDialog).toBeVisible();
  await expect(exportDialog.getByRole('button', { name: 'Close export dialog' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(exportDialog.getByRole('button', { name: /Prepare render JSON/ })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(exportDialog).toHaveCount(0);
  await expect(exportTrigger).toBeFocused();

  assertNoEditorClientErrors(errors);
});

test('canvas keyboard shortcuts undo and redo canvas actions without stealing editable input shortcuts', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Canvas');

  const initialNodeCount = await canvasNodeCount(page);
  await page.getByRole('button', { name: 'Text tools' }).click();
  const promptTemplate = page.locator('[data-canvas-toolbar-block-id="free-text"]');
  const canvas = page.locator('.react-flow');
  const templateBox = await promptTemplate.boundingBox();
  const canvasBox = await canvas.boundingBox();
  expect(templateBox).not.toBeNull();
  expect(canvasBox).not.toBeNull();
  if (!templateBox || !canvasBox) return;

  await page.mouse.move(templateBox.x + templateBox.width / 2, templateBox.y + templateBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.56, canvasBox.y + canvasBox.height * 0.32, { steps: 12 });
  await page.mouse.up();
  await expect.poll(() => canvasNodeCount(page)).toBe(initialNodeCount + 1);
  await page.locator('.react-flow__pane').click({ position: { x: 24, y: 24 } });
  await expect(page.locator('[data-active-editor-surface="canvas"]')).toBeVisible();

  await page.evaluate(() => {
    document.querySelectorAll('[data-canvas-shortcut-editable-test]').forEach((element) => element.remove());

    const createEditable = (id: string, contentEditableValue: string | null) => {
      const editable = document.createElement('div');
      editable.dataset.canvasShortcutEditableTest = id;
      editable.tabIndex = 0;
      editable.textContent = `${id} editor`;
      editable.style.position = 'fixed';
      editable.style.left = id === 'plain' ? '190px' : '24px';
      editable.style.top = '24px';
      editable.style.zIndex = '9999';
      editable.style.width = '144px';
      editable.style.height = '32px';
      editable.style.padding = '4px';
      editable.style.background = 'rgb(255, 255, 255)';
      editable.style.color = 'rgb(0, 0, 0)';
      if (contentEditableValue === null) {
        editable.setAttribute('contenteditable', '');
      } else {
        editable.setAttribute('contenteditable', contentEditableValue);
      }
      document.body.append(editable);
    };

    createEditable('default', null);
    createEditable('plain', 'plaintext-only');
  });

  await page.locator('[data-canvas-shortcut-editable-test="default"]').click();
  await page.keyboard.press('Control+Z');
  await expect.poll(() => canvasNodeCount(page)).toBe(initialNodeCount + 1);

  await page.locator('[data-canvas-shortcut-editable-test="plain"]').click();
  await page.keyboard.press('Control+Z');
  await expect.poll(() => canvasNodeCount(page)).toBe(initialNodeCount + 1);

  await page.locator('.react-flow__pane').click({ position: { x: 24, y: 24 } });
  await expect(page.getByRole('button', { name: 'Undo canvas edit' })).toBeEnabled();
  await page.keyboard.press('Control+Z');
  await expect.poll(() => canvasNodeCount(page)).toBe(initialNodeCount);
  await expect(page.getByRole('button', { name: 'Redo canvas edit' })).toBeEnabled();

  await page.getByRole('button', { name: 'Save canvas' }).click();
  await page.getByLabel('Canvas name').fill('Draft template');
  await page.keyboard.press('Control+Y');
  await expect.poll(() => canvasNodeCount(page)).toBe(initialNodeCount);

  await page.locator('.react-flow__pane').click({ position: { x: 24, y: 24 } });
  await page.keyboard.press('Control+Y');
  await expect.poll(() => canvasNodeCount(page)).toBe(initialNodeCount + 1);

  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      code: 'KeyY',
      ctrlKey: true,
      key: 'z',
    }));
  });
  await expect.poll(() => canvasNodeCount(page)).toBe(initialNodeCount);

  await page.keyboard.press('Control+Y');
  await expect.poll(() => canvasNodeCount(page)).toBe(initialNodeCount + 1);

  await page.keyboard.press('Control+Z');
  await expect.poll(() => canvasNodeCount(page)).toBe(initialNodeCount);
  await page.keyboard.press('Control+Shift+Z');
  await expect.poll(() => canvasNodeCount(page)).toBe(initialNodeCount + 1);

  assertNoEditorClientErrors(errors);
});

test('canvas inspector shortcut stays scoped to the canvas surface', async ({ page }) => {
  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Canvas');
  await page.locator('.react-flow__node').first().click();

  await page.locator('[data-timeline-track="video-1"]').click({ position: { x: 8, y: 8 } });
  await expect(page.locator('[data-active-editor-surface="timeline"]')).toBeVisible();
  await page.keyboard.press('i');
  await expect(page.locator('[data-timeline-in-marker="true"]')).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Node settings' })).toHaveCount(0);

  await page.locator('.react-flow__pane').click({ position: { x: 24, y: 24 } });
  await expect(page.locator('[data-active-editor-surface="canvas"]')).toBeVisible();
  await page.keyboard.press('i');
  await expect(page.getByRole('complementary', { name: 'Node settings' })).toBeVisible();
});

test('viewer mode can create and switch between multiple sequences', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await openEditorWorkspace(page);
  await switchEditorFocus(page, 'Viewer');

  const initialTimelineItems = await timelineItemCount(page);
  expect(initialTimelineItems).toBeGreaterThan(0);
  await expect(page.locator('[data-project-sequence-id]')).toHaveCount(1);
  await expect(page.locator('[data-project-sequence-id="sequence-main"]')).toHaveAttribute('aria-pressed', 'true');

  await page.locator('[data-project-sequence-create="true"]').click();

  await expect(page.locator('[data-project-sequence-id]')).toHaveCount(2);
  const secondSequence = page.locator('[data-project-sequence-id]', { hasText: 'Sequence 2' });
  await expect(secondSequence).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => timelineItemCount(page)).toBe(0);

  await page.locator('[data-project-sequence-id="sequence-main"]').click();
  await expect(page.locator('[data-project-sequence-id="sequence-main"]')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => timelineItemCount(page)).toBe(initialTimelineItems);

  await secondSequence.click();
  await expect(secondSequence).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => timelineItemCount(page)).toBe(0);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('header').getByText('MaxVideoAI Editor')).toBeVisible();
  await switchEditorFocus(page, 'Viewer');
  await expect(page.locator('[data-project-sequence-id]')).toHaveCount(2);
  await expect(page.locator('[data-project-sequence-id]', { hasText: 'Sequence 2' })).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => timelineItemCount(page)).toBe(0);

  await page.locator('[data-project-sequence-id="sequence-main"]').click();
  await expect.poll(() => timelineItemCount(page)).toBe(initialTimelineItems);

  assertNoEditorClientErrors(errors);
});

test('viewer project media import inserts a library asset into the timeline', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await page.route('**/api/media-library/assets**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        assets: [
          {
            id: 'client-board',
            url: '/storyboard/examples/storyboarder-product-reference.jpg',
            thumbUrl: '/storyboard/examples/storyboarder-product-reference.jpg',
            kind: 'image',
            width: 2048,
            height: 2048,
            source: 'upload',
          },
        ],
      }),
    });
  });

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Viewer');

  const initialTimelineItems = await timelineItemCount(page);
  await page.getByRole('button', { name: 'Import media' }).click();
  await expect(page.getByRole('dialog', { name: 'Import project media' })).toBeVisible();
  await page.getByRole('button', { name: 'Select storyboarder-product-reference.jpg' }).click();
  await page.getByRole('button', { name: /Import selected.*1/ }).click();
  await expect(page.getByText('storyboarder-product-reference.jpg imported into Project media.')).toBeVisible();

  const importedCard = page.locator('[data-project-media-asset-id]', { hasText: 'storyboarder-product-reference.jpg' });
  await expect(importedCard).toBeVisible();
  await importedCard.click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Insert at playhead' }).click();

  await expect(page.getByText('storyboarder-product-reference.jpg inserted at the playhead')).toBeVisible();
  await expect.poll(() => timelineItemCount(page)).toBe(initialTimelineItems + 1);
  await expect(page.getByRole('button', { name: 'Viewer', exact: true })).toHaveAttribute('aria-pressed', 'true');
  assertNoEditorClientErrors(errors);
});

test('viewer project media can be dragged into a compatible timeline track', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await page.route('**/api/media-library/assets**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        assets: [
          {
            durationSec: 8,
            id: 'client-drag-video',
            mediaType: 'asset-video',
            mimeType: 'video/mp4',
            thumbUrl: '/assets/marketing/reference-workflow-final-video.webp',
            url: '/assets/gallery/aerial-road.mp4',
            width: 1920,
            height: 1080,
            source: 'upload',
          },
        ],
      }),
    });
  });

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Viewer');

  const initialTimelineItems = await timelineItemCount(page);
  await page.getByRole('button', { name: 'Add video track' }).click();
  await page.getByRole('button', { name: 'Import media' }).click();
  await page.getByRole('button', { name: 'Select aerial-road.mp4' }).click();
  await page.getByRole('button', { name: /Import selected.*1/ }).click();
  await expect(page.getByText('aerial-road.mp4 imported into Project media.')).toBeVisible();

  const importedVideoCard = page.locator('[data-project-media-asset-id]', { hasText: 'aerial-road.mp4' }).first();
  await expect(importedVideoCard).toHaveAttribute('data-project-media-drag-kind', 'video');
  await expect(importedVideoCard).toHaveAttribute('data-project-media-duration-sec', '8');
  const videoLane = page.locator('[data-timeline-track="video-2"]');
  const occupiedVideoLane = page.locator('[data-timeline-track="video"]');
  const occupiedVideoLaneBox = await occupiedVideoLane.boundingBox();
  expect(occupiedVideoLaneBox).not.toBeNull();
  if (occupiedVideoLaneBox) {
    await occupiedVideoLane.evaluate((target, { clientX, clientY }) => {
      const dataTransfer = new DataTransfer();
      dataTransfer.setData('application/x-maxvideoai-timeline-node', JSON.stringify({
        assetId: 'client-drag-video',
        durationSec: 8,
        mediaKind: 'video',
        title: 'aerial-road.mp4',
      }));
      target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, clientX, clientY, dataTransfer }));
    }, {
      clientX: occupiedVideoLaneBox.x + 80,
      clientY: occupiedVideoLaneBox.y + occupiedVideoLaneBox.height / 2,
    });
    const displacementGhost = page.locator('[data-timeline-external-displacement-ghost="true"]').first();
    await expect(displacementGhost).toBeVisible();
    await expect(displacementGhost).toHaveAttribute('data-timeline-displacement-start', /.+/);
  }

  const videoLaneBox = await videoLane.boundingBox();
  expect(videoLaneBox).not.toBeNull();
  if (videoLaneBox) {
    await videoLane.evaluate((target, { clientX, clientY }) => {
      const dataTransfer = new DataTransfer();
      dataTransfer.setData('application/x-maxvideoai-timeline-node', JSON.stringify({
        assetId: 'client-drag-video',
        durationSec: 8,
        mediaKind: 'video',
        title: 'aerial-road.mp4',
      }));
      target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, clientX, clientY, dataTransfer }));
    }, {
      clientX: videoLaneBox.x + 120,
      clientY: videoLaneBox.y + videoLaneBox.height / 2,
    });
    const dropGhost = page.locator('[data-timeline-external-drop-ghost="true"]');
    await expect(dropGhost).toHaveAttribute('data-timeline-external-drop-kind', 'video');
    await expect(dropGhost).toHaveAttribute('data-timeline-external-drop-duration', '8');
    await expect(dropGhost).toContainText('aerial-road.mp4');
    await expect(dropGhost).toContainText('0:08');
  }

  await dropProjectMediaAssetOnTimelineTrack(page, 'aerial-road.mp4', 'video-2', 1);

  await expect(page.getByText('aerial-road.mp4 dropped on Video 2 at 1.00s.')).toBeVisible();
  await expect.poll(() => timelineItemCount(page)).toBe(initialTimelineItems + 2);
  assertNoEditorClientErrors(errors);
});

test('viewer project media can drag assets into folders and back out of folder view', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await page.route('**/api/media-library/assets**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        assets: [
          {
            durationSec: 8,
            id: 'client-folder-video',
            mediaType: 'asset-video',
            mimeType: 'video/mp4',
            thumbUrl: '/assets/marketing/reference-workflow-final-video.webp',
            url: '/assets/gallery/aerial-road.mp4',
            width: 1920,
            height: 1080,
            source: 'upload',
          },
        ],
      }),
    });
  });

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Viewer');

  await page.getByRole('button', { name: 'New folder' }).click();
  await expect(page.getByRole('dialog', { name: 'New folder' })).toBeVisible();
  await page.getByLabel('Folder name').fill('Renders');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByText('Renders folder created in Project media.')).toBeVisible();

  await page.getByRole('button', { name: 'Import media' }).click();
  await page.getByRole('button', { name: 'Select aerial-road.mp4' }).click();
  await page.getByRole('button', { name: /Import selected.*1/ }).click();
  await expect(page.getByText('aerial-road.mp4 imported into Project media.')).toBeVisible();

  const importedVideoCard = page
    .locator('[data-project-media-asset-id]', { hasText: 'aerial-road.mp4' })
    .locator('[draggable="true"]');
  const folderCard = page.locator('[data-project-media-folder-id]', { hasText: 'Renders' }).first();
  await expect(importedVideoCard).toBeVisible();
  await expect(folderCard).toBeVisible();

  const sourceBox = await importedVideoCard.boundingBox();
  const folderBox = await folderCard.boundingBox();
  expect(sourceBox).not.toBeNull();
  expect(folderBox).not.toBeNull();
  if (!sourceBox || !folderBox) return;

  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 18, sourceBox.y + sourceBox.height / 2 + 10, { steps: 4 });
  await page.mouse.move(folderBox.x + folderBox.width / 2, folderBox.y + folderBox.height / 2, { steps: 10 });
  await expect(folderCard).toHaveAttribute('data-project-media-folder-drop-target', 'true');
  await page.mouse.up();

  await expect(page.getByText('aerial-road.mp4 moved to Renders.')).toBeVisible();
  await expect(page.locator('[data-project-media-asset-id]', { hasText: 'aerial-road.mp4' })).toHaveCount(0);
  await expect(folderCard).toContainText('1 item');

  await folderCard.click();
  await expect(page.getByRole('button', { name: 'Back to Project media' })).toBeVisible();
  await expect(page.locator('[data-project-media-asset-id]', { hasText: 'aerial-road.mp4' })).toBeVisible();

  await page.getByRole('button', { name: 'Back to Project media' }).click();
  await expect(page.locator('[data-project-media-folder-id]', { hasText: 'Renders' })).toBeVisible();
  await expect(page.locator('[data-project-media-asset-id]', { hasText: 'aerial-road.mp4' })).toHaveCount(0);

  assertNoEditorClientErrors(errors);
});

test('viewer project media supports native mouse drag with a visible timeline ghost', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await page.route('**/api/media-library/assets**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        assets: [
          {
            durationSec: 8,
            id: 'client-native-drag-video',
            mediaType: 'asset-video',
            mimeType: 'video/mp4',
            thumbUrl: '/assets/marketing/reference-workflow-final-video.webp',
            url: '/assets/gallery/aerial-road.mp4',
            width: 1920,
            height: 1080,
            source: 'upload',
          },
        ],
      }),
    });
  });

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Viewer');

  const initialTimelineItems = await timelineItemCount(page);
  await page.getByRole('button', { name: 'Add video track' }).click();
  await page.getByRole('button', { name: 'Import media' }).click();
  await page.getByRole('button', { name: 'Select aerial-road.mp4' }).click();
  await page.getByRole('button', { name: /Import selected.*1/ }).click();
  await expect(page.getByText('aerial-road.mp4 imported into Project media.')).toBeVisible();

  const importedVideoCard = page
    .locator('[data-project-media-asset-id]', { hasText: 'aerial-road.mp4' })
    .locator('[draggable="true"]');
  await expect(importedVideoCard).toHaveAttribute('data-project-media-drag-kind', 'video');

  const occupiedVideoLane = page.locator('[data-timeline-track="video"]');
  const videoLane = page.locator('[data-timeline-track="video-2"]');
  const sourceBox = await importedVideoCard.boundingBox();
  const occupiedTargetBox = await occupiedVideoLane.boundingBox();
  const targetBox = await videoLane.boundingBox();
  expect(sourceBox).not.toBeNull();
  expect(occupiedTargetBox).not.toBeNull();
  expect(targetBox).not.toBeNull();
  if (!sourceBox || !occupiedTargetBox || !targetBox) return;

  const occupiedTargetX = occupiedTargetBox.x + 80;
  const occupiedTargetY = occupiedTargetBox.y + occupiedTargetBox.height / 2;
  const targetX = targetBox.x + 120;
  const targetY = targetBox.y + targetBox.height / 2;
  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 24, sourceBox.y + sourceBox.height / 2 + 12, { steps: 4 });
  await page.mouse.move(occupiedTargetX, occupiedTargetY, { steps: 10 });

  const displacementGhost = page.locator('[data-timeline-external-displacement-ghost="true"]').first();
  await expect(displacementGhost).toBeVisible();
  await expect(displacementGhost).toHaveAttribute('data-timeline-displacement-start', /.+/);

  await page.mouse.move(targetX, targetY, { steps: 12 });

  const videoDropGhost = page.locator('[data-timeline-external-drop-ghost="true"][data-timeline-external-drop-kind="video"]');
  const audioDropGhost = page.locator('[data-timeline-external-drop-linked-audio-ghost="true"]');
  await expect(videoDropGhost).toHaveAttribute('data-timeline-external-drop-duration', '8');
  await expect(videoDropGhost).toContainText('aerial-road.mp4');
  await expect(audioDropGhost).toHaveAttribute('data-timeline-external-drop-kind', 'audio');
  await expect(audioDropGhost).toContainText('aerial-road.mp4 Audio');

  await page.mouse.up();

  await expect.poll(() => timelineItemCount(page)).toBe(initialTimelineItems + 2);
  await expect(page.getByText('Video 2 clip')).toBeVisible();
  assertNoEditorClientErrors(errors);
});

test('viewer project media upload imports local audio into the project bin', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await page.route('**/api/uploads/audio', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        asset: {
          id: 'uploaded-local-audio',
          url: '/studio/demo-ambient.wav',
          kind: 'audio',
          mime: 'audio/wav',
          durationSec: 11,
          source: 'upload',
        },
      }),
    });
  });
  await page.route('**/api/media-library/assets**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, assets: [] }),
    });
  });

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Viewer');

  const initialTimelineItems = await timelineItemCount(page);
  await page.getByRole('button', { name: 'Add audio track' }).click();
  const targetAudioTrack = await page.locator('[data-timeline-track]').evaluateAll((tracks) => {
    const audioTracks = tracks
      .map((track) => track.getAttribute('data-timeline-track'))
      .filter((track): track is string => Boolean(track?.startsWith('audio')));
    return audioTracks[audioTracks.length - 1] ?? 'audio';
  });

  await page.getByRole('button', { name: 'Import media' }).click();
  await expect(page.getByRole('dialog', { name: 'Import project media' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Upload', exact: true })).toBeVisible();
  await page.locator('input[accept="image/*,video/*,audio/*"]').setInputFiles({
    name: 'voiceover.wav',
    mimeType: 'audio/wav',
    buffer: Buffer.from('RIFF0000WAVEfmt '),
  });

  await expect(page.getByText('demo-ambient.wav imported into Project media.')).toBeVisible();
  await dropProjectMediaAssetOnTimelineTrack(page, 'demo-ambient.wav', targetAudioTrack, 1);

  await expect(page.getByText(`demo-ambient.wav dropped on ${timelineTrackNoticeLabel(targetAudioTrack)} at 1.00s.`)).toBeVisible();
  await expect.poll(() => timelineItemCount(page)).toBe(initialTimelineItems + 1);
  assertNoEditorClientErrors(errors);
});

test('viewer project media accepts compatible Finder file drops into the project bin', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await page.route('**/api/uploads/video', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        asset: {
          id: 'dropped-local-video',
          url: '/studio/finder-shot.mp4',
          kind: 'video',
          mime: 'video/mp4',
          durationSec: 9,
          source: 'upload',
        },
      }),
    });
  });
  await page.route('**/api/media-library/assets**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, assets: [] }),
    });
  });

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Viewer');

  await dropLocalFileOnProjectMedia(page, { name: 'finder-shot.mp4', type: 'video/mp4', content: 'fake video bytes' });

  await expect(page.getByText('finder-shot.mp4 imported into Project media.')).toBeVisible();
  await expect(page.locator('[data-project-media-title="finder-shot.mp4"]')).toBeVisible();
  assertNoEditorClientErrors(errors);
});

test('studio projects page creates a project-scoped clean workspace', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await page.addInitScript(() => {
    window.localStorage.removeItem('maxvideoai.editor.projects.v1');
  });
  await page.goto('/app/studio/projects', { waitUntil: 'domcontentloaded' });
  await dismissCookieBanner(page);

  await expect(page.getByRole('heading', { name: 'My projects' })).toBeVisible();
  const createProjectButton = page.getByRole('button', { name: /New project/ });
  await expect(createProjectButton).toBeEnabled();
  await expect(page.getByLabel('Project name')).toHaveCount(0);
  await expect(page.getByLabel('Ratio')).toHaveCount(0);
  await expect(page.getByLabel('Resolution')).toHaveCount(0);
  await expect(page.getByLabel('FPS')).toHaveCount(0);
  await expect(page.getByRole('group', { name: 'Canvas template' })).toHaveCount(0);
  await createProjectButton.click();

  await expect(page).toHaveURL(/\/app\/studio\/workspace\/project_/);
  await expect(page.locator('header').getByText('MaxVideoAI Editor')).toBeVisible();
  await expect(page.getByText('Untitled edit project loaded with a clean sequence.')).toBeVisible();
  await expect.poll(() => timelineItemCount(page)).toBe(0);
  await expect(page.locator('.react-flow__node', { hasText: 'Product Image' })).toBeVisible();

  await switchEditorFocus(page, 'Viewer');
  await expect(page.locator('[data-project-media-card-id="sequence:sequence-main"]')).toContainText('00:00 • 0 clips • 16:9');
  await expect(page.getByText('16:9 · 1920x1080 · 24 fps')).toBeVisible();
  assertNoEditorClientErrors(errors);
});

test('studio projects page keeps template choices compact and supports recent project actions', async ({ page }) => {
  const errors = trackEditorClientErrors(page);
  const initialProject = {
    id: 'project-actions',
    name: 'Action Cut',
    createdAt: '2026-06-11T19:00:00.000Z',
    updatedAt: '2026-06-11T19:19:00.000Z',
    settings: {
      aspectRatio: '16:9',
      resolution: '1920x1080',
      fps: 24,
    },
    canvasTemplateId: 'cinematic-scene',
  };
  let serverProjects = [initialProject];

  await page.route('**/api/studio/projects', async (route) => {
    const request = route.request();
    if (request.method() === 'POST') {
      const payload = request.postDataJSON() as { project?: typeof initialProject } | null;
      const project = {
        ...initialProject,
        ...payload?.project,
        id: payload?.project?.id ?? `project-copy-${serverProjects.length}`,
      };
      serverProjects = [project, ...serverProjects.filter((candidate) => candidate.id !== project.id)];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, project }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, projects: serverProjects }),
    });
  });
  await page.route('**/api/studio/projects/*', async (route) => {
    const request = route.request();
    const projectId = decodeURIComponent(new URL(request.url()).pathname.split('/').pop() ?? '');
    if (request.method() === 'PATCH') {
      const payload = request.postDataJSON() as { project?: Partial<typeof initialProject> } | null;
      serverProjects = serverProjects.map((project) => (
        project.id === projectId
          ? { ...project, ...payload?.project, id: project.id, updatedAt: payload?.project?.updatedAt ?? project.updatedAt }
          : project
      ));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, project: serverProjects.find((project) => project.id === projectId) }),
      });
      return;
    }
    if (request.method() === 'DELETE') {
      serverProjects = serverProjects.filter((project) => project.id !== projectId);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: false }),
    });
  });
  await page.addInitScript(() => {
    window.localStorage.removeItem('maxvideoai.editor.projects.v1');
  });

  await page.goto('/app/studio/projects', { waitUntil: 'domcontentloaded' });
  await dismissCookieBanner(page);

  await expect(page.getByRole('group', { name: 'Canvas template' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /New project/ })).toBeVisible();

  await expect(page.getByText('Action Cut')).toBeVisible();
  await page.getByRole('button', { name: 'Project actions for Action Cut' }).click();
  await expect(page.getByRole('menuitem', { name: 'Rename' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Duplicate' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Delete' })).toBeVisible();

  await page.getByRole('menuitem', { name: 'Rename' }).click();
  const renameDialog = page.getByRole('dialog', { name: 'Rename project' });
  await expect(renameDialog).toBeVisible();
  await renameDialog.getByLabel('Project name').fill('Revised Cut');
  await renameDialog.getByRole('button', { name: 'Save name' }).click();
  await expect(page.getByText('Revised Cut')).toBeVisible();
  await expect(page.getByText('Action Cut')).toHaveCount(0);

  await page.getByRole('button', { name: 'Project actions for Revised Cut' }).click();
  await page.getByRole('menuitem', { name: 'Duplicate' }).click();
  await expect(page.getByText('Revised Cut copy')).toBeVisible();

  await page.getByRole('button', { name: 'Project actions for Revised Cut copy' }).click();
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  await expect(page.getByRole('dialog', { name: 'Delete project' })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Delete project' })).toContainText('Revised Cut copy');
  await page.getByRole('button', { name: 'Delete project' }).click();
  await expect(page.getByText('Revised Cut copy')).toHaveCount(0);
  await expect(page.getByText('Revised Cut')).toBeVisible();
  assertNoEditorClientErrors(errors);
});

test('canvas templates can be saved and applied without changing the timeline', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Canvas');

  const initialTimelineItems = await timelineItemCount(page);
  const savedNodeCount = await canvasNodeCount(page);
  await page.getByRole('button', { name: 'Save canvas' }).click();
  await page.getByLabel('Canvas name').fill('Saved graph');
  await page.getByRole('button', { name: 'Save as new canvas' }).click();
  await expect(page.getByText('Saved graph saved as a canvas.')).toBeVisible();
  await page.getByRole('button', { name: 'Open canvas navigation' }).click();
  const savedTemplateButton = page.locator('[data-canvas-user-template-id]', { hasText: 'Saved graph' }).getByRole('button').first();
  await expect(savedTemplateButton).toBeVisible();
  await page.getByRole('button', { name: 'Open canvas navigation' }).click();

  await page.getByRole('button', { name: 'Text tools' }).click();
  const promptTemplate = page.locator('[data-canvas-toolbar-block-id="free-text"]');
  const canvas = page.locator('.react-flow');
  const templateBox = await promptTemplate.boundingBox();
  const canvasBox = await canvas.boundingBox();
  expect(templateBox).not.toBeNull();
  expect(canvasBox).not.toBeNull();
  if (!templateBox || !canvasBox) return;

  await page.mouse.move(templateBox.x + templateBox.width / 2, templateBox.y + templateBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.58, canvasBox.y + canvasBox.height * 0.35, { steps: 12 });
  await page.mouse.up();
  await expect.poll(() => canvasNodeCount(page)).toBe(savedNodeCount + 1);

  await page.getByRole('button', { name: 'Open canvas navigation' }).click();
  await savedTemplateButton.click();
  await expect.poll(() => canvasNodeCount(page)).toBe(savedNodeCount);
  expect(await timelineItemCount(page)).toBe(initialTimelineItems);
  assertNoEditorClientErrors(errors);
});

test('canvas map stays a full graph miniature while zooming the canvas', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Canvas');

  const map = page.locator('[data-canvas-miniature-map="true"]');
  const canvasNodes = await canvasNodeCount(page);
  await expect(map).toBeVisible();
  await expect(map).toHaveAttribute('data-node-count', String(canvasNodes));
  expect(await map.locator('[data-canvas-mini-node]').count()).toBe(canvasNodes);
  expect(Number(await map.getAttribute('data-edge-count'))).toBeGreaterThan(0);
  expect(Math.abs(Number(await map.getAttribute('data-content-center-x')) - 82)).toBeLessThanOrEqual(1.5);
  expect(Math.abs(Number(await map.getAttribute('data-content-center-y')) - 41)).toBeLessThanOrEqual(1.5);
  await expect(map.locator('[data-canvas-mini-edge]').first()).toBeVisible();
  await expect(map.locator('[data-canvas-mini-viewport="true"]')).toBeVisible();
  await expect(page.locator('.react-flow__minimap')).toHaveCount(0);

  await page.getByRole('button', { name: 'Zoom in canvas' }).click();
  await page.getByRole('button', { name: 'Zoom in canvas' }).click();

  await expect(map).toHaveAttribute('data-node-count', String(canvasNodes));
  expect(await map.locator('[data-canvas-mini-node]').count()).toBe(canvasNodes);
  await expect(map.locator('[data-canvas-mini-viewport="true"]')).toBeVisible();

  const flowViewport = page.locator('.react-flow__viewport');
  const beforeTransform = await flowViewport.evaluate((element) => getComputedStyle(element).transform);
  const mapBox = await map.boundingBox();
  const viewportBox = await map.locator('[data-canvas-mini-viewport="true"]').boundingBox();
  expect(mapBox).not.toBeNull();
  expect(viewportBox).not.toBeNull();
  if (!mapBox || !viewportBox) return;

  const startX = viewportBox.x + viewportBox.width / 2;
  const startY = viewportBox.y + viewportBox.height / 2;
  const deltaX = startX < mapBox.x + mapBox.width / 2 ? 34 : -34;
  const deltaY = startY < mapBox.y + mapBox.height / 2 ? 18 : -18;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + deltaX, startY + deltaY, { steps: 8 });
  await page.mouse.up();

  await expect.poll(async () => flowViewport.evaluate((element) => getComputedStyle(element).transform)).not.toBe(beforeTransform);
  assertNoEditorClientErrors(errors);
});

test('audio block connector drag does not start a timeline block drag', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Canvas');

  const audioConnector = page.locator('.react-flow__node[data-id="audio-music-01"] .react-flow__handle[data-handleid="audio"]');
  await expect(audioConnector).toBeVisible();

  const dragResult = await audioConnector.evaluate((handle) => {
    const dataTransfer = new DataTransfer();
    const event = new DragEvent('dragstart', {
      bubbles: true,
      cancelable: true,
      dataTransfer,
    });
    handle.dispatchEvent(event);
    return {
      defaultPrevented: event.defaultPrevented,
      timelinePayload: dataTransfer.getData('application/x-maxvideoai-timeline-node'),
    };
  });

  expect(dragResult).toEqual({
    defaultPrevented: true,
    timelinePayload: '',
  });
  assertNoEditorClientErrors(errors);
});

test('video block template uses custom drag and clears the ghost after the mouse moves', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Canvas');

  await page.getByRole('button', { name: 'Video tools' }).click();
  const videoMenu = page.getByRole('menu', { name: 'Video tools' });
  const videoTemplate = videoMenu.locator('[data-canvas-toolbar-block-id="video"]');
  await expect(videoTemplate).toBeVisible();
  await expect(videoTemplate).not.toHaveAttribute('draggable', 'true');
  const nodeCountBeforeDrag = await canvasNodeCount(page);

  const canvas = page.locator('.react-flow');
  await expect(canvas).toBeVisible();
  const templateBox = await videoTemplate.boundingBox();
  const canvasBox = await canvas.boundingBox();
  expect(templateBox).not.toBeNull();
  expect(canvasBox).not.toBeNull();
  if (!templateBox || !canvasBox) return;

  await page.evaluate(() => window.getSelection()?.removeAllRanges());
  await page.mouse.move(templateBox.x + templateBox.width / 2, templateBox.y + templateBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.44, canvasBox.y + canvasBox.height * 0.38, { steps: 12 });
  await page.mouse.up();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.78, canvasBox.y + canvasBox.height * 0.18, { steps: 8 });

  await expect.poll(() => canvasNodeCount(page)).toBe(nodeCountBeforeDrag + 1);
  await expect(page.locator('.react-flow__node', { hasText: 'Video Reference' })).toHaveCount(1);
  await expect(page.locator('[class*="workspaceGhostNode"]')).toHaveCount(0);
  expect(await page.evaluate(() => window.getSelection()?.toString() ?? '')).toBe('');
  assertNoEditorClientErrors(errors);
});

test('block template ghost clears when native drag ends without mouseup', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Canvas');

  const canvas = page.locator('.react-flow');
  await expect(canvas).toBeVisible();
  const canvasBox = await canvas.boundingBox();
  expect(canvasBox).not.toBeNull();
  if (!canvasBox) return;

  await page.evaluate(({ clientX, clientY }) => {
    window.dispatchEvent(
      new CustomEvent('maxvideoai:palette-drag-start', {
        detail: {
          kind: 'shot',
          clientX,
          clientY,
        },
      })
    );
  }, {
    clientX: canvasBox.x + canvasBox.width * 0.48,
    clientY: canvasBox.y + canvasBox.height * 0.28,
  });

  await expect(page.locator('[class*="workspaceGhostNode"]', { hasText: 'Generate block' })).toHaveCount(1);

  await page.evaluate(() => {
    window.dispatchEvent(new DragEvent('dragend', { bubbles: true, cancelable: true }));
  });

  await expect(page.locator('[class*="workspaceGhostNode"]')).toHaveCount(0);
  assertNoEditorClientErrors(errors);
});

test('dropped generate blocks default to Seedance 2.0', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Canvas');

  await page.getByRole('button', { name: 'Video tools' }).click();
  const generateTemplate = page.locator('[data-canvas-toolbar-block-id="generate-video"]');
  const canvas = page.locator('.react-flow');
  await expect(generateTemplate).toBeVisible();
  await expect(canvas).toBeVisible();
  const templateBox = await generateTemplate.boundingBox();
  const canvasBox = await canvas.boundingBox();
  expect(templateBox).not.toBeNull();
  expect(canvasBox).not.toBeNull();
  if (!templateBox || !canvasBox) return;

  const nodeCountBeforeDrop = await canvasNodeCount(page);
  await page.mouse.move(templateBox.x + templateBox.width / 2, templateBox.y + templateBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.6, canvasBox.y + canvasBox.height * 0.42, { steps: 12 });
  await page.mouse.up();

  await expect.poll(() => canvasNodeCount(page)).toBe(nodeCountBeforeDrop + 1);
  const droppedShotNode = page.locator('.react-flow__node', { hasText: 'Video generation' }).last();
  await expect(droppedShotNode).toContainText('Seedance 2.0');
  await droppedShotNode.getByRole('button', { name: /Open .* settings/ }).click();

  const modelSelect = page
    .locator('aside[aria-label="Node settings"] label', { hasText: 'Model' })
    .locator('select')
    .first();
  await expect(modelSelect).toHaveValue('seedance-2-0');
  assertNoEditorClientErrors(errors);
});

test('canvas shot nodes keep compact row-aligned handles and generate controls', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Canvas');

  const shotNode = page.locator('.react-flow__node-shot').first();
  await expect(shotNode).toBeVisible();
  await expect(shotNode.locator('[class*="nodePreviewEmpty"], [class*="mediaPickerEmpty"]')).toHaveCount(0);

  const generateButton = shotNode.locator('button:has([data-shot-generate-label])').first();
  await expect(generateButton).toBeVisible();
  await expect(generateButton.locator('[data-shot-generate-label]')).toBeVisible();
  await expect(generateButton.locator('[data-shot-generate-price]')).toBeVisible();

  const generateMetrics = await generateButton.evaluate((button) => {
    const label = button.querySelector<HTMLElement>('[data-shot-generate-label]');
    const price = button.querySelector<HTMLElement>('[data-shot-generate-price]');
    const buttonBox = button.getBoundingClientRect();
    const labelBox = label?.getBoundingClientRect();
    const priceBox = price?.getBoundingClientRect();

    return {
      buttonHeight: buttonBox.height,
      labelRight: labelBox ? labelBox.right : 0,
      labelWidth: labelBox ? labelBox.width : 0,
      priceLeft: priceBox ? priceBox.left : 0,
      priceText: price?.textContent?.trim() ?? '',
      priceWidth: priceBox ? priceBox.width : 0,
    };
  });

  expect(generateMetrics.buttonHeight).toBeLessThanOrEqual(38);
  expect(generateMetrics.labelWidth).toBeGreaterThan(32);
  expect(generateMetrics.priceText.length).toBeGreaterThan(0);
  expect(generateMetrics.priceWidth).toBeGreaterThan(0);
  expect(generateMetrics.labelRight).toBeLessThanOrEqual(generateMetrics.priceLeft);

  const connectorMetrics = await shotNode.evaluate((node) => {
    return Array.from(node.querySelectorAll<HTMLElement>('[data-shot-connector-row]')).map((row) => {
      const handle = row.querySelector<HTMLElement>('.react-flow__handle');
      const rowBox = row.getBoundingClientRect();
      const handleBox = handle?.getBoundingClientRect();
      const handleStyle = handle ? getComputedStyle(handle) : null;
      const rowCenterY = rowBox.top + rowBox.height / 2;
      const handleCenterY = handleBox ? handleBox.top + handleBox.height / 2 : 0;

      return {
        backgroundColor: handleStyle?.backgroundColor ?? '',
        borderTopWidth: handleStyle?.borderTopWidth ?? '',
        distanceFromRowCenter: Math.abs(rowCenterY - handleCenterY),
        height: handleBox?.height ?? 0,
        kind: row.getAttribute('data-shot-connector-kind'),
        role: row.getAttribute('data-shot-connector-row'),
        width: handleBox?.width ?? 0,
      };
    });
  });

  expect(connectorMetrics.length).toBeGreaterThan(0);
  expect(connectorMetrics.some((metric) => metric.role === 'output')).toBe(true);
  for (const metric of connectorMetrics) {
    expect(metric.kind).toBeTruthy();
    expect(metric.width).toBeLessThanOrEqual(8);
    expect(metric.height).toBeLessThanOrEqual(8);
    expect(metric.borderTopWidth).toBe('0px');
    expect(metric.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    expect(metric.distanceFromRowCenter).toBeLessThanOrEqual(1.5);
  }

  assertNoEditorClientErrors(errors);
});

test('canvas accepts local media file drops and creates matching source blocks', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Canvas');

  const beforeCount = await canvasNodeCount(page);
  await dropLocalFileOnCanvas(page, { name: 'local-product.png', type: 'image/png', content: 'fake image bytes' }, '.react-flow', { x: 0.32, y: 0.34 });
  await dropLocalFileOnCanvas(page, { name: 'local-motion.mp4', type: 'video/mp4', content: 'fake video bytes' }, '.react-flow', { x: 0.52, y: 0.34 });
  await dropLocalFileOnCanvas(page, { name: 'local-score.wav', type: 'audio/wav', content: 'fake audio bytes' }, '.react-flow', { x: 0.72, y: 0.34 });

  await expect.poll(() => canvasNodeCount(page)).toBe(beforeCount + 3);
  await expect(page.locator('.react-flow__node', { hasText: 'local-product.png' })).toBeVisible();
  await expect(page.locator('.react-flow__node', { hasText: 'local-motion.mp4' })).toBeVisible();
  await expect(page.locator('.react-flow__node', { hasText: 'local-score.wav' })).toBeVisible();
  await expect(page.locator('.react-flow__node', { hasText: 'Image Reference' }).last()).toHaveAttribute('data-id', /asset-image/);
  await expect(page.locator('.react-flow__node', { hasText: 'Video Reference' }).last()).toHaveAttribute('data-id', /asset-video/);
  await expect(page.locator('.react-flow__node', { hasText: 'Audio Reference' }).last()).toHaveAttribute('data-id', /asset-audio/);
  assertNoEditorClientErrors(errors);
});

test('canvas file drop on a compatible empty block fills that block instead of adding another node', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Canvas');

  await page.getByRole('button', { name: 'Video tools' }).click();
  const videoMenu = page.getByRole('menu', { name: 'Video tools' });
  const videoTemplate = videoMenu.locator('[data-canvas-toolbar-block-id="video"]');
  const canvas = page.locator('.react-flow');
  await expect(videoTemplate).toBeVisible();
  await expect(canvas).toBeVisible();
  const templateBox = await videoTemplate.boundingBox();
  const canvasBox = await canvas.boundingBox();
  expect(templateBox).not.toBeNull();
  expect(canvasBox).not.toBeNull();
  if (!templateBox || !canvasBox) return;

  const nodeCountBeforeTemplateDrop = await canvasNodeCount(page);
  await page.mouse.move(templateBox.x + templateBox.width / 2, templateBox.y + templateBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.2, canvasBox.y + canvasBox.height * 0.25, { steps: 12 });
  await page.mouse.up();
  await expect.poll(() => canvasNodeCount(page)).toBe(nodeCountBeforeTemplateDrop + 1);

  const newVideoNode = page.locator('.react-flow__node', { hasText: 'No video selected' }).last();
  await expect(newVideoNode).toBeVisible();
  const newVideoNodeId = await newVideoNode.getAttribute('data-id');
  expect(newVideoNodeId).toBeTruthy();
  const nodeCountBeforeFileDrop = await canvasNodeCount(page);
  await dropLocalFileOnCanvas(page, { name: 'filled-reference.mp4', type: 'video/mp4', content: 'fake video bytes' }, '.react-flow__node:has-text("No video selected")');

  await expect.poll(() => canvasNodeCount(page)).toBe(nodeCountBeforeFileDrop);
  await expect(page.locator(`.react-flow__node[data-id="${newVideoNodeId}"]`)).toContainText('filled-reference.mp4');
  assertNoEditorClientErrors(errors);
});

test('canvas paste creates a prompt block from plain text', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Canvas');

  const beforeCount = await canvasNodeCount(page);
  await pasteTextOnCanvas(page, 'Pasted launch scene: close-up product turn with moody light.');

  await expect.poll(() => canvasNodeCount(page)).toBe(beforeCount + 1);
  await expect(page.locator('.react-flow__node textarea').last()).toHaveValue('Pasted launch scene: close-up product turn with moody light.');
  assertNoEditorClientErrors(errors);
});

test('native body paste stays with the active editor surface', async ({ page }) => {
  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Canvas');

  const initialNodeCount = await canvasNodeCount(page);
  await page.locator('.react-flow__node').first().click();
  await copyCanvasGraphSelection(page);

  await page.locator('[data-timeline-track="video-1"]').click({ position: { x: 8, y: 8 } });
  await expect(page.locator('[data-active-editor-surface="timeline"]')).toBeVisible();
  await pasteClipboardOnDocumentBody(page, {
    text: 'MaxVideoAI canvas graph selection',
    type: 'application/x-maxvideoai-canvas-graph',
  });
  await page.waitForTimeout(100);
  await expect.poll(() => canvasNodeCount(page)).toBe(initialNodeCount);
  await expect(page.locator('[data-active-editor-surface="timeline"]')).toBeVisible();

  await pasteClipboardOnDocumentBody(page, { text: 'Timeline-owned body paste must stay external.' });
  await page.waitForTimeout(100);
  await expect.poll(() => canvasNodeCount(page)).toBe(initialNodeCount);

  await page.locator('.react-flow__pane').click({ position: { x: 24, y: 24 } });
  await expect(page.locator('[data-active-editor-surface="canvas"]')).toBeVisible();
  await pasteClipboardOnDocumentBody(page, {
    text: 'MaxVideoAI canvas graph selection',
    type: 'application/x-maxvideoai-canvas-graph',
  });
  await expect.poll(() => canvasNodeCount(page)).toBe(initialNodeCount + 1);
});

test('canvas paste creates an image source block from a compatible image file', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Canvas');

  const beforeCount = await canvasNodeCount(page);
  await pasteFileOnCanvas(page, { name: 'clipboard-product.png', type: 'image/png', content: 'fake image bytes' });

  await expect.poll(() => canvasNodeCount(page)).toBe(beforeCount + 1);
  await expect(page.locator('.react-flow__node', { hasText: 'clipboard-product.png' })).toBeVisible();
  await expect(page.locator('.react-flow__node', { hasText: 'Image Reference' }).last()).toHaveAttribute('data-id', /asset-image/);
  assertNoEditorClientErrors(errors);
});
