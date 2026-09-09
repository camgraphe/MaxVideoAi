import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import {
  assertNoEditorClientErrors,
  openEditorWorkspace,
  openFreshEditorWorkspace,
  switchEditorFocus,
  trackEditorClientErrors,
  type EditorClientErrors,
} from './editor-helpers';

const clientErrorsByPage = new WeakMap<Page, EditorClientErrors>();
const screenshotDirectory = join(process.cwd(), 'output/playwright/task-11');

test.beforeEach(async ({ page }) => {
  clientErrorsByPage.set(page, trackEditorClientErrors(page));
});

test.afterEach(async ({ page }) => {
  const errors = clientErrorsByPage.get(page);
  expect(errors).toBeDefined();
  if (errors) assertNoEditorClientErrors(errors);
});

async function expectThemeTokenContrast(page: Page, theme: 'light' | 'dark'): Promise<void> {
  const shell = page.locator(`[data-studio-theme="${theme}"]`);
  await expect(shell).toBeVisible();
  const contrast = await shell.evaluate((element) => {
    const styles = getComputedStyle(element);
    const resolveRgb = (value: string): [number, number, number] => {
      const probe = document.createElement('span');
      probe.style.color = value;
      document.body.append(probe);
      const channels = getComputedStyle(probe).color.match(/[\d.]+/g)?.map(Number) ?? [];
      probe.remove();
      return [channels[0] ?? 0, channels[1] ?? 0, channels[2] ?? 0];
    };
    const luminance = (color: [number, number, number]) => {
      const channels = color.map((channel) => {
        const value = channel / 255;
        return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    };
    const foreground = luminance(resolveRgb(styles.getPropertyValue('--studio-text').trim()));
    const background = luminance(resolveRgb(styles.getPropertyValue('--studio-bg').trim()));
    return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
  });
  expect(contrast).toBeGreaterThanOrEqual(4.5);
}

async function expectHorizontalTimeline(page: Page): Promise<void> {
  const viewport = page.locator('[class*="timelineViewport"]').first();
  await expect(viewport).toBeVisible();
  const dimensions = await viewport.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeGreaterThan(dimensions.clientWidth);
}

async function openResponsiveGuideProject(page: Page): Promise<void> {
  await openEditorWorkspace(page);
  await page.evaluate(() => {
    window.localStorage.removeItem('maxvideoai.editor.workspace.v1');
    window.localStorage.removeItem('maxvideoai.editor.projects.v1');
  });
  await page.goto('/app/studio/projects', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /Start Storyboard to Video/ }).click();
  await expect(page).toHaveURL(/\/app\/studio\/workspace\/project_/);
  await expect(page.locator('[data-canvas-guide-annotation]')).toHaveCount(5);
}

async function canvasZoom(page: Page): Promise<number> {
  return page.locator('.react-flow__viewport').evaluate((viewport) => {
    const transform = getComputedStyle(viewport).transform;
    return transform === 'none' ? 1 : new DOMMatrixReadOnly(transform).a;
  });
}

async function zoomCanvasToFortyPercent(page: Page): Promise<void> {
  const zoomOut = page.getByRole('button', { name: 'Zoom out canvas' });
  for (let attempt = 0; attempt < 8 && await canvasZoom(page) > 0.42; attempt += 1) {
    const before = await canvasZoom(page);
    await zoomOut.click();
    await expect.poll(() => canvasZoom(page)).toBeLessThan(before - 0.005);
  }
  const zoom = await canvasZoom(page);
  expect(zoom).toBeGreaterThanOrEqual(0.34);
  expect(zoom).toBeLessThanOrEqual(0.42);
}

async function expectSeparatedByAtLeast(page: Page, firstSelector: string, secondSelector: string, gap: number): Promise<void> {
  const [first, second] = await Promise.all([
    page.locator(firstSelector).first().boundingBox(),
    page.locator(secondSelector).first().boundingBox(),
  ]);
  expect(first).not.toBeNull();
  expect(second).not.toBeNull();
  if (!first || !second) return;
  const horizontalGap = Math.max(first.x - (second.x + second.width), second.x - (first.x + first.width), 0);
  const verticalGap = Math.max(first.y - (second.y + second.height), second.y - (first.y + first.height), 0);
  const intersects = horizontalGap === 0 && verticalGap === 0;
  expect(intersects).toBe(false);
  expect(Math.max(horizontalGap, verticalGap)).toBeGreaterThanOrEqual(gap);
}

async function expectSurfaceGuideClearance(page: Page, gap: number): Promise<void> {
  await expect.poll(() => page.locator('[data-guide-surface-annotation="true"]').evaluate((surface, minimumGap) => {
    const surfaceRect = surface.getBoundingClientRect();
    const selectors = [
      '.react-flow__node',
      '[data-canvas-guide-layer] [data-canvas-guide-annotation]',
      '[data-canvas-miniature-map="true"]',
      '[data-canvas-navigator="true"]',
      '#canvas-navigator-popover',
      '[data-canvas-floating-toolbar="true"]',
      '[data-canvas-guide-controls="true"]',
      '#canvas-guide-menu',
      '[data-studio-mobile-panel-controls="true"]',
      '[data-viewer-program-controls="true"]',
    ];
    return Array.from(document.querySelectorAll<HTMLElement>(selectors.join(','))).flatMap((element) => {
      if (element === surface || surface.contains(element) || element.contains(surface)) return [];
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height || style.display === 'none' || style.visibility === 'hidden') return [];
      const horizontalGap = Math.max(surfaceRect.left - rect.right, rect.left - surfaceRect.right, 0);
      const verticalGap = Math.max(surfaceRect.top - rect.bottom, rect.top - surfaceRect.bottom, 0);
      return Math.max(horizontalGap, verticalGap) + 0.5 < minimumGap
        ? [{
            selector: element.getAttribute('data-canvas-guide-annotation')
              || element.id
              || element.getAttribute('class')
              || element.tagName.toLowerCase(),
            horizontalGap,
            verticalGap,
          }]
        : [];
    });
  }, gap)).toEqual([]);
}

