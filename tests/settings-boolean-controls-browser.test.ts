import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium, expect, type Locator } from '@playwright/test';
import { getBaseEngines } from '../frontend/src/lib/engines';
import { startWorkspaceReferenceFixture } from './helpers/workspace-reference-browser-fixture';

const source = `
  import { useState } from 'react';
  import { createRoot } from 'react-dom/client';
  import { I18nProvider } from './lib/i18n/I18nProvider';
  import { SettingsControls } from './components/SettingsControls';
  import { SettingsGenericAdvancedFields } from './components/settings-controls/settings-control-generic-fields';
  import { SettingsSeedanceAdvancedControls } from './components/settings-controls/settings-control-engine-advanced';
  import { Button } from './components/ui/Button';
  const noop = () => {};
  const field = { id: 'auto_enhance', type: 'boolean', label: 'Auto enhance', default: true };
  function Fixture() {
    const [values, setValues] = useState({ auto_enhance: true, camera: false, safety: true, loop: false, genericSafety: true });
    const update = (key, value) => setValues(previous => ({ ...previous, [key]: value }));
    return <I18nProvider locale="en" dictionary={{}} fallback={{}}>
      <main style={{ padding: 20 }}>
        <div data-fixture="generic"><SettingsGenericAdvancedFields fields={[{ field, required: false }]}
          values={values} onChange={(field,value)=>update(field.id,value)} /></div>
        <div data-fixture="seedance"><SettingsSeedanceAdvancedControls layout="compact" cameraFixed={values.camera}
          safetyChecker={values.safety} seedValue="" onCameraFixedChange={value=>update('camera',value)}
          onSafetyCheckerChange={value=>update('safety',value)} /></div>
        <div data-fixture="panel"><SettingsControls engine={globalThis.fixtureConfig.engine} mode="t2v" variant="advanced" advancedOpen
          durationSec={5} onDurationChange={noop} resolution="720p" onResolutionChange={noop}
          aspectRatio="16:9" onAspectRatioChange={noop} fps={24} onFpsChange={noop} showExtendControl={false}
          showLoopControl loopEnabled={values.loop} onLoopChange={value=>update('loop',value)}
          showSafetyCheckerControl safetyChecker={values.genericSafety} onSafetyCheckerChange={value=>update('genericSafety',value)} /></div>
        <Button variant="outline">Unrelated action</Button><output data-values hidden>{JSON.stringify(values)}</output>
      </main>
    </I18nProvider>;
  }
  createRoot(document.getElementById('root')).render(<Fixture />);
`;

async function appearance(button: Locator) {
  return button.evaluate(node => {
    const style = getComputedStyle(node);
    return { background: style.backgroundColor, color: style.color, border: style.borderColor };
  });
}

function contrast(foreground: string, background: string): number {
  const luminance = (color: string) => {
    const channels = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(value => {
      const channel = value / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const light = luminance(foreground), dark = luminance(background);
  return (Math.max(light, dark) + 0.05) / (Math.min(light, dark) + 0.05);
}

test('advanced boolean choices expose the selected value visibly and accessibly in light and dark themes', { timeout: 120_000 }, async () => {
  const fixture = await startWorkspaceReferenceFixture({ source });
  const browser = await chromium.launch({ headless: true });
  const evidence = process.env.SETTINGS_BOOLEAN_EVIDENCE_DIR;
  if (evidence) await mkdir(evidence, { recursive: true });
  try {
    for (const theme of ['light', 'dark']) for (const width of [390, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(fixture.url);
      await page.evaluate(({ theme, engine }) => {
        document.documentElement.dataset.theme = theme;
        (globalThis as any).fixtureConfig = { engine };
      }, { theme, engine: getBaseEngines().find(engine => engine.id === 'wan-3')! });
      await page.addScriptTag({ url: `${fixture.url}/${fixture.script}` });
      const generic = page.locator('[data-fixture="generic"]');
      const initialOn = generic.locator('button').nth(0);
      const initialOff = generic.locator('button').nth(1);
      try { await expect(initialOn).toBeVisible(); }
      catch (error) { throw new Error(`Settings fixture failed: ${errors.join('; ')}; ${error}`); }
      assert.notEqual((await appearance(initialOn)).background, (await appearance(initialOff)).background,
        `${theme}/${width}: the active background must differ from the inactive option`);
      const unrelated = page.getByRole('button', { name: 'Unrelated action' });
      const unrelatedBefore = await appearance(unrelated);
      if (evidence) await page.screenshot({ path: join(evidence, `${theme}-${width}.png`), fullPage: true });
      for (const [scope, label, key, initial] of [
        ['generic', 'Auto enhance', 'auto_enhance', true], ['seedance', 'Camera fixed', 'camera', false],
        ['seedance', 'Safety checker', 'safety', true], ['panel', 'Loop', 'loop', false],
        ['panel', 'Safety checker', 'genericSafety', true],
      ] as const) {
        const group = page.locator(`[data-fixture="${scope}"]`).getByRole('group', { name: label, exact: true });
        const on = group.getByRole('button', { name: 'On', exact: true });
        const off = group.getByRole('button', { name: 'Off', exact: true });
        const selected = initial ? on : off, other = initial ? off : on;
        await expect(selected).toHaveAttribute('aria-pressed', 'true');
        await expect(other).toHaveAttribute('aria-pressed', 'false');
        const activeStyle = await appearance(selected);
        assert.notEqual(activeStyle.background, (await appearance(other)).background);
        assert.ok(contrast(activeStyle.color, activeStyle.background) >= 4.5, `${theme}/${width}/${label}: selected text contrast`);
        await expect(selected.locator('svg[aria-hidden="true"]')).toBeVisible();
        await other.click();
        await expect(other).toHaveAttribute('aria-pressed', 'true');
        await expect(selected).toHaveAttribute('aria-pressed', 'false');
        assert.equal(JSON.parse((await page.locator('[data-values]').textContent())!)[key], !initial);
        await selected.focus();
        await page.keyboard.press('Space');
        await expect(selected).toHaveAttribute('aria-pressed', 'true');
        assert.equal(JSON.parse((await page.locator('[data-values]').textContent())!)[key], initial);
        await on.focus();
        await page.keyboard.press('Tab');
        await expect(off).toBeFocused();
        await page.keyboard.press('Enter');
        await expect(off).toHaveAttribute('aria-pressed', 'true');
        await expect(on).toHaveAttribute('aria-pressed', 'false');
        assert.equal(JSON.parse((await page.locator('[data-values]').textContent())!)[key], false);
      }
      assert.deepEqual(await appearance(unrelated), unrelatedBefore, 'unrelated outline buttons keep their existing presentation');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); await fixture.close(); }
});
