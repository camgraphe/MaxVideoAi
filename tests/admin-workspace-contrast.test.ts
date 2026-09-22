import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const css = readFileSync('frontend/components/admin-system/shell/admin-workspace.css', 'utf8');

function color(name: string): string {
  const value = css.match(new RegExp(`--${name}: *(#[0-9a-fA-F]{6})`))?.[1];
  assert.ok(value, `missing admin color ${name}`);
  return value;
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255);
  const linear = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

function contrast(first: string, second: string): number {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

test('admin text and status colors meet 4.5:1 against their light surfaces', () => {
  for (const textColor of ['text-primary', 'text-secondary', 'text-muted', 'brand']) {
    for (const surface of ['bg', 'surface-2']) {
      assert.ok(contrast(color(textColor), color(surface)) >= 4.5, `${textColor} on ${surface}`);
    }
  }
  assert.ok(contrast(color('on-brand'), color('brand')) >= 4.5, 'button text');
  for (const status of ['success', 'warning', 'error', 'info']) {
    assert.ok(contrast(color(status), color(`${status}-bg`)) >= 4.5, `${status} notice`);
  }
});
