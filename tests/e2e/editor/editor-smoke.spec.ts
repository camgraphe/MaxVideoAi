import { expect, test, type Locator, type Page } from '@playwright/test';
import { createStarterWorkspaceTemplate } from '../../../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-templates';
import {
  assertNoEditorClientErrors,
  canvasNodeCount,
  dragTimelineClip,
  dragTimelineClipEnd,
  dropProjectMediaAssetOnTimelineTrack,
  openEditorWorkspace,
  openFreshEditorWorkspace,
  openMinimalEditorWorkspace,
  switchEditorFocus,
  timelineClipState,
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

type ElementBox = {
  height: number;
  width: number;
  x: number;
  y: number;
};

type CanvasViewportTransform = {
  x: number;
  y: number;
  zoom: number;
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

type GuideHighlightProbe = {
  durations: number[];
  starts: number;
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
    const inheritedOpacity = elements.reduce((opacity, candidate) => (
      opacity * Number(getComputedStyle(candidate).opacity)
    ), 1);
    const colorValue = parseCssColor(styles.color);
    const renderedColor = composite(
      [colorValue[0], colorValue[1], colorValue[2], colorValue[3] * inheritedOpacity],
      backgroundColor
    );
    return {
      background: `rgba(${backgroundColor.map((channel, index) => (index < 3 ? Math.round(channel) : Number(channel.toFixed(3)))).join(', ')})`,
      backgroundColor,
      color: styles.color,
      colorValue: renderedColor,
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

function boxesIntersect(left: ElementBox, right: ElementBox): boolean {
  return (
    left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y
  );
}

async function expectNoIntersection(left: Locator, right: Locator, label: string): Promise<void> {
  await expect(left).toBeVisible();
  await expect(right).toBeVisible();
  await expect.poll(async () => {
    const [leftBox, rightBox] = await Promise.all([left.boundingBox(), right.boundingBox()]);
    return Boolean(leftBox && rightBox && !boxesIntersect(leftBox, rightBox));
  }, { message: `${label} should not intersect` }).toBe(true);
}

async function canvasViewportTransform(page: Page): Promise<CanvasViewportTransform> {
  return page.locator('.react-flow__viewport').evaluate((element) => {
    const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform);
    return { x: matrix.e, y: matrix.f, zoom: matrix.a };
  });
}

async function waitForCanvasViewportToSettle(page: Page): Promise<CanvasViewportTransform> {
  let previous = await canvasViewportTransform(page);
  let stableSamples = 0;
  await expect.poll(async () => {
    const current = await canvasViewportTransform(page);
    const stable = (
      Math.abs(current.x - previous.x) < 0.001 &&
      Math.abs(current.y - previous.y) < 0.001 &&
      Math.abs(current.zoom - previous.zoom) < 0.00001
    );
    previous = current;
    stableSamples = stable ? stableSamples + 1 : 0;
    return stableSamples >= 2;
  }, {
    intervals: [50, 50, 50, 50, 100, 100, 100],
    message: 'Canvas viewport should finish its animated transition',
  }).toBe(true);
  return previous;
}

async function expectExpandedGuideBoundsInsideCanvas(page: Page): Promise<void> {
  await expect.poll(async () => {
    const metrics = await page.locator('[data-studio-canvas-shell="true"]').evaluate((canvasShell) => {
      const canvasRect = canvasShell.getBoundingClientRect();
      const nodeRects = Array.from(canvasShell.querySelectorAll<HTMLElement>('.react-flow__node'))
        .map((node) => node.getBoundingClientRect());
      const viewport = canvasShell.querySelector<HTMLElement>('.react-flow__viewport');
      if (!nodeRects.length || !viewport) return null;
      const matrix = new DOMMatrixReadOnly(getComputedStyle(viewport).transform);
      const zoom = matrix.a;
      const horizontalPadding = (210 + 28) * zoom;
      const verticalPadding = (82 + 28) * zoom;
      const nodeBounds = {
        bottom: Math.max(...nodeRects.map((rect) => rect.bottom)),
        left: Math.min(...nodeRects.map((rect) => rect.left)),
        right: Math.max(...nodeRects.map((rect) => rect.right)),
        top: Math.min(...nodeRects.map((rect) => rect.top)),
      };
      return {
        bottom: canvasRect.bottom - (nodeBounds.bottom + verticalPadding),
        left: nodeBounds.left - horizontalPadding - canvasRect.left,
        right: canvasRect.right - (nodeBounds.right + horizontalPadding),
        top: nodeBounds.top - verticalPadding - canvasRect.top,
        zoom,
      };
    });
    return Boolean(
      metrics &&
      metrics.bottom >= -2 &&
      metrics.left >= -2 &&
      metrics.right >= -2 &&
      metrics.top >= -2 &&
      metrics.zoom < 0.65
    );
  }, { message: 'expanded guide fit bounds should settle inside the Canvas below compact zoom' }).toBe(true);
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

async function openGuideProject(
  page: Page,
  options: { starterButtonName: RegExp; templateId: string },
): Promise<string> {
  let selectedProjectId: string | null = null;
  let selectedTemplateId: string | null = null;

  await page.route('**/api/studio/projects', async (route) => {
    if (route.request().method() === 'POST') {
      const payload = route.request().postDataJSON() as { project?: { id?: string; canvasTemplateId?: string } } | null;
      selectedProjectId = payload?.project?.id ?? null;
      selectedTemplateId = payload?.project?.canvasTemplateId ?? null;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, project: payload?.project }),
      });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, projects: [] }) });
  });
  await page.addInitScript(() => {
    window.localStorage.removeItem('maxvideoai.editor.projects.v1');
    window.sessionStorage.setItem('last-known:user-id', 'studio-smoke-user');
  });
  await page.goto('/app/studio/projects', { waitUntil: 'domcontentloaded' });
  await dismissCookieBanner(page);

  await page.getByRole('button', { name: options.starterButtonName }).click();
  await expect.poll(() => selectedTemplateId).toBe(options.templateId);
  await expect.poll(() => selectedProjectId).not.toBeNull();
  if (!selectedProjectId) throw new Error(`${options.templateId} starter did not POST a project ID.`);
  await expect.poll(() => new URL(page.url()).pathname, {
    message: 'starter click should navigate to the exact POSTed project URL',
  }).toBe(`/app/studio/workspace/${selectedProjectId}`);
  await dismissCookieBanner(page);
  return selectedProjectId;
}

async function openStoryboardGuideProject(page: Page): Promise<string> {
  return openGuideProject(page, {
    starterButtonName: /Start Storyboard to Video/,
    templateId: 'guided-storyboard-to-video',
  });
}

async function openProductAdGuideProject(page: Page): Promise<string> {
  return openGuideProject(page, {
    starterButtonName: /Start Product Ad/,
    templateId: 'guided-product-ad',
  });
}