async function expectGuideClearanceFromTransientSurface(
  page: Page,
  protectedSelector: string,
  gap: number,
): Promise<void> {
  await expect.poll(async () => page.locator(protectedSelector).evaluate((protectedElement, minimumGap) => {
    const protectedRect = protectedElement.getBoundingClientRect();
    const guideElements = Array.from(document.querySelectorAll<HTMLElement>([
      '[data-canvas-guide-annotation]',
      '[data-guide-active-panel="true"]',
    ].join(',')));
    return guideElements.flatMap((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height || style.display === 'none' || style.visibility === 'hidden') return [];
      const horizontalGap = Math.max(rect.left - protectedRect.right, protectedRect.left - rect.right, 0);
      const verticalGap = Math.max(rect.top - protectedRect.bottom, protectedRect.top - rect.bottom, 0);
      return Math.max(horizontalGap, verticalGap) + 0.5 < minimumGap
        ? [{
            annotationId: element.dataset.canvasGuideAnnotation ?? 'active-panel',
            horizontalGap,
            verticalGap,
          }]
        : [];
    });
  }, gap)).toEqual([]);
}

async function expectCanonicalGuideTargets(page: Page): Promise<void> {
  const targets = page.locator('[data-canvas-guide-annotation]');
  await expect(targets).toHaveCount(5);
  await expect.poll(() => targets.evaluateAll((elements) => elements
    .map((element) => ({
      id: element.getAttribute('data-canvas-guide-annotation'),
      order: Number(element.getAttribute('data-guide-step')),
    }))
    .sort((left, right) => left.order - right.order))).toEqual([
      { id: 'guided-storyboard-to-video-guide-reference', order: 1 },
      { id: 'guided-storyboard-to-video-guide-prompt', order: 2 },
      { id: 'guided-storyboard-to-video-guide-generate', order: 3 },
      { id: 'guided-storyboard-to-video-guide-output', order: 4 },
      { id: 'guided-storyboard-to-video-guide-timeline', order: 5 },
  ]);
}

async function expectGuideContentInsideViewport(page: Page): Promise<void> {
  const violations = await page.locator('[data-canvas-guide-annotation]').evaluateAll((annotations) => annotations.flatMap((annotation) => {
    const rect = annotation.getBoundingClientRect();
    const style = getComputedStyle(annotation);
    const outsideViewport = rect.left < -0.5
      || rect.top < -0.5
      || rect.right > window.innerWidth + 0.5
      || rect.bottom > window.innerHeight + 0.5;
    const visibleCopy = Array.from(annotation.querySelectorAll<HTMLElement>('strong, p'));
    const clippedContent = annotation.getAttribute('data-guide-collapsed') !== 'true'
      && visibleCopy.some((element) => element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1);
    return outsideViewport || clippedContent || style.visibility === 'hidden'
      ? [{
          id: annotation.getAttribute('data-canvas-guide-annotation'),
          outsideViewport,
          clippedContent,
          visibility: style.visibility,
        }]
      : [];
  }));
  expect(violations).toEqual([]);
}

