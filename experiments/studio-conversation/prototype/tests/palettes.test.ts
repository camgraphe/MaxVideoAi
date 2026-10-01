import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const css = await readFile(
  new URL("../client/styles/palettes.css", import.meta.url),
  "utf8",
);
const blocks = [
  ...css.matchAll(/:root(?:\[data-palette="([^"]+)"\])?\s*\{([^}]+)\}/g),
];
const values = (body: string) =>
  Object.fromEntries(
    [...body.matchAll(/(--[\w-]+):\s*(#[\da-f]{6});/g)].map((m) => [
      m[1],
      m[2],
    ]),
  );
const luminance = (hex: string) => {
  const channels = [1, 3, 5].map((offset) => {
    const v = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
};
const contrast = (a: string, b: string) => {
  const [low, high] = [luminance(a), luminance(b)].sort((a, b) => a - b);
  return (high + 0.05) / (low + 0.05);
};
const base = values(blocks[0][2]);
for (const block of blocks) {
  const name = block[1] ?? "charcoal";
  test(`${name} palette keeps small interface text and primary actions readable`, () => {
    const colors = { ...base, ...values(block[2]) };
    const pairs = [
      ...["--text", "--soft", "--muted", "--dim", "--accent"].flatMap((ink) =>
        ["--bg", "--surface", "--panel", "--glow"].map((bg) => [ink, bg]),
      ),
      ["--accent-ink", "--accent"],
      ["--text", "--voice-bg"],
      ["--text", "--music-bg"],
    ];
    for (const [ink, background] of pairs) {
      const ratio = contrast(colors[ink], colors[background]);
      assert.ok(
        ratio >= 4.5,
        `${name}: ${ink} on ${background} is ${ratio.toFixed(2)}:1; small text needs 4.5:1`,
      );
    }
  });
}