async function persistedGuideStateJson(page: Page, projectId: string): Promise<string | null> {
  return page.evaluate((id) => {
    const raw = window.localStorage.getItem(`maxvideoai.editor.workspace.v1.${id}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { guideState?: unknown };
    return parsed.guideState ? JSON.stringify(parsed.guideState) : null;
  }, projectId);
}

async function saveCanvasAs(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: 'Save canvas' }).click();
  await page.getByLabel('Canvas name').fill(name);
  await page.getByRole('button', { name: 'Save as new canvas' }).click();
  await expect(page.getByText(`${name} saved as a canvas.`)).toBeVisible();
}

async function openSavedCanvas(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: 'Open canvas navigation' }).click();
  const savedCanvas = page.locator('[data-canvas-user-template-id]', { hasText: name });
  await expect(savedCanvas).toBeVisible();
  await savedCanvas.getByRole('button').first().click();
}

async function installGuideHighlightProbe(page: Page, selector: string): Promise<void> {
  await page.evaluate((targetSelector) => {
    const testWindow = window as Window & {
      __guideHighlightProbe?: GuideHighlightProbe & { firstStart: number | null };
      __guideHighlightObserver?: MutationObserver;
    };
    testWindow.__guideHighlightObserver?.disconnect();
    testWindow.__guideHighlightProbe = { durations: [], firstStart: null, starts: 0 };
    testWindow.__guideHighlightObserver = new MutationObserver((records) => {
      const probe = testWindow.__guideHighlightProbe;
      if (!probe) return;
      for (const record of records) {
        const target = record.target;
        if (!(target instanceof Element) || !target.matches(targetSelector)) continue;
        const highlighted = target.getAttribute('data-guide-highlighted') === 'true';
        if (record.oldValue !== 'true' && highlighted) {
          probe.starts += 1;
          probe.firstStart ??= performance.now();
        } else if (record.oldValue === 'true' && !highlighted && probe.firstStart !== null) {
          probe.durations.push(performance.now() - probe.firstStart);
        }
      }
    });
    testWindow.__guideHighlightObserver.observe(document.body, {
      attributeFilter: ['data-guide-highlighted'],
      attributeOldValue: true,
      attributes: true,
      subtree: true,
    });
  }, selector);
}

async function guideHighlightProbe(page: Page): Promise<GuideHighlightProbe> {
  return page.evaluate(() => {
    const probe = (window as Window & {
      __guideHighlightProbe?: GuideHighlightProbe;
    }).__guideHighlightProbe;
    return { durations: probe?.durations ?? [], starts: probe?.starts ?? 0 };
  });
}

async function createGuidedTimelineClip(page: Page): Promise<string> {
  const generateButton = page.locator('[data-shot-generation-action="true"]');
  await expect(generateButton).toBeEnabled();
  await generateButton.click();
  await expect(page.locator('[data-generated-output-status="ready"]')).toBeVisible();
  await switchEditorFocus(page, 'Viewer');

  const generatedCard = page.locator('[data-project-media-generated-id], [data-project-media-asset-id]').first();
  await expect(generatedCard).toBeVisible();
  await generatedCard.locator('[data-project-media-menu-trigger]').click();
  await page.getByRole('menuitem', { name: 'Insert at playhead' }).click();
  await expect.poll(() => timelineItemCount(page)).toBe(1);

  const clipId = await page.locator('[data-timeline-item]').first().getAttribute('data-timeline-item');
  if (!clipId) throw new Error('Guided output did not create a timeline clip.');
  return clipId;
}

async function panCanvasPane(page: Page): Promise<CanvasViewportTransform> {
  const pane = page.locator('.react-flow__pane');
  const point = await pane.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    for (let y = rect.top + 32; y < rect.bottom - 32; y += 36) {
      for (let x = rect.left + 32; x < rect.right - 32; x += 36) {
        if (document.elementFromPoint(x, y) === element) return { x, y };
      }
    }
    return null;
  });
  expect(point, 'Canvas pane should expose an unobstructed pan point').not.toBeNull();
  if (!point) return canvasViewportTransform(page);

  const before = await canvasViewportTransform(page);
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x + 34, point.y + 22, { steps: 6 });
  await page.mouse.up();
  await expect.poll(async () => canvasViewportTransform(page)).not.toEqual(before);
  return canvasViewportTransform(page);
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
  await expect(page.getByRole('heading', { name: 'Mes projets' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Studio Editor' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Démarrer Publicité produit/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Ouvrir un projet/ })).toHaveCount(0);
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

  await expect(page.getByRole('heading', { name: 'My projects' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Studio Editor' })).toBeVisible();
  await expect(page.getByText(/sign in.*local draft mode/i)).toBeVisible();

  await page.goto('/app/studio/workspace/project_unauthorized', { waitUntil: 'domcontentloaded' });
  await dismissCookieBanner(page);

  await expect(page.locator('header').getByRole('button', { name: 'Projects', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Canvas', exact: true })).toBeVisible();
  await expect(page.getByText(/local draft mode/i)).toBeVisible();
  await expect.poll(() => page.evaluate(() => {
    const raw = window.localStorage.getItem('maxvideoai.editor.workspace.v1.project_unauthorized');
    if (!raw) return 0;
    return (JSON.parse(raw) as { nodes?: unknown[] }).nodes?.length ?? 0;
  })).toBe(2);
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
    window.sessionStorage.setItem('last-known:user-id', 'studio-smoke-user');
    window.localStorage.setItem('mv-theme', 'dark');
    window.localStorage.setItem('maxvideoai.studio.theme.v1', 'dark');
    window.localStorage.setItem('maxvideoai.studio.theme.userOverride.v1', 'true');
  });

  await page.goto('/app/studio/projects', { waitUntil: 'domcontentloaded' });
  await dismissCookieBanner(page);

  const shell = page.locator('[class*="projectsShell"]');
  await expectDarkReadableSurface(shell, 'dark Studio projects shell');
  await expect(page.getByRole('heading', { name: 'My projects' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Studio Editor' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Start Product Ad/ })).toBeEnabled();
  await expect(page.getByRole('button', { name: /New project/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Open a project/ })).toHaveCount(0);
  await expectDarkReadableSurface(page.locator('[class*="projectGrid"]').first(), 'dark project grid');

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
  await expectTapTarget(imageTools, 'mobile Image tools button', 44);
  await imageTools.click();
  const imageMenu = page.getByRole('menu', { name: 'Image tools' });
  await expectWithinViewport(page, imageMenu, 'mobile Image tools drawer menu');
  await expect(imageMenu.locator('[data-canvas-toolbar-block-id="generate-image"]')).toBeVisible();
  await page.keyboard.press('Escape');

  const canvasNavigation = page.getByRole('button', { name: 'Open canvas navigation' });
  await expectTapTarget(canvasNavigation, 'mobile canvas navigator button', 44);
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
  await expectTapTarget(exportTrigger, 'mobile export dialog trigger', 44);
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
  await expect(videoMenu.locator('[data-canvas-toolbar-block-id="extend-video"]')).toContainText('Extend video');
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

  await switchEditorFocus(page, 'Viewer');
  await page.locator('[data-timeline-track="video"]').click({ position: { x: 8, y: 8 } });
  await expect(page.locator('[data-active-editor-surface="timeline"]')).toBeVisible();
  await page.keyboard.press('i');
  await expect(page.locator('[data-timeline-in-marker="true"]')).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Node settings' })).toHaveCount(0);

  await switchEditorFocus(page, 'Canvas');
  await page.locator('.react-flow__pane').click({ position: { x: 24, y: 24 } });
  await expect(page.locator('[data-active-editor-surface="canvas"]')).toBeVisible();
  await page.locator('.react-flow__node').first().click();
  await page.keyboard.press('i');
  await expect(page.getByRole('complementary', { name: 'Node settings' })).toBeVisible();
});

test('viewer mode can create and switch between multiple sequences', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await openFreshEditorWorkspace(page);
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
  await expect(page.locator('header').getByRole('button', { name: 'Projects', exact: true })).toBeVisible();
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

test('viewer project media drag preserves unknown video audio provenance', async ({ page }) => {
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
  await expect(importedVideoCard).toHaveAttribute('data-project-media-duration-sec', /^(?:0\.\d+|[1-9]\d*(?:\.\d+)?)$/);
  const measuredDurationSec = await importedVideoCard.getAttribute('data-project-media-duration-sec');
  expect(measuredDurationSec).toBeTruthy();
  const videoLane = page.locator('[data-timeline-track="video-2"]');
  const occupiedVideoLane = page.locator('[data-timeline-track="video"]');
  const occupiedVideoLaneBox = await occupiedVideoLane.boundingBox();
  expect(occupiedVideoLaneBox).not.toBeNull();
  if (occupiedVideoLaneBox) {
    await occupiedVideoLane.evaluate((target, { clientX, clientY, durationSec }) => {
      const dataTransfer = new DataTransfer();
      dataTransfer.setData('application/x-maxvideoai-timeline-node', JSON.stringify({
        assetId: 'client-drag-video',
        durationSec,
        mediaKind: 'video',
        title: 'aerial-road.mp4',
      }));
      target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, clientX, clientY, dataTransfer }));
    }, {
      clientX: occupiedVideoLaneBox.x + 80,
      clientY: occupiedVideoLaneBox.y + occupiedVideoLaneBox.height / 2,
      durationSec: Number(measuredDurationSec),
    });
    const displacementGhost = page.locator('[data-timeline-external-displacement-ghost="true"]').first();
    await expect(displacementGhost).toBeVisible();
    await expect(displacementGhost).toHaveAttribute('data-timeline-displacement-start', /.+/);
  }

  const videoLaneBox = await videoLane.boundingBox();
  expect(videoLaneBox).not.toBeNull();
  if (videoLaneBox) {
    await videoLane.evaluate((target, { clientX, clientY, durationSec }) => {
      const dataTransfer = new DataTransfer();
      dataTransfer.setData('application/x-maxvideoai-timeline-node', JSON.stringify({
        assetId: 'client-drag-video',
        durationSec,
        mediaKind: 'video',
        title: 'aerial-road.mp4',
      }));
      target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, clientX, clientY, dataTransfer }));
    }, {
      clientX: videoLaneBox.x + 120,
      clientY: videoLaneBox.y + videoLaneBox.height / 2,
      durationSec: Number(measuredDurationSec),
    });
    const dropGhost = page.locator('[data-timeline-external-drop-ghost="true"]');
    await expect(dropGhost).toHaveAttribute('data-timeline-external-drop-kind', 'video');
    await expect(dropGhost).toHaveAttribute('data-timeline-external-drop-duration', measuredDurationSec!);
    await expect(dropGhost).toContainText('aerial-road.mp4');
    await expect(dropGhost).toContainText(`0:${Math.floor(Number(measuredDurationSec)).toString().padStart(2, '0')}`);
  }

  await dropProjectMediaAssetOnTimelineTrack(page, 'aerial-road.mp4', 'video-2', 32);

  await expect.poll(() => timelineItemCount(page)).toBe(initialTimelineItems + 1);
  await expect(page.locator('[data-timeline-track="video-2"] [data-timeline-item]', { hasText: 'aerial-road.mp4' })).toHaveCount(1);
  await expect(page.locator('[data-timeline-track^="audio"] [data-timeline-item]', { hasText: 'aerial-road.mp4' })).toHaveCount(0);
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

test('viewer project media native drag omits phantom audio for unknown provenance', async ({ page }) => {
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

  const importedVideoAsset = page.locator('[data-project-media-asset-id]', { hasText: 'aerial-road.mp4' });
  await expect.poll(async () => Number(
    await importedVideoAsset.getAttribute('data-project-media-duration-sec'),
  )).toBe(21.033);
  const importedVideoCard = importedVideoAsset.locator('[draggable="true"]');
  await expect(importedVideoCard).toHaveAttribute('data-project-media-drag-kind', 'video');
  const measuredDurationSec = await importedVideoAsset.getAttribute('data-project-media-duration-sec');
  expect(measuredDurationSec).toMatch(/^(?:0\.\d+|[1-9]\d*(?:\.\d+)?)$/);

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
  const targetX = targetBox.x + targetBox.width - 40;
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
  const previewDurationSec = Number(await videoDropGhost.getAttribute('data-timeline-external-drop-duration'));
  expect(previewDurationSec).toBe(Number(measuredDurationSec));
  await expect(videoDropGhost).toContainText('aerial-road.mp4');
  await expect(audioDropGhost).toHaveCount(0);

  await page.mouse.up();

  await expect.poll(() => timelineItemCount(page)).toBe(initialTimelineItems + 1);
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

  await openMinimalEditorWorkspace(page);
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

  await openMinimalEditorWorkspace(page);
  await switchEditorFocus(page, 'Viewer');

  await dropLocalFileOnProjectMedia(page, { name: 'finder-shot.mp4', type: 'video/mp4', content: 'fake video bytes' });

  await expect(page.getByText('finder-shot.mp4 imported into Project media.')).toBeVisible();
  await expect(page.locator('[data-project-media-title="finder-shot.mp4"]')).toBeVisible();
  assertNoEditorClientErrors(errors);
});

test('studio projects page creates a project-scoped clean workspace', async ({ page }) => {
  const errors = trackEditorClientErrors(page);
  await mockStudioPersistenceApi(page);

  await page.addInitScript(() => {
    window.localStorage.removeItem('maxvideoai.editor.projects.v1');
    window.sessionStorage.setItem('last-known:user-id', 'studio-smoke-user');
  });
  await page.goto('/app/studio/projects', { waitUntil: 'domcontentloaded' });
  await dismissCookieBanner(page);

  await expect(page.getByRole('heading', { name: 'My projects' })).toHaveCount(0);
  const createProjectButton = page.getByRole('button', { name: /Blank project/ });
  await expect(page.getByRole('heading', { name: 'Studio Editor' })).toBeVisible();
  await expect(page.locator('[class*="starterCanvasPreview"] img')).toHaveCount(3);
  await expect(page.getByRole('button', { name: /Start Product Ad/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Start Storyboard to Video/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Start Cinematic Trailer/ })).toBeVisible();
  await expect(createProjectButton).toBeEnabled();
  await expect(page.getByLabel('Project name')).toHaveCount(0);
  await expect(page.getByLabel('Ratio')).toHaveCount(0);
  await expect(page.getByLabel('Resolution')).toHaveCount(0);
  await expect(page.getByLabel('FPS')).toHaveCount(0);
  await expect(page.getByRole('group', { name: 'Canvas template' })).toHaveCount(0);
  await createProjectButton.click();

  await expect(page).toHaveURL(/\/app\/studio\/workspace\/project_/);
  await expect(page.locator('header').getByRole('button', { name: 'Projects', exact: true })).toBeVisible();
  await expect.poll(() => timelineItemCount(page)).toBe(0);
  await expect(page.locator('.react-flow__node')).toHaveCount(2);
  await expect(page.locator('.react-flow__node-text-prompt')).toBeVisible();
  const generationNode = page.locator('.react-flow__node', { hasText: 'Video generation' });
  await expect(generationNode).toBeVisible();
  await expect(generationNode).toHaveClass(/selected/);
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);

  await page.getByRole('button', { name: 'Open canvas navigation' }).click();
  await page.getByRole('button', { name: 'Templates' }).click();
  await expect(page.locator('[data-canvas-template-id]')).toHaveCount(6);
  await expect(page.locator('[data-canvas-template-id="minimal-start"]')).toHaveCount(0);
  await page.keyboard.press('Escape');

  await switchEditorFocus(page, 'Viewer');
  await expect(page.locator('[data-project-media-card-id="sequence:sequence-main"]')).toContainText('00:00 • 0 clips • 16:9');
  await expect(page.getByText('16:9 · 1920x1080 · 24 fps')).toBeVisible();
  assertNoEditorClientErrors(errors);
});

test('studio projects page creates a project from a workflow starter with guide', async ({ page }) => {
  const errors = trackEditorClientErrors(page);
  await openStoryboardGuideProject(page);
  await expect(page.locator('.react-flow__node')).toHaveCount(3);
  await expect(page.locator('.react-flow__node-asset-image')).toHaveCount(1);
  await expect(page.locator('.react-flow__node-text-prompt')).toHaveCount(1);
  await expect(page.locator('.react-flow__node-shot')).toHaveCount(1);
  await expect(page.locator('.react-flow__edge')).toHaveCount(2);
  await expect(page.locator('[data-studio-guide-anchor="viewer-tab"]')).toBeVisible();
  await expect(page.locator('[data-studio-guide-anchor="timeline"]')).toBeVisible();
  await expect(page.locator('[data-canvas-guide-annotation]')).toHaveCount(5);
  await expect(page.locator('[data-guide-step="1"]')).toHaveAttribute('aria-label', /storyboard/i);
  await expect(page.locator('[data-guide-step="1"]')).toHaveAttribute('aria-posinset', '1');
  await expect(page.locator('[data-guide-step="1"]')).toHaveAttribute('aria-setsize', '5');
  await expect(page.getByRole('list', { name: 'Canvas workflow guide' })).toHaveCount(1);
  await expect(page.getByRole('list', { name: 'Canvas workflow guide' }).getByRole('listitem')).toHaveCount(5);
  await page.locator('[data-guide-step="1"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Delete this explanation: Choose the storyboard' })).toBeVisible();
  await page.locator('[data-guide-step="3"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Delete this explanation: Check the storyboard render' })).toBeVisible();
  await expect(page.locator('.react-flow__node-note')).toHaveCount(0);
  await expect(page.locator('[data-canvas-guide-layer]')).toBeVisible();
  const navigator = page.locator('.react-flow [data-canvas-navigator="true"]');
  const guideTrigger = page.locator('#canvas-guide-menu-trigger');
  await expectNoIntersection(guideTrigger, navigator, 'desktop guide trigger and Canvas navigator');
  await guideTrigger.click();
  await expectNoIntersection(page.locator('#canvas-guide-menu'), navigator, 'desktop guide menu and Canvas navigator');
  assertNoEditorClientErrors(errors);
});

test('marketing starter query creates one guided project after hydration', async ({ page }) => {
  const errors = trackEditorClientErrors(page);
  const postedTemplates: string[] = [];
  const hydratedProject = {
    id: 'project_existing_hydrated',
    name: 'Hydrated server project',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    settings: {
      aspectRatio: '16:9',
      resolution: '1920x1080',
      fps: 24,
    },
    canvasTemplateId: 'minimal-start',
  };
  let projectsGetCount = 0;
  let postedProject: (Record<string, unknown> & { canvasTemplateId?: string; id?: string }) | null = null;
  let postStartUrl: string | null = null;
  let postSawHydratedProject = false;
  let resolveFirstProjectsGetStarted = () => {};
  let releaseFirstProjectsGet = () => {};
  let resolvePostStarted = () => {};
  let releasePostResponse = () => {};
  const firstProjectsGetStarted = new Promise<void>((resolve) => {
    resolveFirstProjectsGetStarted = resolve;
  });
  const firstProjectsGetGate = new Promise<void>((resolve) => {
    releaseFirstProjectsGet = resolve;
  });
  const postStarted = new Promise<void>((resolve) => {
    resolvePostStarted = resolve;
  });
  const postResponseGate = new Promise<void>((resolve) => {
    releasePostResponse = resolve;
  });

  await page.route('**/api/studio/projects', async (route) => {
    if (route.request().method() === 'POST') {
      const payload = route.request().postDataJSON() as {
        project?: Record<string, unknown> & { canvasTemplateId?: string; id?: string };
      } | null;
      postedProject = payload?.project ?? null;
      if (payload?.project?.canvasTemplateId) {
        postedTemplates.push(payload.project.canvasTemplateId);
      }
      postStartUrl = await page.evaluate(() => `${window.location.pathname}${window.location.search}`);
      postSawHydratedProject = await page.evaluate((hydratedProjectId) => {
        const raw = window.localStorage.getItem('maxvideoai.editor.projects.v1');
        if (!raw) return false;
        const projects = JSON.parse(raw) as Array<{ id?: string }>;
        return projects.some((project) => project.id === hydratedProjectId);
      }, hydratedProject.id);
      resolvePostStarted();
      await postResponseGate;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, project: payload?.project }),
      }).catch(() => {});
      return;
    }

    projectsGetCount += 1;
    if (projectsGetCount === 1) {
      resolveFirstProjectsGetStarted();
      await firstProjectsGetGate;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        projects: postedProject ? [postedProject, hydratedProject] : [hydratedProject],
      }),
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
  await page.addInitScript(() => {
    if (!window.sessionStorage.getItem('studio-marketing-entry-initialized')) {
      window.localStorage.removeItem('maxvideoai.editor.projects.v1');
      window.sessionStorage.setItem('studio-marketing-entry-initialized', 'true');
    }
    window.sessionStorage.setItem('last-known:user-id', 'studio-smoke-user');
  });

  await page.goto('/app/studio/projects?starter=storyboard-to-video');
  await dismissCookieBanner(page);
  await firstProjectsGetStarted;
  await page.waitForTimeout(250);
  expect(postedTemplates).toEqual([]);

  releaseFirstProjectsGet();
  await postStarted;
  expect(postedTemplates).toEqual(['guided-storyboard-to-video']);
  expect(postStartUrl).toBe('/app/studio/projects');
  expect(postSawHydratedProject).toBe(true);
  expect(postedProject?.id).toMatch(/^project_/);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL('/app/studio/projects');
  await expect(page.getByText('Hydrated server project')).toBeVisible();
  await expect.poll(() => projectsGetCount).toBe(2);
  await page.evaluate(() => new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
  }));
  expect(postedTemplates).toHaveLength(1);

  releasePostResponse();
  await page.goto(`/app/studio/workspace/${postedProject?.id}`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-canvas-guide-annotation]')).toHaveCount(5);
  assertNoEditorClientErrors(errors);
});

test('guide keyboard activation follows annotation order and highlights the handoff without changing modes', async ({ page }) => {
  const errors = trackEditorClientErrors(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openStoryboardGuideProject(page);

  const canvasButton = page.getByRole('button', { name: 'Canvas', exact: true });
  const viewerButton = page.locator('[data-studio-guide-anchor="viewer-tab"]');
  const timeline = page.locator('[data-studio-guide-anchor="timeline"]');
  const referenceNode = page.locator('.react-flow__node[data-id="asset-product-image"]');
  const canvas = page.locator('[data-studio-canvas-shell="true"]');
  const stepOne = page.locator('[data-guide-step="1"]');

  await stepOne.focus();
  await page.keyboard.press('Enter');
  await expect(referenceNode).toHaveAttribute('data-guide-highlighted', 'true');
  await expect.poll(async () => {
    const [canvasBox, nodeBox] = await Promise.all([canvas.boundingBox(), referenceNode.boundingBox()]);
    if (!canvasBox || !nodeBox) return Number.POSITIVE_INFINITY;
    const canvasCenterX = canvasBox.x + canvasBox.width / 2;
    const canvasCenterY = canvasBox.y + canvasBox.height / 2;
    const nodeCenterX = nodeBox.x + nodeBox.width / 2;
    const nodeCenterY = nodeBox.y + nodeBox.height / 2;
    return Math.hypot(canvasCenterX - nodeCenterX, canvasCenterY - nodeCenterY);
  }).toBeLessThan(8);

  await page.keyboard.press('Tab');
  await expect(page.locator('[data-guide-step="2"]')).toBeFocused();
  await page.locator('[data-guide-step="4"]').focus();
  await page.keyboard.press('Tab');
  const finalStep = page.locator('[data-guide-step="5"]');
  await expect(finalStep).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(viewerButton).toHaveAttribute('data-guide-highlighted', 'true');
  await expect(timeline).toHaveAttribute('data-guide-highlighted', 'true');
  expect(await viewerButton.evaluate((button) => Number.parseFloat(getComputedStyle(button).transitionDuration))).toBeLessThan(0.001);
  await expect(canvasButton).toHaveAttribute('aria-pressed', 'true');
  await expect(viewerButton).toHaveAttribute('aria-pressed', 'false');
  await page.waitForTimeout(800);
  await expect(timeline).toHaveAttribute('data-guide-highlighted', 'true');
  await expect.poll(() => viewerButton.getAttribute('data-guide-highlighted'), { timeout: 2_500 }).toBeNull();
  await expect.poll(() => timeline.getAttribute('data-guide-highlighted'), { timeout: 2_500 }).toBeNull();

  await page.locator('[data-guide-step="2"]').focus();
  await page.keyboard.press('Delete');
  await expect(page.locator('[data-guide-step="2"]')).toHaveCount(0);
  await expect(page.locator('[data-canvas-guide-annotation]')).toHaveCount(4);
  const ariaPositions = await page.locator('[data-canvas-guide-annotation]').evaluateAll((annotations) => annotations.map((annotation) => ({
    position: Number(annotation.getAttribute('aria-posinset')),
    size: Number(annotation.getAttribute('aria-setsize')),
  })));
  expect(ariaPositions.every(({ position, size }) => position >= 1 && position <= size && size === 4)).toBe(true);
  const guideListItems = await page.getByRole('list', { name: 'Canvas workflow guide' }).getByRole('listitem').allTextContents();
  expect(guideListItems).toHaveLength(4);
  expect(guideListItems.every((item) => !/^\s*\d+[.)]/.test(item))).toBe(true);
  assertNoEditorClientErrors(errors);
});

test('guide focus is consumed once across generation status changes', async ({ page }) => {
  const errors = trackEditorClientErrors(page);
  await openStoryboardGuideProject(page);
  await installGuideHighlightProbe(page, '[data-shot-generation-action="true"]');

  const stepThree = page.locator('[data-guide-step="3"]');
  await stepThree.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-shot-generation-action="true"]')).toHaveAttribute('data-guide-highlighted', 'true');
  await page.locator('[data-shot-generation-action="true"]').click();
  await expect(page.locator('[data-generated-output-status="ready"]')).toBeVisible();
  await expect.poll(() => page.locator('[data-shot-generation-action="true"]').getAttribute('data-guide-highlighted'), { timeout: 2_000 }).toBeNull();
  await expect.poll(async () => (await guideHighlightProbe(page)).starts).toBe(1);
  assertNoEditorClientErrors(errors);
});

for (const reducedMotion of [false, true]) {
  test(`guide highlight lasts 1.2 seconds${reducedMotion ? ' with reduced motion' : ''} through delete and undo`, async ({ page }) => {
    const errors = trackEditorClientErrors(page);
    await page.emulateMedia({ reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
    await openStoryboardGuideProject(page);
    await installGuideHighlightProbe(page, '[data-studio-guide-anchor="timeline"]');

    const timeline = page.locator('[data-studio-guide-anchor="timeline"]');
    const finalStep = page.locator('[data-guide-step="5"]');
    await finalStep.focus();
    await page.keyboard.press('Enter');
    await expect(timeline).toHaveAttribute('data-guide-highlighted', 'true');
    if (reducedMotion) {
      expect(await timeline.evaluate((element) => Number.parseFloat(getComputedStyle(element).transitionDuration))).toBeLessThan(0.001);
    }

    await page.waitForTimeout(240);
    await page.locator('[data-guide-step="2"]').press('Delete');
    await page.keyboard.press('Control+Z');
    await expect.poll(() => timeline.getAttribute('data-guide-highlighted'), { timeout: 2_000 }).toBeNull();
    const probe = await guideHighlightProbe(page);
    expect(probe.starts).toBe(1);
    expect(probe.durations).toHaveLength(1);
    expect(probe.durations[0]).toBeGreaterThanOrEqual(1_050);
    expect(probe.durations[0]).toBeLessThanOrEqual(1_450);
    assertNoEditorClientErrors(errors);
  });
}

test('guide surface tracks timeline resize and leaves timeline actions interactive', async ({ page }) => {
  const errors = trackEditorClientErrors(page);
  await openStoryboardGuideProject(page);

  const surfaceCallout = page.locator('[data-guide-surface-annotation="true"]');
  const timeline = page.locator('[data-studio-guide-anchor="timeline"]');
  const resizeHandle = page.locator('[data-timeline-resize-handle="true"]');
  await expectNoIntersection(surfaceCallout, timeline, 'surface guide and timeline');

  const timelineBefore = await timeline.boundingBox();
  const resizeBox = await resizeHandle.boundingBox();
  expect(timelineBefore).not.toBeNull();
  expect(resizeBox).not.toBeNull();
  if (!timelineBefore || !resizeBox) return;
  await page.mouse.move(resizeBox.x + resizeBox.width / 2, resizeBox.y + resizeBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(resizeBox.x + resizeBox.width / 2, resizeBox.y - 28, { steps: 5 });
  await page.mouse.up();
  await expect.poll(async () => (await timeline.boundingBox())?.height ?? 0).toBeGreaterThan(timelineBefore.height + 20);
  await expectNoIntersection(surfaceCallout, timeline, 'surface guide and resized timeline');

  const clipId = await createGuidedTimelineClip(page);
  const playbackControls = page.locator('[data-viewer-playback-controls="true"]');
  await expect(surfaceCallout).toHaveAttribute('data-guide-collapsed', 'true');
  await expectNoIntersection(surfaceCallout, playbackControls, 'surface guide and Viewer playback controls');
  await expect(surfaceCallout).toBeVisible();
  await expect.poll(async () => Number(await page.locator('[data-workspace-guide-surface-layer]').getAttribute('data-guide-measure-count'))).toBeGreaterThan(0);
  const measureCountBeforePlayback = Number(await page.locator('[data-workspace-guide-surface-layer]').getAttribute('data-guide-measure-count'));
  const playheadBefore = Number(await page.getByTestId('editor-program-frame').getAttribute('data-program-playhead'));
  await page.getByRole('button', { name: 'Play timeline' }).click();
  await expect(page.getByRole('button', { name: 'Pause timeline' })).toBeVisible();
  await expect.poll(async () => Number(await page.getByTestId('editor-program-frame').getAttribute('data-program-playhead'))).toBeGreaterThan(playheadBefore + 0.1);
  await page.waitForTimeout(220);
  expect(Number(await page.locator('[data-workspace-guide-surface-layer]').getAttribute('data-guide-measure-count'))).toBe(measureCountBeforePlayback);
  await page.getByRole('button', { name: 'Pause timeline' }).click();
  await expect(page.getByRole('button', { name: 'Play timeline' })).toBeVisible();

  const initialClip = await timelineClipState(page, clipId);
  await dragTimelineClipEnd(page, clipId, -34);
  await expect.poll(async () => (await timelineClipState(page, clipId)).duration).toBeLessThan(initialClip.duration);
  const trimmedClip = await timelineClipState(page, clipId);
  await dragTimelineClip(page, clipId, 34);
  await expect.poll(async () => (await timelineClipState(page, clipId)).start).toBeGreaterThan(trimmedClip.start);
  const visibilityToggle = page.locator('[data-timeline-video-visibility="video"]');
  await visibilityToggle.click();
  await expect(visibilityToggle).toHaveAttribute('aria-pressed', 'true');
  await visibilityToggle.click();
  await expect(visibilityToggle).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'Mark In' }).click();
  await expect(page.locator('[data-timeline-in-marker="true"]')).toBeVisible();
  await page.getByRole('button', { name: 'Open export dialog' }).click();
  await expect(page.getByRole('dialog', { name: 'Export sequence' })).toBeVisible();
  await page.getByRole('button', { name: 'Close export dialog' }).click();
  assertNoEditorClientErrors(errors);
});

test('guided Canvas keeps controls and expanded fit bounds visible at compact width', async ({ page }) => {
  const errors = trackEditorClientErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await openStoryboardGuideProject(page);

  await expect(page.locator('[data-canvas-guide-annotation]')).toHaveCount(5);
  await expectExpandedGuideBoundsInsideCanvas(page);
  await expect(page.locator('[data-canvas-guide-annotation][data-guide-collapsed="true"]')).toHaveCount(5);

  const navigator = page.locator('.react-flow [data-canvas-navigator="true"]');
  const guideTrigger = page.locator('#canvas-guide-menu-trigger');
  await expectNoIntersection(guideTrigger, navigator, 'compact guide trigger and Canvas navigator');
  await guideTrigger.click();
  await expectNoIntersection(page.locator('#canvas-guide-menu'), navigator, 'compact guide menu and Canvas navigator');
  assertNoEditorClientErrors(errors);
});

test('guided Canvas preserves viewport across Viewer and an initially hidden guide reveal', async ({ page }) => {
  const errors = trackEditorClientErrors(page);
  const projectId = await openStoryboardGuideProject(page);
  await expect(page.locator('[data-canvas-guide-annotation]')).toHaveCount(5);

  await page.locator('[data-guide-step="1"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.react-flow__node[data-id="asset-product-image"]')).toHaveAttribute('data-guide-highlighted', 'true');
  await panCanvasPane(page);

  await page.getByRole('button', { name: 'Zoom in canvas' }).click();
  await waitForCanvasViewportToSettle(page);
  await page.getByRole('button', { name: 'Zoom in canvas' }).click();
  const beforeViewer = await waitForCanvasViewportToSettle(page);
  await switchEditorFocus(page, 'Viewer');
  await switchEditorFocus(page, 'Canvas');
  await expect(page.locator('[data-canvas-guide-annotation]')).toHaveCount(5);
  await expect.poll(async () => canvasViewportTransform(page)).toEqual(beforeViewer);

  await page.locator('#canvas-guide-menu-trigger').click();
  await page.getByRole('menuitem', { name: 'Hide guide' }).click();
  await expect(page.locator('[data-canvas-guide-annotation]')).toHaveCount(0);
  await expect.poll(async () => {
    const raw = await persistedGuideStateJson(page, projectId);
    return raw ? (JSON.parse(raw) as { hidden?: boolean }).hidden : null;
  }).toBe(true);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await dismissCookieBanner(page);
  await expect(page.locator('#canvas-guide-menu-trigger')).toContainText('Show guide');
  await page.getByRole('button', { name: 'Zoom in canvas' }).click();
  await waitForCanvasViewportToSettle(page);
  await page.getByRole('button', { name: 'Zoom in canvas' }).click();
  const beforeShow = await waitForCanvasViewportToSettle(page);
  await page.locator('#canvas-guide-menu-trigger').click();
  await page.getByRole('menuitem', { name: 'Show guide' }).click();
  await expect(page.locator('[data-canvas-guide-annotation]')).toHaveCount(5);
  await expect.poll(async () => canvasViewportTransform(page)).toEqual(beforeShow);
  assertNoEditorClientErrors(errors);
});

test('guide drag commits only after movement and capture loss cancels idempotently', async ({ page }) => {
  const errors = trackEditorClientErrors(page);
  const projectId = await openStoryboardGuideProject(page);
  const undoButton = page.getByRole('button', { name: 'Undo canvas edit' });
  const guideAnnotation = page.locator('[data-canvas-guide-annotation]').first();
  const dragHandle = page.locator('[data-guide-drag-handle="true"]').first();
  await expect(undoButton).toBeDisabled();
  await expect.poll(() => persistedGuideStateJson(page, projectId)).not.toBeNull();
  const initialGuideState = await persistedGuideStateJson(page, projectId);

  await guideAnnotation.hover();
  await dragHandle.click();
  await expect(undoButton).toBeDisabled();
  expect(await persistedGuideStateJson(page, projectId)).toBe(initialGuideState);

  const handleBox = await dragHandle.boundingBox();
  expect(handleBox).not.toBeNull();
  if (!handleBox) return;
  await dragHandle.evaluate((handle) => {
    handle.addEventListener('pointerdown', (event) => {
      handle.setAttribute('data-test-pointer-id', String(event.pointerId));
    }, { once: true });
  });
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await expect.poll(() => dragHandle.evaluate((handle) => {
    const pointerId = Number(handle.getAttribute('data-test-pointer-id'));
    return Number.isFinite(pointerId) && handle.hasPointerCapture(pointerId);
  })).toBe(true);
  await dragHandle.evaluate((handle) => {
    const pointerId = Number(handle.getAttribute('data-test-pointer-id'));
    handle.releasePointerCapture(pointerId);
    handle.dispatchEvent(new PointerEvent('lostpointercapture', { bubbles: true, pointerId }));
  });
  await page.mouse.up();
  await expect(undoButton).toBeDisabled();
  expect(await persistedGuideStateJson(page, projectId)).toBe(initialGuideState);
  await panCanvasPane(page);

  await guideAnnotation.hover();
  const movedHandleBox = await dragHandle.boundingBox();
  expect(movedHandleBox).not.toBeNull();
  if (!movedHandleBox) return;
  await page.mouse.move(movedHandleBox.x + movedHandleBox.width / 2, movedHandleBox.y + movedHandleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(movedHandleBox.x + movedHandleBox.width / 2 + 12, movedHandleBox.y + movedHandleBox.height / 2 + 8, { steps: 4 });
  await page.mouse.up();
  await expect(undoButton).toBeEnabled();
  assertNoEditorClientErrors(errors);
});

test('guide destructive controls use Canvas history while hide and show stay nonhistorical', async ({ page }) => {
  const errors = trackEditorClientErrors(page);
  const projectId = await openStoryboardGuideProject(page);
  const undoButton = page.getByRole('button', { name: 'Undo canvas edit' });
  const redoButton = page.getByRole('button', { name: 'Redo canvas edit' });
  const initialNodeCount = await canvasNodeCount(page);
  const initialEdgeCount = await page.locator('.react-flow__edge').count();
  const initialTimelineCount = await timelineItemCount(page);

  await expect(undoButton).toBeDisabled();
  await page.locator('[data-guide-step="2"]').press('Delete');
  await expect(page.locator('[data-canvas-guide-annotation]')).toHaveCount(4);
  await expect(undoButton).toBeEnabled();

  await page.locator('#canvas-guide-menu-trigger').click();
  await page.getByRole('menuitem', { name: 'Hide guide' }).click();
  await expect(page.locator('[data-canvas-guide-annotation]')).toHaveCount(0);
  await expect(undoButton).toBeEnabled();
  await page.locator('#canvas-guide-menu-trigger').click();
  await page.getByRole('menuitem', { name: 'Show guide' }).click();
  await expect(page.locator('[data-canvas-guide-annotation]')).toHaveCount(4);
  await expect(undoButton).toBeEnabled();
  await undoButton.click();
  await expect(page.locator('[data-canvas-guide-annotation]')).toHaveCount(5);
  await expect(undoButton).toBeDisabled();

  const canceledDelete = new Promise<string>((resolve) => {
    page.once('dialog', async (dialog) => {
      resolve(dialog.message());
      await dialog.dismiss();
    });
  });
  await page.locator('#canvas-guide-menu-trigger').click();
  await page.getByRole('menuitem', { name: 'Delete all explanations' }).click();
  expect(await canceledDelete).toContain('Delete all guide explanations?');
  await expect(page.locator('[data-canvas-guide-annotation]')).toHaveCount(5);
  await expect(undoButton).toBeDisabled();

  const confirmedDelete = new Promise<string>((resolve) => {
    page.once('dialog', async (dialog) => {
      resolve(dialog.message());
      await dialog.accept();
    });
  });
  await page.locator('#canvas-guide-menu-trigger').click();
  await page.getByRole('menuitem', { name: 'Delete all explanations' }).click();
  expect(await confirmedDelete).toContain('Delete all guide explanations?');
  await expect(page.locator('[data-canvas-guide-annotation]')).toHaveCount(0);
  await undoButton.click();
  await expect(page.locator('[data-canvas-guide-annotation]')).toHaveCount(5);

  await page.locator('[data-guide-step="2"]').press('Delete');
  const stepOne = page.locator('[data-guide-step="1"]');
  await stepOne.hover();
  const dragHandle = stepOne.locator('[data-guide-drag-handle="true"]');
  const handleBox = await dragHandle.boundingBox();
  expect(handleBox).not.toBeNull();
  if (!handleBox) return;
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox.x + handleBox.width / 2 + 22, handleBox.y + handleBox.height / 2 + 14, { steps: 5 });
  await page.mouse.up();
  await expect.poll(async () => {
    const raw = await persistedGuideStateJson(page, projectId);
    if (!raw) return false;
    const state = JSON.parse(raw) as { annotations: Array<{ manualPosition?: unknown }> };
    return state.annotations.some((annotation) => Boolean(annotation.manualPosition));
  }).toBe(true);

  const confirmedReset = new Promise<string>((resolve) => {
    page.once('dialog', async (dialog) => {
      resolve(dialog.message());
      await dialog.accept();
    });
  });
  await page.locator('#canvas-guide-menu-trigger').click();
  await page.getByRole('menuitem', { name: 'Reset guide' }).click();
  expect(await confirmedReset).toContain('Restore deleted explanations and default positions?');
  await expect(page.locator('[data-canvas-guide-annotation]')).toHaveCount(5);
  await expect.poll(async () => {
    const raw = await persistedGuideStateJson(page, projectId);
    if (!raw) return true;
    const state = JSON.parse(raw) as { annotations: Array<{ manualPosition?: unknown }> };
    return state.annotations.some((annotation) => Boolean(annotation.manualPosition));
  }).toBe(false);
  expect(await canvasNodeCount(page)).toBe(initialNodeCount);
  expect(await page.locator('.react-flow__edge').count()).toBe(initialEdgeCount);
  expect(await timelineItemCount(page)).toBe(initialTimelineCount);

  await undoButton.click();
  await expect(page.locator('[data-canvas-guide-annotation]')).toHaveCount(4);
  await expect(redoButton).toBeEnabled();
  await redoButton.click();
  await expect(page.locator('[data-canvas-guide-annotation]')).toHaveCount(5);
  assertNoEditorClientErrors(errors);
});

test('saved canvases restore independent guide states and persist the active guide across reload', async ({ page }) => {
  const errors = trackEditorClientErrors(page);
  const projectId = await openStoryboardGuideProject(page);

  await page.locator('[data-guide-step="2"]').press('Delete');
  await expect(page.locator('[data-canvas-guide-annotation]')).toHaveCount(4);
  await saveCanvasAs(page, 'Guide canvas A');

  await page.getByRole('button', { name: 'Undo canvas edit' }).click();
  await expect(page.locator('[data-canvas-guide-annotation]')).toHaveCount(5);
  await saveCanvasAs(page, 'Guide canvas B');

  await openSavedCanvas(page, 'Guide canvas A');
  await expect(page.locator('[data-guide-step="2"]')).toHaveCount(0);
  await expect(page.locator('[data-guide-step="3"]')).toHaveCount(1);
  await openSavedCanvas(page, 'Guide canvas B');
  await expect(page.locator('[data-guide-step="2"]')).toHaveCount(1);

  await page.locator('[data-guide-step="3"]').press('Delete');
  await page.getByRole('button', { name: 'Save canvas' }).click();
  await page.getByRole('button', { name: /Save current canvas/ }).click();
  await expect.poll(async () => {
    const raw = await persistedGuideStateJson(page, projectId);
    return raw ? (JSON.parse(raw) as { annotations: unknown[] }).annotations.length : null;
  }).toBe(4);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await dismissCookieBanner(page);
  await expect(page.locator('[data-canvas-guide-annotation]')).toHaveCount(4);
  await expect(page.locator('[data-guide-step="2"]')).toHaveCount(1);
  await expect(page.locator('[data-guide-step="3"]')).toHaveCount(0);

  await openSavedCanvas(page, 'Guide canvas A');
  await expect(page.locator('[data-guide-step="2"]')).toHaveCount(0);
  await expect(page.locator('[data-guide-step="3"]')).toHaveCount(1);
  await openSavedCanvas(page, 'Guide canvas B');
  await expect(page.locator('[data-guide-step="2"]')).toHaveCount(1);
  await expect(page.locator('[data-guide-step="3"]')).toHaveCount(0);
  assertNoEditorClientErrors(errors);
});

test('legacy Product Ad hydration preserves matching-ID user edits and remains unguided', async ({ page }) => {
  const errors = trackEditorClientErrors(page);
  const projectId = 'project_old_unguided';
  const workspaceState = legacyEditedProductAdWorkspaceState();
  await page.addInitScript(({ id, state }) => {
    window.localStorage.setItem('maxvideoai.editor.projects.v1', JSON.stringify([{
      id,
      name: 'Legacy unguided project',
      canvasTemplateId: 'product-ad',
      settings: state.projectSettings,
      workspaceState: state,
    }]));
    window.localStorage.setItem(`maxvideoai.editor.workspace.v1.${id}`, JSON.stringify(state));
  }, { id: projectId, state: workspaceState });

  await page.goto(`/app/studio/workspace/${projectId}`, { waitUntil: 'domcontentloaded' });
  await dismissCookieBanner(page);
  await expect(page.locator('header').getByRole('button', { name: 'Projects', exact: true })).toBeVisible();
  await expect(page.locator('.react-flow__node')).toHaveCount(workspaceState.nodes.length);
  await expect(page.locator('.react-flow__node[data-id="prompt-camera"] textarea')).toHaveValue(
    'Keep this browser-authored orbit and rack-focus prompt.',
  );
  await expect(page.locator('.react-flow__node[data-id="shot-01"]')).toContainText('Seedance 2.0');
  await expect.poll(() => page.evaluate(({ id, expectedState }) => {
    const raw = window.localStorage.getItem(`maxvideoai.editor.workspace.v1.${id}`);
    if (!raw) return null;
    const persisted = JSON.parse(raw) as typeof expectedState;
    return JSON.stringify({
      activeTemplateId: persisted.activeTemplateId,
      edges: persisted.edges.map((edge) => ({
        id: edge.id,
        label: edge.data?.label,
        source: edge.source,
        sourceHandle: edge.sourceHandle,
        target: edge.target,
        targetHandle: edge.targetHandle,
      })),
      nodes: persisted.nodes.map((node) => ({
        id: node.id,
        position: node.position,
        promptText: node.data.promptText,
        shot: node.id === 'shot-01' && node.data.shot
          ? {
              aspectRatio: node.data.shot.aspectRatio,
              durationSec: node.data.shot.durationSec,
              modelId: node.data.shot.modelId,
              resolution: node.data.shot.resolution,
              seed: node.data.shot.seed,
            }
          : undefined,
        title: node.data.title,
      })),
      projectSettings: persisted.projectSettings,
    });
  }, { id: projectId, expectedState: workspaceState })).toBe(JSON.stringify({
    activeTemplateId: workspaceState.activeTemplateId,
    edges: workspaceState.edges.map((edge) => ({
      id: edge.id,
      label: edge.data?.label,
      source: edge.source,
      sourceHandle: edge.sourceHandle,
      target: edge.target,
      targetHandle: edge.targetHandle,
    })),
    nodes: workspaceState.nodes.map((node) => ({
      id: node.id,
      position: node.position,
      promptText: node.data.promptText,
      shot: node.id === 'shot-01' && node.data.shot
        ? {
            aspectRatio: node.data.shot.aspectRatio,
            durationSec: node.data.shot.durationSec,
            modelId: node.data.shot.modelId,
            resolution: node.data.shot.resolution,
            seed: node.data.shot.seed,
          }
        : undefined,
      title: node.data.title,
    })),
    projectSettings: workspaceState.projectSettings,
  }));
  await expect(page.locator('[data-canvas-guide-annotation]')).toHaveCount(0);
  await expect(page.locator('#canvas-guide-menu-trigger')).toHaveCount(0);
  assertNoEditorClientErrors(errors);
});

test('guide anchors survive validation and a mocked failed generation response without reload', async ({ page }) => {
  const errors = trackEditorClientErrors(page);
  let generationAttempts = 0;
  await page.route('**/api/generate', async (route) => {
    generationAttempts += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(generationAttempts === 2
        ? { status: 'completed', jobId: 'e2e-mocked-recovery', videoUrl: '/hero/veo3.mp4', thumbUrl: '/storyboard/examples/storyboarder-product-reference.jpg' }
        : { status: 'failed', jobId: `e2e-mocked-failure-${generationAttempts}`, videoUrl: null, thumbUrl: null }),
    });
  });
  const projectId = await openProductAdGuideProject(page);
  const prompt = page.locator('.react-flow__node[data-id="prompt-product-ad"] textarea');
  const initialPrompt = await prompt.inputValue();
  const generateButton = page.locator('[data-shot-generation-action="true"]');
  const validationStatus = page.locator('[data-shot-generation-status="true"]');

  await page.locator('.react-flow__node[data-id="prompt-product-ad"]').click({ force: true });
  await expect(page.locator('.react-flow__node[data-id="prompt-product-ad"]')).toHaveClass(/selected/);
  await page.getByRole('button', { name: 'Delete selected canvas nodes' }).click();
  await expect(page.locator('.react-flow__node[data-id="prompt-product-ad"]')).toHaveCount(0);
  await page.locator('.react-flow__node[data-id="asset-product-image"]').click({ force: true });
  await expect(page.locator('.react-flow__node[data-id="asset-product-image"]')).toHaveClass(/selected/);
  await page.getByRole('button', { name: 'Delete selected canvas nodes' }).click();
  await expect(page.locator('.react-flow__node[data-id="asset-product-image"]')).toHaveCount(0);
  await expect(generateButton).toBeDisabled();
  await expect(validationStatus).toContainText('Needs attention');
  await page.locator('[data-guide-step="3"]').focus();
  await page.keyboard.press('Enter');
  await expect(validationStatus).toHaveAttribute('data-guide-highlighted', 'true');

  await page.getByRole('button', { name: 'Undo canvas edit' }).click();
  await expect(page.locator('.react-flow__node[data-id="prompt-product-ad"]')).toHaveCount(1);
  await expect(page.locator('.react-flow__node[data-id="asset-product-image"]')).toHaveCount(1);
  await expect(generateButton).toBeEnabled();
  const stepThree = page.locator('[data-guide-step="3"]');
  await stepThree.hover();
  const dragHandle = stepThree.locator('[data-guide-drag-handle="true"]');
  const handleBox = await dragHandle.boundingBox();
  expect(handleBox).not.toBeNull();
  if (!handleBox) return;
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox.x + handleBox.width / 2 + 18, handleBox.y + handleBox.height / 2 + 12, { steps: 4 });
  await page.mouse.up();
  await expect.poll(async () => {
    const raw = await persistedGuideStateJson(page, projectId);
    if (!raw) return null;
    return (JSON.parse(raw) as { annotations: Array<{ id: string; manualPosition?: unknown }> })
      .annotations.find((annotation) => annotation.id.endsWith('-generate'))?.manualPosition ?? null;
  }).not.toBeNull();
  const guideStateBeforeFailureRaw = await persistedGuideStateJson(page, projectId);
  expect(guideStateBeforeFailureRaw).not.toBeNull();
  const guideStateBeforeFailure = JSON.parse(guideStateBeforeFailureRaw ?? 'null');

  await page.getByRole('button', { name: 'Toggle mock generation' }).click();
  await expect(page.getByRole('button', { name: 'Toggle mock generation' })).toContainText('Live');
  await generateButton.click();
  const failedStatus = page.locator('[data-generated-output-status="failed"]');
  await expect(failedStatus).toBeVisible();
  await page.locator('[data-guide-step="4"]').focus();
  await page.keyboard.press('Enter');
  await expect(failedStatus).toHaveAttribute('data-guide-highlighted', 'true');
  await expect(prompt).toHaveValue(initialPrompt);
  await expect(page.locator('.react-flow__node[data-id="shot-01"]')).toContainText('Seedance 2.0');

  await generateButton.click();
  const readyStatus = page.locator('[data-generated-output-status="ready"]');
  await expect(readyStatus).toBeVisible();
  const readyOutputNode = page.locator('.react-flow__node', { has: readyStatus });
  await page.locator('[data-guide-step="4"]').focus();
  await page.keyboard.press('Enter');
  await expect(readyStatus).toHaveAttribute('data-guide-highlighted', 'true');
  await expect(failedStatus).not.toHaveAttribute('data-guide-highlighted', 'true');
  await expect.poll(async () => {
    const [nodeBox, flowBox] = await Promise.all([
      readyOutputNode.boundingBox(),
      page.locator('.react-flow').first().boundingBox(),
    ]);
    if (!nodeBox || !flowBox) return Number.POSITIVE_INFINITY;
    return Math.hypot(
      nodeBox.x + nodeBox.width / 2 - (flowBox.x + flowBox.width / 2),
      nodeBox.y + nodeBox.height / 2 - (flowBox.y + flowBox.height / 2),
    );
  }).toBeLessThan(8);
  await expect(prompt).toHaveValue(initialPrompt);
  await expect.poll(async () => {
    const raw = await persistedGuideStateJson(page, projectId);
    return raw ? JSON.parse(raw) : null;
  }).toEqual(guideStateBeforeFailure);

  await generateButton.click();
  await expect(page.locator('[data-generated-output-status="failed"]')).toHaveCount(2);
  const latestFailedStatus = page.locator('[data-generated-output-status="failed"]').last();
  const latestFailedOutputNode = latestFailedStatus.locator('xpath=ancestor::*[contains(@class, "react-flow__node")][1]');
  await page.locator('[data-guide-step="4"]').focus();
  await page.keyboard.press('Enter');
  await expect(latestFailedStatus).toHaveAttribute('data-guide-highlighted', 'true');
  await expect(readyStatus).not.toHaveAttribute('data-guide-highlighted', 'true');
  await expect.poll(async () => {
    const [nodeBox, flowBox] = await Promise.all([
      latestFailedOutputNode.boundingBox(),
      page.locator('.react-flow').first().boundingBox(),
    ]);
    if (!nodeBox || !flowBox) return Number.POSITIVE_INFINITY;
    return Math.hypot(
      nodeBox.x + nodeBox.width / 2 - (flowBox.x + flowBox.width / 2),
      nodeBox.y + nodeBox.height / 2 - (flowBox.y + flowBox.height / 2),
    );
  }).toBeLessThan(8);
  expect(generationAttempts).toBe(3);
  assertNoEditorClientErrors(errors);
});

test('Mock generation retargets the result guide and hands off to Viewer without forced mode switching', async ({ page }) => {
  const errors = trackEditorClientErrors(page);
  await openProductAdGuideProject(page);
  const canvasButton = page.getByRole('button', { name: 'Canvas', exact: true });
  const viewerButton = page.locator('[data-studio-guide-anchor="viewer-tab"]');
  const timeline = page.locator('[data-studio-guide-anchor="timeline"]');

  await page.locator('[data-shot-generation-action="true"]').click();
  const readyStatus = page.locator('[data-generated-output-status="ready"]');
  await expect(readyStatus).toBeVisible();
  await page.locator('[data-guide-step="4"]').focus();
  await page.keyboard.press('Enter');
  const outputNode = page.locator('.react-flow__node', { has: readyStatus });
  await expect(readyStatus).toHaveAttribute('data-guide-highlighted', 'true');
  await outputNode.getByRole('button', { name: 'Send to timeline' }).click();
  await expect.poll(() => timelineItemCount(page)).toBe(1);
  await expect(canvasButton).toHaveAttribute('aria-pressed', 'true');
  await expect(viewerButton).toHaveAttribute('aria-pressed', 'false');

  await page.locator('[data-guide-step="5"]').focus();
  await page.keyboard.press('Enter');
  await expect(viewerButton).toHaveAttribute('data-guide-highlighted', 'true');
  await expect(timeline).toHaveAttribute('data-guide-highlighted', 'true');
  await switchEditorFocus(page, 'Viewer');
  const finalAnnotation = page.locator('[data-guide-surface-annotation="true"][data-guide-step="5"]');
  await expect(finalAnnotation).toBeVisible();
  await expectNoIntersection(finalAnnotation, page.locator('[data-viewer-playback-controls="true"]'), 'final guide and Viewer playback controls');
  assertNoEditorClientErrors(errors);
});

test('copying and pasting all guided starter nodes leaves the guide annotation count unchanged', async ({ page }) => {
  const errors = trackEditorClientErrors(page);
  await openProductAdGuideProject(page);
  const guideAnnotations = page.locator('[data-canvas-guide-annotation]');
  await expect(guideAnnotations).toHaveCount(5);

  await page.getByRole('button', { name: 'Marquee select canvas nodes' }).click();
  await marqueeSelectCanvasNodes(page, ['asset-product-image', 'prompt-product-ad', 'shot-01']);
  await expect(page.locator('.react-flow__node.selected')).toHaveCount(3);
  await copyCanvasGraphSelection(page);
  await pasteClipboardOnDocumentBody(page, {
    text: 'MaxVideoAI canvas graph selection',
    type: 'application/x-maxvideoai-canvas-graph',
  });

  await expect(page.locator('.react-flow__node')).toHaveCount(6);
  await expect(page.locator('.react-flow__edge')).toHaveCount(4);
  await expect(guideAnnotations).toHaveCount(5);
  assertNoEditorClientErrors(errors);
});

test('persisted semantic guide keys resolve immediately across English, French, and Spanish', async ({ page, context }) => {
  const errors = trackEditorClientErrors(page);
  const projectId = await openStoryboardGuideProject(page);
  await expect(page.locator('[data-guide-step="1"]')).toHaveAttribute('aria-label', 'Step 1: Choose the storyboard');
  await page.locator('[data-guide-step="2"]').press('Delete');
  await expect.poll(async () => {
    const raw = await persistedGuideStateJson(page, projectId);
    if (!raw) return [];
    return (JSON.parse(raw) as { annotations: Array<{ copyKey: string }> }).annotations.map((annotation) => annotation.copyKey);
  }).toEqual([
    'guided-storyboard-to-video:reference',
    'guided-storyboard-to-video:generate',
    'guided-storyboard-to-video:output',
    'guided-storyboard-to-video:timeline',
  ]);

  await context.setExtraHTTPHeaders({ 'x-next-intl-locale': 'fr' });
  await context.addCookies([
    { name: 'NEXT_LOCALE', value: 'fr', domain: 'localhost', path: '/' },
    { name: 'mvid_locale', value: 'fr', domain: 'localhost', path: '/' },
  ]);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await dismissCookieBanner(page);
  await expect(page.locator('[data-guide-step="1"]')).toHaveAttribute('aria-label', 'Étape 1 : Choisissez le storyboard');
  await expect(page.locator('[data-guide-step="2"]')).toHaveCount(0);

  await page.locator('button[aria-haspopup="menu"][title="Français"]').click();
  await page.getByRole('menuitemradio', { name: 'Español' }).click();
  await expect(page.locator('[data-guide-step="1"]')).toHaveAttribute('aria-label', 'Paso 1: Elige el storyboard');
  await expect(page.locator('[data-guide-step="2"]')).toHaveCount(0);
  assertNoEditorClientErrors(errors);
});

function pickerWorkspaceState() {
  return {
    nodes: [
      {
        id: 'picker-prompt',
        type: 'text-prompt',
        position: { x: 0, y: 40 },
        data: {
          kind: 'text-prompt',
          title: 'Prompt',
          subtitle: 'prompt.txt',
          accent: '#60a5fa',
          promptRole: 'prompt',
          promptText: 'A product video in studio light.',
          sourceHandles: ['prompt'],
        },
      },
      {
        id: 'picker-image',
        type: 'asset-image',
        position: { x: 0, y: 220 },
        data: {
          kind: 'asset-image',
          title: 'Reference image',
          subtitle: 'reference.png',
          accent: '#8b5cf6',
          sourceHandles: ['reference'],
        },
      },
      {
        id: 'picker-video',
        type: 'shot',
        position: { x: 400, y: 100 },
        selected: true,
        data: {
          kind: 'shot',
          title: 'Video generation',
          subtitle: 'Model-aware video generation block.',
          accent: '#f97316',
          shot: {
            modelId: 'seedance-2-0',
            workflowType: 'text_to_video',
            durationSec: 7,
            aspectRatio: '16:9',
            resolution: '1080p',
            fps: 24,
            outputCount: 1,
            seed: null,
            audioEnabled: false,
            lipSyncEnabled: false,
            referenceStrength: 0.65,
            outputName: 'Video output',
            status: 'draft',
            presetId: 'generate-video',
            family: 'video',
            outputKind: 'video',
          },
          targetHandles: ['prompt', 'start_image', 'end_image', 'reference', 'style', 'camera', 'audio'],
          sourceHandles: ['video_reference'],
        },
      },
    ],
    edges: [
      {
        id: 'picker-prompt-edge',
        source: 'picker-prompt',
        target: 'picker-video',
        sourceHandle: 'prompt',
        targetHandle: 'prompt',
        type: 'workspace-smart',
        data: { kind: 'prompt', label: 'Prompt', color: '#60a5fa' },
      },
      {
        id: 'picker-end-image-edge',
        source: 'picker-image',
        target: 'picker-video',
        sourceHandle: 'reference',
        targetHandle: 'end_image',
        type: 'workspace-smart',
        data: { kind: 'end_image', label: 'End image', color: '#c084fc' },
      },
    ],
    timelineItems: [],
    activeTemplateId: 'minimal-start',
    projectSettings: {
      aspectRatio: '16:9',
      resolution: '1920x1080',
      fps: 24,
    },
  };
}

function legacyEditedProductAdWorkspaceState() {
  const template = createStarterWorkspaceTemplate('product-ad');
  return {
    nodes: template.nodes.map((node, index) => ({
      ...structuredClone(node),
      position: {
        x: node.position.x + 41 + index,
        y: node.position.y - 29 - index,
      },
      data: {
        ...structuredClone(node.data),
        title: `Browser edited ${node.data.title}`,
        ...(node.id === 'prompt-camera'
          ? {
              generatedCopy: { ...node.data.generatedCopy, promptText: null },
              promptText: 'Keep this browser-authored orbit and rack-focus prompt.',
            }
          : {}),
        ...(node.id === 'shot-01' && node.data.shot
          ? {
              shot: {
                ...node.data.shot,
                aspectRatio: '9:16' as const,
                durationSec: 10,
                modelId: 'seedance-2-0',
                resolution: '720p' as const,
                seed: 8242,
              },
            }
          : {}),
      },
    })),
    edges: template.edges.map((edge) => ({
      ...structuredClone(edge),
      data: {
        ...structuredClone(edge.data),
        label: `Browser edited ${edge.data?.label ?? edge.id}`,
      },
    })),
    timelineItems: [],
    activeTemplateId: 'product-ad' as const,
    projectSettings: {
      aspectRatio: '9:16' as const,
      resolution: '720p' as const,
      fps: 30 as const,
    },
    focusMode: 'canvas' as const,
  };
}

const apiHydrationProjectSettings = {
  aspectRatio: '16:9',
  resolution: '1920x1080',
  fps: 24,
};

function apiHydrationWorkspaceState(title: string) {
  return {
    nodes: [
      {
        id: 'api-hydration-sentinel',
        type: 'text-prompt',
        position: { x: 180, y: 120 },
        selected: true,
        data: {
          kind: 'text-prompt',
          title,
          subtitle: 'api-hydration.txt',
          accent: '#60a5fa',
          promptRole: 'prompt',
          promptText: 'Keep the authoritative API graph during hydration.',
          sourceHandles: ['prompt'],
        },
      },
    ],
    edges: [],
    timelineItems: [],
    sequences: [],
    activeTemplateId: 'minimal-start',
    projectSettings: apiHydrationProjectSettings,
  };
}

async function installProjectHydrationFixture({
  page,
  projectId,
  sequenceStatus = 200,
  workspaceState,
}: {
  page: Page;
  projectId: string;
  sequenceStatus?: number;
  workspaceState: unknown;
}) {
  const mutations: Array<{ method: string; payload: unknown; url: string }> = [];
  let releaseHydration = () => {};
  const hydrationGate = new Promise<void>((resolve) => {
    releaseHydration = resolve;
  });

  await page.route(`**/api/studio/projects/${projectId}`, async (route) => {
    const request = route.request();
    if (request.method() !== 'GET') {
      mutations.push({ method: request.method(), payload: request.postDataJSON(), url: request.url() });
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
      return;
    }
    await hydrationGate;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        project: {
          id: projectId,
          name: 'API hydration project',
          canvasTemplateId: 'minimal-start',
          settings: apiHydrationProjectSettings,
          workspaceState,
        },
      }),
    });
  });
  await page.route(`**/api/studio/projects/${projectId}/sequences`, async (route) => {
    const request = route.request();
    if (request.method() !== 'GET') {
      mutations.push({ method: request.method(), payload: request.postDataJSON(), url: request.url() });
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
      return;
    }
    await hydrationGate;
    await route.fulfill({
      status: sequenceStatus,
      contentType: 'application/json',
      body: JSON.stringify(sequenceStatus === 200
        ? { ok: true, sequences: [] }
        : { ok: false, error: 'Sequence service unavailable' }),
    });
  });
  await page.route(`**/api/studio/projects/${projectId}/sequences/*`, async (route) => {
    const request = route.request();
    mutations.push({ method: request.method(), payload: request.postDataJSON(), url: request.url() });
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });

  return { mutations, releaseHydration };
}

test('Studio engine picker supports search, keyboard focus, and disabled model behavior', async ({ page }) => {
  const errors = trackEditorClientErrors(page);
  const workspaceState = pickerWorkspaceState();

  await page.addInitScript((persistedWorkspaceState) => {
    window.localStorage.setItem('maxvideoai.editor.workspace.v1', JSON.stringify(persistedWorkspaceState));
  }, workspaceState);
  await openEditorWorkspace(page);

  const trigger = page.locator('[data-studio-engine-picker-trigger="node"]').first();
  await expect(trigger).toBeVisible();
  await page.getByRole('button', { name: /choose an engine/i }).first().click();

  const search = page.getByPlaceholder('Search engines...');
  await expect(search).toBeVisible();
  await expect(search).toBeFocused();
  await search.fill('Veo');
  await expect(page.locator('[data-studio-engine-option]').filter({ hasText: /Veo/i }).first()).toBeVisible();
  await page.keyboard.press('ArrowDown');
  const highlightedOptionId = await search.getAttribute('aria-activedescendant');
  expect(highlightedOptionId).toBeTruthy();
  const highlightedOption = page.locator(`#${highlightedOptionId}`);
  await expect(highlightedOption).toHaveAttribute('data-studio-engine-disabled', 'false');
  const keyboardSelectedLabel = (await highlightedOption.locator('strong').textContent())?.trim();
  expect(keyboardSelectedLabel).toMatch(/Veo/i);
  await page.keyboard.press('Enter');
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveText(keyboardSelectedLabel ?? '');

  const selectedLabel = keyboardSelectedLabel;

  await trigger.click();
  const families = page.locator('[data-studio-engine-family]');
  const disabledOption = page.locator('[data-studio-engine-disabled="true"]').first();
  for (let index = 0; index < await families.count(); index += 1) {
    await families.nth(index).click();
    if (await disabledOption.count()) break;
  }
  await expect(disabledOption).toBeVisible();
  const disabledReason = (await disabledOption.getAttribute('title'))?.trim()
    ?? (await disabledOption.locator('span').allTextContents()).map((text) => text.trim()).find(Boolean);
  expect(disabledReason).toBeTruthy();
  await disabledOption.click({ force: true });
  await expect(trigger).toHaveText(selectedLabel ?? '');

  assertNoEditorClientErrors(errors);
});

test('Studio native video connectors follow engine switching', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await openMinimalEditorWorkspace(page);

  const node = page.locator('.react-flow__node-shot').first();
  const trigger = node.locator('[data-studio-engine-picker-trigger="node"]');
  await expect(node).toBeVisible();
  await expect(trigger).toBeVisible();
  await node.getByRole('button', { name: /Open .* settings/ }).click();
  const inspector = page.getByRole('complementary', { name: 'Node settings' });
  await expect(inspector).toBeVisible();

  for (const selection of [
    { family: 'seedance', model: 'seedance-2-0', label: 'Seedance 2.0', videoReferenceCapacity: '3/3' },
    { family: 'veo', model: 'veo-3-1', label: 'Google Veo 3.1', videoReferenceCapacity: null },
  ]) {
    await trigger.click();
    await page.locator(`[data-studio-engine-family="${selection.family}"]`).click();
    await page.locator(`[data-studio-engine-option="${selection.model}"]`).click();

    await expect(trigger).toHaveText(selection.label);
    await expect(node.locator('[data-shot-connector-kind="style"]')).toHaveCount(0);
    await expect(node.locator('[data-shot-connector-kind="camera"]')).toHaveCount(0);
    await expect(node.locator('[data-shot-connector-kind="voiceover"]')).toHaveCount(0);
    await expect(node.locator('[data-shot-connector-kind="music"]')).toHaveCount(0);
    await expect(node.locator('[data-shot-connector-kind="sfx"]')).toHaveCount(0);
    await expect(node.locator('[data-shot-connector-kind="prompt"]')).toBeVisible();
    await expect(node.locator('[data-shot-connector-kind="start_image"]')).toHaveCount(0);
    await expect(inspector.locator('[data-inspector-connector-kind="start_image"]'))
      .toHaveAttribute('data-inspector-connector-state', 'available');
    const nodeVideoReference = node.locator('[data-shot-connector-row="input"][data-shot-connector-kind="video_reference"]');
    const inspectorVideoReference = inspector.locator('[data-inspector-connector-kind="video_reference"]');
    if (selection.videoReferenceCapacity) {
      await expect(nodeVideoReference).toHaveCount(0);
      await expect(inspectorVideoReference).toHaveAttribute('data-inspector-connector-state', 'available');
      await expect(inspectorVideoReference).toContainText(selection.videoReferenceCapacity);
    } else {
      await expect(nodeVideoReference).toHaveCount(0);
      await expect(inspectorVideoReference).toHaveCount(0);
    }
  }

  assertNoEditorClientErrors(errors);
});

test('Studio exposes certified Seedance 2.5 and MiniMax H3 controls from their current engine schemas', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await openMinimalEditorWorkspace(page);
  const node = page.locator('.react-flow__node-shot').first();
  const trigger = node.locator('[data-studio-engine-picker-trigger="node"]');
  await expect(node).toBeVisible();

  const selectEngine = async (query: string, modelId: string) => {
    await trigger.click();
    const search = page.getByPlaceholder('Search engines...');
    await search.fill(query);
    const option = page.locator(`[data-studio-engine-option="${modelId}"]`);
    await expect(option).toBeVisible();
    await expect(option).toHaveAttribute('data-studio-engine-disabled', 'false');
    await option.click();
  };

  await selectEngine('Seedance 2.5', 'seedance-2-5');
  await expect(trigger).toHaveText('Seedance 2.5');
  await expect(node.locator('[data-shot-connector-row="input"][data-shot-connector-kind="video_reference"]')).toHaveCount(0);
  await node.getByRole('button', { name: /Open .* settings/ }).click();
  const inspector = page.getByRole('complementary', { name: 'Node settings' });
  await expect(inspector.locator('[data-inspector-connector-kind="video_reference"]')).toContainText('10/10');

  await selectEngine('MiniMax H3', 'minimax-h3');
  await expect(trigger).toHaveText('MiniMax H3');
  const resolutionSelect = node.locator('label').filter({ hasText: 'Resolution' }).locator('select');
  await expect(resolutionSelect).toBeVisible();
  expect(await resolutionSelect.locator('option').allTextContents()).toEqual(['768P', '2K', '4K']);
  const audioControl = node.locator('label').filter({ hasText: 'Audio' });
  await expect(audioControl).toContainText('Included');
  await expect(audioControl.locator('button')).toHaveCount(0);

  assertNoEditorClientErrors(errors);
});

test('Studio inspector engine picker selects through the shared node behavior', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await openMinimalEditorWorkspace(page);
  const generationNode = page.locator('.react-flow__node', { hasText: 'Video generation' });
  await expect(generationNode).toBeVisible();
  await generationNode.click();
  await generationNode.getByRole('button', { name: /Open .* settings/ }).click();
  await expect(page.getByRole('complementary', { name: 'Node settings' })).toBeVisible();

  const nodeTrigger = page.locator('[data-studio-engine-picker-trigger="node"]').first();
  const inspectorTrigger = page.locator('[data-studio-engine-picker-trigger="inspector"]').first();
  await expect(nodeTrigger).toBeVisible();
  await expect(inspectorTrigger).toBeVisible();
  await inspectorTrigger.click();

  const search = page.getByPlaceholder('Search engines...');
  await expect(search).toBeFocused();
  await search.fill('Veo 3.1');
  const option = page.locator('[data-studio-engine-option="veo-3-1"]').first();
  await expect(option).toBeVisible();
  await expect(option).toHaveAttribute('data-studio-engine-disabled', 'false');
  const selectedLabel = (await option.locator('strong').textContent())?.trim();
  expect(selectedLabel).toBeTruthy();
  await option.click();

  await expect(inspectorTrigger).toBeFocused();
  await expect(inspectorTrigger).toHaveText(selectedLabel ?? '');
  await expect(nodeTrigger).toHaveText(selectedLabel ?? '');
  assertNoEditorClientErrors(errors);
});

test('Studio waits for delayed API hydration before autosaving an existing project', async ({ page }) => {
  const errors = trackEditorClientErrors(page);
  const projectId = 'project-delayed-api-hydration';
  const workspaceState = apiHydrationWorkspaceState('Delayed API graph sentinel');
  const { mutations, releaseHydration } = await installProjectHydrationFixture({ page, projectId, workspaceState });

  await page.addInitScript((persistedProjectId) => {
    window.sessionStorage.setItem('last-known:user-id', 'studio-hydration-user');
    window.localStorage.removeItem(`maxvideoai.editor.workspace.v1.${persistedProjectId}`);
    window.localStorage.removeItem('maxvideoai.editor.projects.v1');
  }, projectId);
  await page.goto(`/app/studio/workspace/${projectId}`, { waitUntil: 'domcontentloaded' });
  await dismissCookieBanner(page);

  await expect(page.locator('header').getByRole('button', { name: 'Projects', exact: true })).toBeVisible();
  await page.waitForTimeout(1_100);
  expect(mutations, 'autosave must not mutate project or sequence APIs while hydration reads are pending').toEqual([]);

  releaseHydration();
  await expect(page.locator('.react-flow__node', { hasText: 'Delayed API graph sentinel' })).toBeVisible({ timeout: 4_000 });
  await expect.poll(
    () => mutations.filter((mutation) => mutation.method === 'PUT' && /\/projects\/[^/]+$/.test(new URL(mutation.url).pathname)).length,
    { timeout: 6_000 }
  ).toBeGreaterThan(0);
  const projectWrites = mutations.filter((mutation) => (
    mutation.method === 'PUT' && /\/projects\/[^/]+$/.test(new URL(mutation.url).pathname)
  ));
  expect(projectWrites.every((mutation) => {
    const payload = mutation.payload as { project?: { workspaceState?: { nodes?: Array<{ id?: string }> } } } | null;
    return payload?.project?.workspaceState?.nodes?.some((node) => node.id === 'api-hydration-sentinel');
  })).toBe(true);

  assertNoEditorClientErrors(errors);
});

test('Studio persists edits after production-shaped empty workspace hydration', async ({ page }) => {
  const errors = trackEditorClientErrors(page);
  const projectId = 'project-production-empty-workspace';
  const workspaceStorageKey = `maxvideoai.editor.workspace.v1.${projectId}`;
  const editedPrompt = 'Persist this edit after clean project hydration.';
  const { mutations, releaseHydration } = await installProjectHydrationFixture({
    page,
    projectId,
    workspaceState: {},
  });

  await page.addInitScript(({ persistedProjectId, storageKey }) => {
    window.sessionStorage.setItem('last-known:user-id', 'studio-hydration-user');
    window.localStorage.removeItem(storageKey);
    window.localStorage.removeItem('maxvideoai.editor.projects.v1');
    window.localStorage.removeItem(`maxvideoai.editor.workspace.v1.${persistedProjectId}`);
  }, { persistedProjectId: projectId, storageKey: workspaceStorageKey });
  await page.goto(`/app/studio/workspace/${projectId}`, { waitUntil: 'domcontentloaded' });
  await dismissCookieBanner(page);

  await expect(page.locator('header').getByRole('button', { name: 'Projects', exact: true })).toBeVisible();
  await page.waitForTimeout(1_100);
  expect(mutations, 'autosave must remain blocked while the empty workspace read is pending').toEqual([]);
  expect(await page.evaluate((storageKey) => window.localStorage.getItem(storageKey), workspaceStorageKey)).toBeNull();

  releaseHydration();
  const promptInput = page.locator('.react-flow__node[data-id="minimal-start-prompt"] textarea');
  await expect(promptInput).toBeVisible({ timeout: 4_000 });
  await promptInput.fill(editedPrompt);

  await expect.poll(async () => page.evaluate(({ storageKey, prompt }) => {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const state = JSON.parse(raw) as { nodes?: Array<{ id?: string; data?: { promptText?: string } }> };
    return state.nodes?.find((node) => node.id === 'minimal-start-prompt')?.data?.promptText === prompt;
  }, { storageKey: workspaceStorageKey, prompt: editedPrompt })).toBe(true);

  await expect.poll(() => mutations.some((mutation) => {
    if (mutation.method !== 'PUT' || !/\/projects\/[^/]+$/.test(new URL(mutation.url).pathname)) return false;
    const payload = mutation.payload as {
      project?: { workspaceState?: { nodes?: Array<{ id?: string; data?: { promptText?: string } }> } };
    } | null;
    return payload?.project?.workspaceState?.nodes?.some((node) => (
      node.id === 'minimal-start-prompt' && node.data?.promptText === editedPrompt
    )) ?? false;
  }), { timeout: 6_000 }).toBe(true);

  assertNoEditorClientErrors(errors);
});

test('Studio partial sequence hydration never autosaves the bootstrap over an API project graph', async ({ page }) => {
  const errors = trackEditorClientErrors(page);
  const projectId = 'project-partial-api-hydration';
  const workspaceState = apiHydrationWorkspaceState('Partial API graph sentinel');
  const { mutations, releaseHydration } = await installProjectHydrationFixture({
    page,
    projectId,
    sequenceStatus: 503,
    workspaceState,
  });

  await page.addInitScript((persistedProjectId) => {
    window.sessionStorage.setItem('last-known:user-id', 'studio-hydration-user');
    window.localStorage.removeItem(`maxvideoai.editor.workspace.v1.${persistedProjectId}`);
    window.localStorage.removeItem('maxvideoai.editor.projects.v1');
  }, projectId);
  await page.goto(`/app/studio/workspace/${projectId}`, { waitUntil: 'domcontentloaded' });
  await dismissCookieBanner(page);

  await expect(page.locator('header').getByRole('button', { name: 'Projects', exact: true })).toBeVisible();
  await page.waitForTimeout(1_100);
  expect(mutations, 'autosave must remain blocked while partial hydration reads are pending').toEqual([]);
  releaseHydration();
  await page.waitForTimeout(2_200);
  expect(mutations, 'a partial project/sequence read must keep API autosave blocked').toEqual([]);

  assertNoEditorClientErrors(errors, {
    allowedResourceFailures: [{ status: 503, urlPattern: /\/api\/studio\/projects\/.*\/sequences/ }],
  });
});

for (const scenario of [
  { theme: 'dark' as const, viewport: { width: 1024, height: 768 } },
  { theme: 'dark' as const, viewport: { width: 390, height: 844 } },
  { theme: 'light' as const, viewport: { width: 1024, height: 768 } },
]) {
  test(`Studio engine picker ${scenario.theme} theme keeps disabled options readable at ${scenario.viewport.width}x${scenario.viewport.height}`, async ({ page }) => {
    const errors = trackEditorClientErrors(page);
    const workspaceState = pickerWorkspaceState();

    await page.addInitScript(({ state, theme }) => {
      window.localStorage.setItem('maxvideoai.editor.workspace.v1', JSON.stringify(state));
      window.localStorage.setItem('maxvideoai.studio.theme.v1', theme);
      window.localStorage.setItem('maxvideoai.studio.theme.userOverride.v1', 'true');
    }, { state: workspaceState, theme: scenario.theme });
    await page.setViewportSize(scenario.viewport);
    await openEditorWorkspace(page);

    const shell = page.locator(`[data-studio-theme="${scenario.theme}"]`);
    await expect(shell).toBeVisible();
    const trigger = page.locator('[data-studio-engine-picker-trigger="node"]').first();
    await trigger.focus();
    await page.keyboard.press('Enter');
    const listbox = page.getByRole('listbox');
    await expectWithinViewport(page, listbox, `${scenario.theme} picker at ${scenario.viewport.width}x${scenario.viewport.height}`);

    const families = page.locator('[data-studio-engine-family]');
    const disabledOption = page.locator('[data-studio-engine-disabled="true"]').first();
    for (let index = 0; index < await families.count(); index += 1) {
      await families.nth(index).click();
      if (await disabledOption.count()) break;
    }
    await expect(disabledOption).toBeVisible();
    const disabledReason = (await disabledOption.getAttribute('title'))?.trim();
    expect(disabledReason).toBeTruthy();
    await expectReadable(disabledOption.locator('strong'), `${scenario.theme} disabled model label at ${scenario.viewport.width}x${scenario.viewport.height}`);
    await expectReadable(
      disabledOption.getByText(disabledReason ?? '', { exact: true }),
      `${scenario.theme} disabled model reason at ${scenario.viewport.width}x${scenario.viewport.height}`
    );

    if (scenario.viewport.width < 600) {
      const families = page.getByRole('navigation', { name: 'Families' });
      const familyRail = await families.evaluate((element) => ({
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
      }));
      expect(familyRail.scrollWidth).toBeGreaterThan(familyRail.clientWidth);

      await page.keyboard.press('Escape');
      const themeToggle = page.getByRole('button', { name: 'Switch Studio to light mode' });
      await expect(themeToggle).toBeVisible();
      await themeToggle.click();
      await expect(page.locator('[data-studio-theme="light"]')).toBeVisible();
    }

    assertNoEditorClientErrors(errors);
  });
}

test('Studio mobile theme toggle remains independently clickable beside language control', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await page.addInitScript(() => {
    window.localStorage.setItem('maxvideoai.studio.theme.v1', 'dark');
    window.localStorage.setItem('maxvideoai.studio.theme.userOverride.v1', 'true');
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await openFreshEditorWorkspace(page);

  const shell = page.locator('[data-studio-theme="dark"]');
  await expect(shell).toBeVisible();
  const languageToggle = page.getByRole('button', { name: 'Change workspace language' });
  const themeToggle = page.getByRole('button', { name: 'Switch Studio to light mode' });
  await expect(languageToggle).toBeVisible();
  await expect(themeToggle).toBeVisible();
  await themeToggle.click();
  await expect(page.locator('[data-studio-theme="light"]')).toBeVisible();

  assertNoEditorClientErrors(errors);
});

test('Studio persisted graph state is not replaced by the minimal project bootstrap', async ({ page }) => {
  const errors = trackEditorClientErrors(page);
  const projectId = 'project-persisted-graph';
  const workspaceState = {
    nodes: [
      {
        id: 'persisted-graph-sentinel',
        type: 'text-prompt',
        position: { x: 180, y: 120 },
        selected: true,
        data: {
          kind: 'text-prompt',
          title: 'Persisted graph sentinel',
          subtitle: 'sentinel.txt',
          accent: '#60a5fa',
          promptRole: 'prompt',
          promptText: 'Keep this persisted graph node after reload.',
          sourceHandles: ['prompt'],
        },
      },
    ],
    edges: [],
    timelineItems: [],
    activeTemplateId: 'minimal-start',
    projectSettings: {
      aspectRatio: '16:9',
      resolution: '1920x1080',
      fps: 24,
    },
  };

  await page.addInitScript(({ persistedProjectId, persistedWorkspaceState }) => {
    window.localStorage.setItem(
      `maxvideoai.editor.workspace.v1.${persistedProjectId}`,
      JSON.stringify(persistedWorkspaceState)
    );
  }, { persistedProjectId: projectId, persistedWorkspaceState: workspaceState });
  await page.goto(`/app/studio/workspace/${projectId}`, { waitUntil: 'domcontentloaded' });
  await dismissCookieBanner(page);

  await expect(page.locator('.react-flow__node', { hasText: 'Persisted graph sentinel' })).toBeVisible();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await dismissCookieBanner(page);
  await expect(page.locator('.react-flow__node', { hasText: 'Persisted graph sentinel' })).toBeVisible();
  await expect(page.locator('.react-flow__node', { hasText: 'Video generation' })).toHaveCount(0);

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
    window.sessionStorage.setItem('last-known:user-id', 'studio-smoke-user');
  });

  await page.goto('/app/studio/projects', { waitUntil: 'domcontentloaded' });
  await dismissCookieBanner(page);

  await expect(page.getByText('Action Cut')).toBeVisible();
  await expect(page.getByRole('button', { name: /Start Product Ad/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /New project/ })).toHaveCount(0);
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

  const inspectorModelPicker = page
    .getByRole('complementary', { name: 'Node settings' })
    .locator('[data-studio-engine-picker-trigger="inspector"]');
  await expect(inspectorModelPicker).toContainText('Seedance 2.0');
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
      intrinsicButtonHeight: button.offsetHeight,
      labelRight: labelBox ? labelBox.right : 0,
      labelWidth: labelBox ? labelBox.width : 0,
      priceLeft: priceBox ? priceBox.left : 0,
      priceText: price?.textContent?.trim() ?? '',
      priceWidth: priceBox ? priceBox.width : 0,
    };
  });

  expect(generateMetrics.intrinsicButtonHeight).toBeGreaterThanOrEqual(44);
  expect(generateMetrics.buttonHeight).toBeGreaterThan(0);
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
        markerBackgroundColor: handle ? getComputedStyle(handle, '::after').backgroundColor : '',
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
    expect(metric.markerBackgroundColor).not.toBe('rgba(0, 0, 0, 0)');
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

  await switchEditorFocus(page, 'Viewer');
  const initialTimelineItemCount = await timelineItemCount(page);
  await page.locator('[data-timeline-track="video"]').click({ position: { x: 8, y: 8 } });
  await expect(page.locator('[data-active-editor-surface="timeline"]')).toBeVisible();
  await expect(page.locator('.react-flow')).toHaveCount(0);
  await pasteClipboardOnDocumentBody(page, {
    text: 'MaxVideoAI canvas graph selection',
    type: 'application/x-maxvideoai-canvas-graph',
  });
  await expect(page.locator('[data-active-editor-surface="timeline"]')).toBeVisible();
  await expect(page.locator('.react-flow')).toHaveCount(0);
  await expect.poll(() => timelineItemCount(page)).toBe(initialTimelineItemCount);

  await pasteClipboardOnDocumentBody(page, { text: 'Timeline-owned body paste must stay external.' });
  await expect(page.locator('[data-active-editor-surface="timeline"]')).toBeVisible();
  await expect(page.locator('.react-flow')).toHaveCount(0);
  await expect.poll(() => timelineItemCount(page)).toBe(initialTimelineItemCount);

  await switchEditorFocus(page, 'Canvas');
  await page.locator('.react-flow__pane').click({ position: { x: 24, y: 24 } });
  await expect(page.locator('[data-active-editor-surface="canvas"]')).toBeVisible();
  await expect.poll(() => canvasNodeCount(page)).toBe(initialNodeCount);
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