async function placeGuideBadgeNearHorizontalEdge(
  page: Page,
  badgeSelector: string,
  edge: 'left' | 'right',
): Promise<void> {
  const badge = page.locator(badgeSelector);
  await badge.focus();
  const dragHandle = badge.locator('[data-guide-drag-handle="true"]');
  await expect(dragHandle).toBeVisible();
  const [badgeBox, canvasBox, handleBox] = await Promise.all([
    badge.boundingBox(),
    page.locator('[data-canvas-guide-layer="true"]').boundingBox(),
    dragHandle.boundingBox(),
  ]);
  expect(badgeBox).not.toBeNull();
  expect(canvasBox).not.toBeNull();
  expect(handleBox).not.toBeNull();
  if (!badgeBox || !canvasBox || !handleBox) return;
  const targetX = edge === 'left'
    ? canvasBox.x + 4
    : canvasBox.x + canvasBox.width - badgeBox.width - 40;
  const deltaX = targetX - badgeBox.x;
  if (Math.abs(deltaX) < 4) return;
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    handleBox.x + handleBox.width / 2 + deltaX,
    handleBox.y + handleBox.height / 2,
    { steps: 5 },
  );
  await page.mouse.up();
  await expect.poll(async () => {
    const settledBox = await badge.boundingBox();
    return settledBox ? Math.abs(settledBox.x - targetX) : Number.POSITIVE_INFINITY;
  }).toBeLessThanOrEqual(1);
}

async function expectGuideBadgeActionsReachableInsideViewport(
  page: Page,
  badgeSelector: string,
  expectedSide: 'left' | 'right',
): Promise<void> {
  const badge = page.locator(badgeSelector);
  await badge.focus();
  const actions = badge.getByRole('button');
  await expect(actions).toHaveCount(2);
  await expect(actions.first()).toBeVisible();
  const geometry = await badge.evaluate((annotation, side) => {
    const badgeRect = annotation.getBoundingClientRect();
    const buttons = Array.from(annotation.querySelectorAll<HTMLButtonElement>('button'));
    const actionRects = buttons.map((button) => {
      const rect = button.getBoundingClientRect();
      const hitTarget = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return {
        bottom: rect.bottom,
        hit: hitTarget === button || Boolean(hitTarget && button.contains(hitTarget)),
        left: rect.left,
        right: rect.right,
        top: rect.top,
      };
    });
    return {
      actionRects,
      onExpectedSide: side === 'left'
        ? actionRects.every((rect) => rect.right <= badgeRect.left + 0.5)
        : actionRects.every((rect) => rect.left >= badgeRect.right - 0.5),
      viewport: { height: window.innerHeight, width: window.innerWidth },
    };
  }, expectedSide);
  expect(geometry.onExpectedSide).toBe(true);
  expect(geometry.actionRects).toHaveLength(2);
  for (const rect of geometry.actionRects) {
    expect(rect.left).toBeGreaterThanOrEqual(-0.5);
    expect(rect.top).toBeGreaterThanOrEqual(-0.5);
    expect(rect.right).toBeLessThanOrEqual(geometry.viewport.width + 0.5);
    expect(rect.bottom).toBeLessThanOrEqual(geometry.viewport.height + 0.5);
    expect(rect.hit).toBe(true);
  }
  for (const action of await actions.all()) await action.click({ trial: true });
}

async function expectGuideTypographyScale(page: Page, textScale: number): Promise<void> {
  const preferredSelectors = [
    '[data-guide-active-panel="true"]',
    '[data-guide-step="3"][data-guide-collapsed="false"]',
    '[data-guide-surface-annotation="true"][data-guide-collapsed="false"]',
  ];
  const expandedGuide = page.locator(
    preferredSelectors.map((selector) => `${selector}:visible`).join(', ')
  ).first();
  await expect(expandedGuide).toBeVisible();
  const metrics = await expandedGuide.evaluate((annotation) => {
    const rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
    const step = annotation.querySelector<HTMLElement>('span');
    const title = annotation.querySelector<HTMLElement>('strong');
    const body = annotation.querySelector<HTMLElement>('p');
    return {
      body: body ? Number.parseFloat(getComputedStyle(body).fontSize) : null,
      root: rootFontSize,
      step: step ? Number.parseFloat(getComputedStyle(step).fontSize) : null,
      title: title ? Number.parseFloat(getComputedStyle(title).fontSize) : null,
    };
  });
  const scale = textScale / 100;
  expect(metrics.root).toBeCloseTo(16 * scale, 1);
  expect(metrics.body).toBeCloseTo(11 * scale, 1);
  expect(metrics.step).toBeCloseTo(11 * scale, 1);
  expect(metrics.title).toBeCloseTo(12 * scale, 1);
  if (textScale > 100) {
    expect(metrics.body).toBeGreaterThan(11);
    expect(metrics.title).toBeGreaterThan(12);
  }
}

async function expectNodeGuideGeometry(page: Page, minimumGap: number): Promise<void> {
  const guideTargets = [
    { id: 'guided-storyboard-to-video-guide-reference', anchor: '.react-flow__node[data-id="asset-product-image"]' },
    { id: 'guided-storyboard-to-video-guide-prompt', anchor: '.react-flow__node[data-id="prompt-product-ad"]' },
    { id: 'guided-storyboard-to-video-guide-generate', anchor: '.react-flow__node[data-id="shot-01"]' },
    { id: 'guided-storyboard-to-video-guide-output', anchor: '.react-flow__node[data-id="shot-01"]' },
  ];

  for (const target of guideTargets) {
    const callout = page.locator(`[data-canvas-guide-annotation="${target.id}"]`);
    const anchor = page.locator(target.anchor);
    const leader = page.locator(`[data-guide-leader-annotation="${target.id}"]`);
    await expect(callout).toBeVisible();
    await expect(anchor).toBeVisible();
    await expect(leader).toHaveCount(1);
    await expect.poll(async () => {
      const [calloutBox, anchorBox] = await Promise.all([callout.boundingBox(), anchor.boundingBox()]);
      if (!calloutBox || !anchorBox) return 0;
      const horizontalGap = Math.max(
        calloutBox.x - (anchorBox.x + anchorBox.width),
        anchorBox.x - (calloutBox.x + calloutBox.width),
        0,
      );
      const verticalGap = Math.max(
        calloutBox.y - (anchorBox.y + anchorBox.height),
        anchorBox.y - (calloutBox.y + calloutBox.height),
        0,
      );
      return Math.hypot(horizontalGap, verticalGap);
    }).toBeGreaterThanOrEqual(minimumGap - 0.5);
    await expect.poll(() => leader.evaluate((line, anchorSelector) => {
      const anchorElement = document.querySelector<HTMLElement>(anchorSelector);
      const svg = line.ownerSVGElement;
      if (!(line instanceof SVGLineElement) || !anchorElement || !svg) return Number.POSITIVE_INFINITY;
      const svgRect = svg.getBoundingClientRect();
      const endpoint = {
        x: svgRect.left + line.x2.baseVal.value,
        y: svgRect.top + line.y2.baseVal.value,
      };
      const anchorRect = anchorElement.getBoundingClientRect();
      const horizontalDistance = Math.max(anchorRect.left - endpoint.x, endpoint.x - anchorRect.right, 0);
      const verticalDistance = Math.max(anchorRect.top - endpoint.y, endpoint.y - anchorRect.bottom, 0);
      return Math.hypot(horizontalDistance, verticalDistance);
    }, target.anchor)).toBeCloseTo(8, 0);
  }
}

async function expectInnerGuideTargetsRemainSemantic(page: Page): Promise<void> {
  await page.locator('[data-guide-step="3"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-shot-generation-action="true"]')).toHaveAttribute('data-guide-highlighted', 'true');

  await page.locator('[data-guide-step="4"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-shot-generation-status="true"]')).toHaveAttribute('data-guide-highlighted', 'true');
}

for (const scenario of [
  { name: 'desktop default text', viewport: { width: 1440, height: 900 }, textScale: 100, gap: 28, nodeGeometry: true, reducedMotion: 'no-preference' as const },
  { name: 'compact default text', viewport: { width: 1024, height: 768 }, textScale: 100, gap: 20, nodeGeometry: true, reducedMotion: 'no-preference' as const },
  { name: 'mobile default text', viewport: { width: 390, height: 844 }, textScale: 100, gap: 20, nodeGeometry: false, reducedMotion: 'no-preference' as const },
  { name: 'desktop 150 percent text', viewport: { width: 1440, height: 900 }, textScale: 150, gap: 28, nodeGeometry: false, reducedMotion: 'reduce' as const },
  { name: 'desktop 200 percent text', viewport: { width: 1440, height: 900 }, textScale: 200, gap: 28, nodeGeometry: false, reducedMotion: 'reduce' as const },
]) {
  test(`guide remains readable with ${scenario.name}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: scenario.reducedMotion });
    await page.addInitScript((textScale) => {
      window.addEventListener('DOMContentLoaded', () => {
        document.documentElement.style.fontSize = `${textScale}%`;
      }, { once: true });
    }, scenario.textScale);
    await page.setViewportSize(scenario.viewport);
    await openResponsiveGuideProject(page);

    await expectCanonicalGuideTargets(page);
    await page.locator('[data-guide-step="3"]').focus();
    await page.keyboard.press('Enter');
    await expectGuideTypographyScale(page, scenario.textScale);
    await expectGuideContentInsideViewport(page);
    await expectSurfaceGuideClearance(page, scenario.gap);
    if (scenario.nodeGeometry) {
      await expectNodeGuideGeometry(page, scenario.gap);
      await expectInnerGuideTargetsRemainSemantic(page);
    }
    if (scenario.reducedMotion === 'reduce') {
      await expect.poll(() => page.locator('[data-guide-step="3"]').evaluate((annotation) => (
        Number.parseFloat(getComputedStyle(annotation).transitionDuration)
      ))).toBeLessThan(0.001);
    }
  });
}

test('guided canvas keeps selected node commands available without dismissing the guide', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openResponsiveGuideProject(page);
  await expect(page.locator('[data-canvas-guide-annotation]')).toHaveCount(5);

  const generationNode = page.locator('.react-flow__node[data-id="shot-01"]');
  await generationNode.click();
  const nodeCommands = page.locator('[data-canvas-node-actions-overlay]');
  await expect(nodeCommands.locator('[data-canvas-node-inspect-button="shot-01"]')).toBeVisible();
  await expect(nodeCommands.locator('[data-canvas-node-actions-button]')).toBeVisible();
  await expect(page.locator('[data-canvas-guide-annotation]')).toHaveCount(5);
});

test('desktop surface guide preserves its timeline gap after measured copy expands', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openResponsiveGuideProject(page);

  const surfaceCallout = page.locator('[data-guide-surface-annotation="true"]');
  const timelineAnchor = page.locator('[data-studio-guide-anchor="timeline"]');
  await expect(surfaceCallout).toBeVisible();
  await expect.poll(async () => {
    const [calloutBox, timelineBox] = await Promise.all([
      surfaceCallout.boundingBox(),
      timelineAnchor.boundingBox(),
    ]);
    if (!calloutBox || !timelineBox) return 0;
    return timelineBox.y - (calloutBox.y + calloutBox.height);
  }).toBeGreaterThanOrEqual(27.5);

  await expect.poll(() => page.locator('[data-workspace-guide-surface-layer] svg line').evaluate((line, selector) => {
    const anchor = document.querySelector<HTMLElement>(selector);
    const svg = line.ownerSVGElement;
    if (!(line instanceof SVGLineElement) || !anchor || !svg) return Number.POSITIVE_INFINITY;
    const svgRect = svg.getBoundingClientRect();
    const x = svgRect.left + line.x2.baseVal.value;
    const y = svgRect.top + line.y2.baseVal.value;
    const anchorRect = anchor.getBoundingClientRect();
    const anchorX = anchorRect.left + anchorRect.width / 2;
    const anchorY = anchorRect.top + 1;
    return Math.hypot(x - anchorX, y - anchorY);
  }, '[data-studio-guide-anchor="timeline"]')).toBeCloseTo(8, 0);
});

test('Studio desktop keeps Project media, viewer, inspector, and timeline visible', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1024 });
  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Viewer');

  await expect(page.getByRole('complementary', { name: 'Project media library' })).toBeVisible();
  await expect(page.getByTestId('editor-video-viewer')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Clip inspector' })).toBeVisible();
  await expect(page.getByLabel('Video timeline')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Project media', exact: true })).toBeHidden();
});

test('guide compacts every annotation at 40 percent zoom and expands only the active badge', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1024 });
  await openResponsiveGuideProject(page);
  await zoomCanvasToFortyPercent(page);

  const annotations = page.locator('[data-canvas-guide-annotation]');
  await expect(annotations).toHaveCount(5);
  await expect(page.locator('[data-canvas-guide-annotation][data-guide-collapsed="true"]')).toHaveCount(5);

  const thirdStep = page.locator('[data-guide-step="3"]');
  await thirdStep.focus();
  await page.keyboard.press('Enter');
  await expect(thirdStep).toHaveAttribute('data-guide-collapsed', 'false');
  await expect(page.locator('[data-canvas-guide-annotation][data-guide-collapsed="false"]')).toHaveCount(1);
  await expectSurfaceGuideClearance(page, 28);
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-canvas-guide-annotation][data-guide-collapsed="true"]')).toHaveCount(5);
});

for (const viewport of [
  { width: 360, height: 640 },
  { width: 375, height: 667 },
]) {
  test(`short mobile guide preserves canonical step 5 at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openResponsiveGuideProject(page);

    await expectCanonicalGuideTargets(page);
    const surfaceBadge = page.locator('[data-guide-surface-annotation="true"]');
    await expect(surfaceBadge).toBeVisible();
    await expect(surfaceBadge).toHaveAttribute('data-guide-step', '5');
    await expectSurfaceGuideClearance(page, 20);

    const tabbedTargets: Array<{ id: string | null; order: string | null }> = [];
    await page.locator('[data-guide-step="1"]').focus();
    for (let index = 0; index < 5; index += 1) {
      tabbedTargets.push(await page.evaluate(() => ({
        id: document.activeElement?.getAttribute('data-canvas-guide-annotation') ?? null,
        order: document.activeElement?.getAttribute('data-guide-step') ?? null,
      })));
      if (index < 4) await page.keyboard.press('Tab');
    }
    expect(tabbedTargets).toEqual([
      { id: 'guided-storyboard-to-video-guide-reference', order: '1' },
      { id: 'guided-storyboard-to-video-guide-prompt', order: '2' },
      { id: 'guided-storyboard-to-video-guide-generate', order: '3' },
      { id: 'guided-storyboard-to-video-guide-output', order: '4' },
      { id: 'guided-storyboard-to-video-guide-timeline', order: '5' },
    ]);

    await page.keyboard.press('Enter');
    await expect(page.locator('[data-studio-guide-anchor="viewer-tab"]')).toHaveAttribute('data-guide-highlighted', 'true');
    await expect(page.locator('[data-studio-guide-anchor="timeline"]')).toHaveAttribute('data-guide-highlighted', 'true');
  });
}

test('mobile guide keeps five canonical badges and one nonduplicating active-copy panel', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openResponsiveGuideProject(page);

  const surfaceBadge = page.locator('[data-guide-surface-annotation="true"]');
  const activePanel = page.locator('[data-guide-active-panel="true"]');
  await expectCanonicalGuideTargets(page);
  await expect(page.locator('[data-canvas-guide-annotation][data-guide-collapsed="true"]')).toHaveCount(5);
  await expect(surfaceBadge).toHaveAttribute('data-guide-step', '5');
  await expect(surfaceBadge).toHaveAttribute('data-guide-collapsed', 'true');
  await expect(activePanel).toBeVisible();
  await expect(activePanel).not.toHaveAttribute('tabindex');
  await expect(activePanel).toHaveAttribute('data-guide-active-step', '5');
  await expect(activePanel).toContainText('Refine the edit');
  await expectSurfaceGuideClearance(page, 20);

  const tabbedTargets: Array<{ id: string | null; order: string | null }> = [];
  await page.locator('[data-guide-step="1"]').focus();
  for (let index = 0; index < 5; index += 1) {
    tabbedTargets.push(await page.evaluate(() => ({
      id: document.activeElement?.getAttribute('data-canvas-guide-annotation') ?? null,
      order: document.activeElement?.getAttribute('data-guide-step') ?? null,
    })));
    if (index < 4) await page.keyboard.press('Tab');
  }
  expect(tabbedTargets).toEqual([
    { id: 'guided-storyboard-to-video-guide-reference', order: '1' },
    { id: 'guided-storyboard-to-video-guide-prompt', order: '2' },
    { id: 'guided-storyboard-to-video-guide-generate', order: '3' },
    { id: 'guided-storyboard-to-video-guide-output', order: '4' },
    { id: 'guided-storyboard-to-video-guide-timeline', order: '5' },
  ]);

  await page.locator('[data-guide-step="1"]').click();
  await expect(activePanel).toHaveAttribute('data-guide-active-step', '1');
  await expectCanonicalGuideTargets(page);
  await surfaceBadge.focus();
  await page.keyboard.press('Enter');
  await expect(activePanel).toHaveAttribute('data-guide-active-step', '5');
  await expect(activePanel).toContainText('Refine the edit');
  await switchEditorFocus(page, 'Viewer');
  await expect(surfaceBadge).toBeVisible();
  await expect(activePanel).toHaveAttribute('data-guide-active-step', '5');
  await expect(activePanel).toContainText('Refine the edit');

  await switchEditorFocus(page, 'Canvas');
  await expectSeparatedByAtLeast(page, '[data-guide-active-panel="true"]', 'header', 20);
  await expectSeparatedByAtLeast(page, '[data-guide-active-panel="true"]', '[data-studio-guide-anchor="timeline"]', 12);
  const selectedNode = page.locator('.react-flow__node.selected');
  await expect(selectedNode).toBeVisible();
  await page.keyboard.press('i');
  await expect(page.locator('[class*="mobilePanelRail"]')).toBeVisible();
  await expect(page.locator('#studio-inspector-panel')).toBeVisible();
  await expect(activePanel).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(page.locator('#studio-inspector-panel')).toBeHidden();
  await expect(activePanel).toBeVisible();
  await expectSeparatedByAtLeast(page, '[data-guide-active-panel="true"]', '.react-flow__node.selected', 20);

  await expectCanonicalGuideTargets(page);
});

for (const viewport of [
  { width: 390, height: 844 },
  { width: 430, height: 932 },
]) {
  test(`mobile collapsed guide action trays stay reachable at both viewport edges at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openResponsiveGuideProject(page);

    const leftBadgeSelector = '[data-guide-step="1"]';
    const rightBadgeSelector = '[data-guide-step="3"]';
    await placeGuideBadgeNearHorizontalEdge(page, leftBadgeSelector, 'left');
    await expectGuideBadgeActionsReachableInsideViewport(page, leftBadgeSelector, 'right');
    await placeGuideBadgeNearHorizontalEdge(page, rightBadgeSelector, 'right');
    await expectGuideBadgeActionsReachableInsideViewport(page, rightBadgeSelector, 'left');

    await page.locator(leftBadgeSelector).focus();
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-guide-step="2"]')).toBeFocused();
    await expectCanonicalGuideTargets(page);
  });
}

for (const scenario of [
  { name: 'desktop', viewport: { width: 1440, height: 1024 }, gap: 28 },
  { name: 'compact', viewport: { width: 390, height: 844 }, gap: 20 },
]) {
  test(`guide remeasures every ${scenario.name} toolbar popover and leaves its actions clickable`, async ({ page }) => {
    await page.setViewportSize(scenario.viewport);
    await openResponsiveGuideProject(page);

    const transientSurfaces = [
      { label: 'Add', id: 'canvas-toolbar-add-menu', action: '[data-canvas-toolbar-block-id="image"]' },
      { label: 'Add', id: 'canvas-toolbar-add-menu', action: '[data-canvas-toolbar-block-id="video"]' },
      { label: 'Add', id: 'canvas-toolbar-add-menu', action: '[data-canvas-toolbar-block-id="music"]' },
      { label: 'Add', id: 'canvas-toolbar-add-menu', action: '[data-canvas-toolbar-block-id="free-text"]' },
      { label: 'Save canvas', id: 'canvas-toolbar-save-popover', action: 'button' },
    ];

    for (const transient of transientSurfaces) {
      await page.getByRole('button', { name: transient.label, exact: true }).click();
      const surface = page.locator(`#${transient.id}`);
      await expect(surface).toBeVisible();
      await expectGuideClearanceFromTransientSurface(page, `#${transient.id}`, scenario.gap);
      if (transient.id === 'canvas-toolbar-save-popover') {
        await surface.getByRole('button', { name: /Save current canvas/ }).click();
      } else {
        await surface.locator(transient.action).click();
        await page.keyboard.press('Escape');
      }
      await expect(surface).toBeHidden();
    }
  });
}

for (const viewport of [
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
]) {
  test(`Studio tablet ${viewport.width}x${viewport.height} uses accessible side drawers`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openFreshEditorWorkspace(page);
    await switchEditorFocus(page, 'Viewer');

    const mediaToggle = page.getByRole('button', { name: 'Project media', exact: true });
    const inspectorToggle = page.getByRole('button', { name: 'Clip inspector', exact: true });
    await expect(mediaToggle).toBeVisible();
    await expect(inspectorToggle).toBeVisible();
    await expect(mediaToggle).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('#studio-project-media-panel')).toBeHidden();
    await expect(page.getByTestId('editor-video-viewer')).toBeVisible();

    await mediaToggle.click();
    const mediaPanel = page.locator('#studio-project-media-panel');
    const closeMediaPanel = mediaPanel.getByRole('button', { name: 'Close dialog: Project media' });
    await expect(mediaPanel).toBeVisible();
    await expect(mediaPanel).not.toHaveAttribute('aria-modal', 'true');
    await expect(closeMediaPanel).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect.poll(() => mediaPanel.evaluate((panel) => panel.contains(document.activeElement))).toBe(false);
    await closeMediaPanel.focus();
    await page.keyboard.press('Escape');
    await expect(mediaPanel).toBeHidden();
    await expect(mediaToggle).toBeFocused();
  });
}

for (const viewport of [
  { width: 390, height: 844 },
  { width: 360, height: 800 },
]) {
  test(`Studio mobile ${viewport.width}x${viewport.height} keeps one primary surface and a scrollable timeline`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openFreshEditorWorkspace(page);
    await switchEditorFocus(page, 'Viewer');

    const mediaToggle = page.getByRole('button', { name: 'Project media', exact: true });
    const inspectorToggle = page.getByRole('button', { name: 'Clip inspector', exact: true });
    await expect(mediaToggle).toBeVisible();
    await expect(inspectorToggle).toBeVisible();
    await expect(page.getByTestId('editor-video-viewer')).toBeVisible();
    await expect(page.locator('#studio-project-media-panel')).toBeHidden();
    await expect(page.locator('#studio-inspector-panel')).toBeHidden();
    await expectHorizontalTimeline(page);

    await inspectorToggle.click();
    const inspectorPanel = page.locator('#studio-inspector-panel');
    await expect(inspectorPanel).toBeVisible();
    await expect(page.locator('#studio-project-media-panel')).toBeHidden();
    await expect(inspectorPanel.getByRole('button', { name: 'Close dialog: Clip inspector' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(inspectorPanel).toBeHidden();
    await expect(inspectorToggle).toBeFocused();
  });
}

for (const scenario of [
  { theme: 'light' as const, viewport: { width: 1440, height: 1024 } },
  { theme: 'dark' as const, viewport: { width: 390, height: 844 } },
]) {
  test(`Studio ${scenario.theme} theme stays readable at ${scenario.viewport.width}x${scenario.viewport.height}`, async ({ page }, testInfo) => {
    await page.addInitScript((theme) => {
      window.localStorage.setItem('maxvideoai.studio.theme.v1', theme);
      window.localStorage.setItem('maxvideoai.studio.theme.userOverride.v1', 'true');
    }, scenario.theme);
    await page.setViewportSize(scenario.viewport);
    await openFreshEditorWorkspace(page);
    await expectThemeTokenContrast(page, scenario.theme);
    await expect(page.getByRole('button', { name: 'Canvas', exact: true })).toBeVisible();
    await expect(page.getByLabel('Video timeline')).toBeVisible();
    if (scenario.viewport.width < 600) {
      await switchEditorFocus(page, 'Viewer');
      await expect(page.getByRole('button', { name: 'Project media', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Clip inspector', exact: true })).toBeVisible();
    }
    await mkdir(screenshotDirectory, { recursive: true });
    const screenshotPath = join(
      screenshotDirectory,
      `${scenario.theme}-${scenario.viewport.width}x${scenario.viewport.height}.png`
    );
    await page.screenshot({ fullPage: true, path: screenshotPath });
    await testInfo.attach(`task-11-${scenario.theme}-${scenario.viewport.width}x${scenario.viewport.height}`, {
      path: screenshotPath,
      contentType: 'image/png',
    });
  });
}
