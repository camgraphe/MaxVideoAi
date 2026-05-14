import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const ROOT = process.cwd();
const OUT_ROOT = path.join(ROOT, 'frontend/public/assets/model-examples');
const require = createRequire(path.join(ROOT, 'frontend/package.json'));
const sharp = require('sharp');

const palettes = {
  seedream: ['#eff6ff', '#dbeafe', '#f8fafc', '#0f172a', '#2563eb'],
  'gpt-image-2': ['#f8fafc', '#e0f2fe', '#f5f3ff', '#020617', '#0ea5e9'],
  'nano-banana': ['#fff7ed', '#fde68a', '#dcfce7', '#111827', '#f59e0b'],
  'nano-banana-2': ['#f0fdfa', '#ccfbf1', '#eef2ff', '#0f172a', '#14b8a6'],
  'nano-banana-pro': ['#faf5ff', '#e0e7ff', '#f8fafc', '#020617', '#7c3aed'],
};

const examples = [
  {
    slug: 'seedream',
    files: [
      { tag: 'product', title: 'Clean product reference', label: 'SOURCE STILL', ratio: [4, 3], scene: 'product' },
      { tag: 'character', title: 'Character reference sheet', label: '4 VIEW SHEET', ratio: [4, 3], scene: 'character' },
      { tag: 'edit', title: 'Reference cleanup edit', label: 'KEEP SHAPE', ratio: [1, 1], scene: 'edit' },
      { tag: 'batch', title: 'Storyboard batch', label: '4 IMAGE SET', ratio: [16, 9], scene: 'storyboard' },
    ],
  },
  {
    slug: 'gpt-image-2',
    files: [
      { tag: 'product', title: 'Readable product label', label: 'NOVA TEA', ratio: [4, 3], scene: 'packaging' },
      { tag: 'typography', title: 'Typography poster', label: 'LAUNCH 04', ratio: [3, 4], scene: 'poster' },
      { tag: 'ui', title: 'UI mockup still', label: 'IMAGE OPS', ratio: [16, 9], scene: 'ui' },
      { tag: 'edit', title: 'Controlled image edit', label: 'KEEP / CHANGE', ratio: [1, 1], scene: 'edit' },
      { tag: 'mask', title: 'Mask-guided retouch', label: 'MASK ZONE', ratio: [4, 3], scene: 'mask' },
      { tag: 'final', title: '4K campaign still', label: 'FINAL MASTER', ratio: [16, 9], scene: 'hero' },
    ],
  },
  {
    slug: 'nano-banana',
    files: [
      { tag: 'campaign', title: 'Fast thumbnail concept', label: 'DRAFT A', ratio: [16, 9], scene: 'thumbnail' },
      { tag: 'typography', title: 'Simple promo still', label: 'SALE 24H', ratio: [1, 1], scene: 'poster' },
      { tag: 'reference', title: 'Reference remix', label: 'REMIX', ratio: [4, 3], scene: 'remix' },
      { tag: 'final', title: 'Batch concept grid', label: '4 VARIANTS', ratio: [16, 9], scene: 'batch' },
    ],
  },
  {
    slug: 'nano-banana-2',
    files: [
      { tag: 'grounded', title: 'Grounded product scene', label: 'CONTEXT LOCK', ratio: [4, 3], scene: 'grounded' },
      { tag: 'edit', title: 'Controlled product edit', label: 'KEEP PRODUCT', ratio: [1, 1], scene: 'edit' },
      { tag: 'reference', title: 'Multi-reference edit', label: '3 REF ROLES', ratio: [4, 3], scene: 'references' },
      { tag: 'wide', title: 'Ultra-wide 4K still', label: '21:9 MASTER', ratio: [21, 9], scene: 'wide' },
    ],
  },
  {
    slug: 'nano-banana-pro',
    files: [
      { tag: 'campaign', title: '2K campaign layout', label: 'CAMPAIGN 2K', ratio: [4, 3], scene: 'campaign' },
      { tag: 'typography', title: 'Premium typography poster', label: 'CLEAR TYPE', ratio: [3, 4], scene: 'poster' },
      { tag: 'reference', title: 'Reference-guided product edit', label: 'BRAND MATCH', ratio: [4, 3], scene: 'reference' },
      { tag: 'final', title: '4K final still', label: '4K FINAL', ratio: [16, 9], scene: 'final' },
    ],
  },
];

function sizeFromRatio([w, h]) {
  if (w / h > 1.8) return [1800, Math.round((1800 * h) / w)];
  if (h > w) return [1080, Math.round((1080 * h) / w)];
  return [1400, Math.round((1400 * h) / w)];
}

function esc(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function sceneMarkup(scene, width, height, colors, title, label) {
  const [bgA, bgB, bgC, ink, accent] = colors;
  const cx = width / 2;
  const cy = height / 2;
  const card = (x, y, w, h, r = 32, fill = '#ffffffcc') =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="#94a3b833" stroke-width="2"/>`;
  const text = (value, x, y, size, weight = 700, fill = ink, anchor = 'start') =>
    `<text x="${x}" y="${y}" font-family="Inter, Arial, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${esc(value)}</text>`;
  const pill = (value, x, y) =>
    `<rect x="${x}" y="${y - 24}" width="${Math.max(120, value.length * 11)}" height="36" rx="18" fill="${accent}22" stroke="${accent}66"/><text x="${x + 18}" y="${y}" font-family="Inter, Arial, sans-serif" font-size="15" font-weight="800" fill="${accent}">${esc(value)}</text>`;

  const base =
    `<defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${bgA}"/>
        <stop offset="58%" stop-color="${bgB}"/>
        <stop offset="100%" stop-color="${bgC}"/>
      </linearGradient>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="28" stdDeviation="30" flood-color="#0f172a" flood-opacity=".18"/>
      </filter>
    </defs>
    <rect width="100%" height="100%" fill="url(#bg)"/>
    <circle cx="${width * 0.14}" cy="${height * 0.2}" r="${Math.min(width, height) * 0.22}" fill="#ffffff80"/>
    <circle cx="${width * 0.88}" cy="${height * 0.18}" r="${Math.min(width, height) * 0.16}" fill="${accent}18"/>`;

  if (scene === 'product' || scene === 'packaging' || scene === 'campaign' || scene === 'final' || scene === 'hero') {
    return `${base}
      <g filter="url(#shadow)">
        ${card(width * 0.09, height * 0.13, width * 0.82, height * 0.74, 40)}
        <ellipse cx="${cx}" cy="${height * 0.72}" rx="${width * 0.22}" ry="${height * 0.055}" fill="#0f172a18"/>
        <rect x="${cx - width * 0.095}" y="${height * 0.28}" width="${width * 0.19}" height="${height * 0.34}" rx="36" fill="#f8fafc" stroke="${accent}" stroke-width="5"/>
        <rect x="${cx - width * 0.071}" y="${height * 0.38}" width="${width * 0.142}" height="${height * 0.11}" rx="18" fill="${accent}18"/>
        ${text(label, cx, height * 0.445, Math.max(22, width * 0.026), 900, ink, 'middle')}
        <circle cx="${cx}" cy="${height * 0.25}" r="${Math.min(width, height) * 0.035}" fill="${accent}"/>
        <path d="M ${width * 0.18} ${height * 0.68} C ${width * 0.35} ${height * 0.54}, ${width * 0.63} ${height * 0.82}, ${width * 0.82} ${height * 0.58}" fill="none" stroke="${accent}" stroke-width="8" stroke-linecap="round" opacity=".75"/>
      </g>
      ${pill(title, width * 0.12, height * 0.18)}`;
  }

  if (scene === 'character') {
    const x0 = width * 0.14;
    const gap = width * 0.035;
    const sw = (width * 0.72 - gap * 3) / 4;
    const cards = [0, 1, 2, 3].map((i) => {
      const x = x0 + i * (sw + gap);
      return `<g filter="url(#shadow)">
        ${card(x, height * 0.25, sw, height * 0.48, 28)}
        <circle cx="${x + sw / 2}" cy="${height * 0.38}" r="${sw * 0.16}" fill="${accent}${i % 2 ? '33' : '22'}"/>
        <rect x="${x + sw * 0.29}" y="${height * 0.47}" width="${sw * 0.42}" height="${height * 0.16}" rx="28" fill="${ink}" opacity=".9"/>
        ${text(['FRONT', 'SIDE', 'BACK', 'MOOD'][i], x + sw / 2, height * 0.68, 14, 800, '#64748b', 'middle')}
      </g>`;
    }).join('');
    return `${base}${cards}${pill(label, width * 0.14, height * 0.17)}${text(title, width * 0.14, height * 0.82, 34, 900)}`;
  }

  if (scene === 'ui') {
    return `${base}
      <g filter="url(#shadow)">
        ${card(width * 0.1, height * 0.14, width * 0.8, height * 0.72, 36)}
        <rect x="${width * 0.14}" y="${height * 0.2}" width="${width * 0.72}" height="${height * 0.08}" rx="20" fill="#0f172a"/>
        ${text(label, width * 0.17, height * 0.253, 24, 900, '#fff')}
        ${[0, 1, 2].map((i) => card(width * (0.14 + i * 0.245), height * 0.34, width * 0.205, height * 0.23, 24, i === 1 ? `${accent}18` : '#f8fafc')).join('')}
        <path d="M ${width * 0.17} ${height * 0.66} L ${width * 0.31} ${height * 0.56} L ${width * 0.47} ${height * 0.62} L ${width * 0.67} ${height * 0.46} L ${width * 0.82} ${height * 0.52}" fill="none" stroke="${accent}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
      </g>`;
  }

  if (scene === 'storyboard' || scene === 'batch') {
    const cells = [0, 1, 2, 3].map((i) => {
      const x = width * (0.1 + (i % 2) * 0.42);
      const y = height * (0.18 + Math.floor(i / 2) * 0.34);
      return `<g filter="url(#shadow)">
        ${card(x, y, width * 0.35, height * 0.25, 26)}
        <rect x="${x + 24}" y="${y + 24}" width="${width * 0.11}" height="${height * 0.08}" rx="16" fill="${accent}${i % 2 ? '33' : '22'}"/>
        <circle cx="${x + width * 0.27}" cy="${y + height * 0.08}" r="28" fill="${ink}" opacity=".12"/>
        ${text(`0${i + 1}`, x + 24, y + height * 0.205, 30, 900, accent)}
      </g>`;
    }).join('');
    return `${base}${cells}${pill(label, width * 0.1, height * 0.12)}${text(title, width * 0.53, height * 0.87, 32, 900, ink, 'middle')}`;
  }

  if (scene === 'poster') {
    return `${base}
      <g filter="url(#shadow)">
        ${card(width * 0.18, height * 0.09, width * 0.64, height * 0.82, 24)}
        ${text(label, cx, height * 0.36, Math.max(44, width * 0.065), 950, ink, 'middle')}
        <rect x="${width * 0.29}" y="${height * 0.45}" width="${width * 0.42}" height="5" rx="3" fill="${accent}"/>
        ${text(title, cx, height * 0.55, 28, 800, '#475569', 'middle')}
        <circle cx="${cx}" cy="${height * 0.7}" r="${Math.min(width, height) * 0.075}" fill="${accent}22" stroke="${accent}" stroke-width="4"/>
      </g>`;
  }

  if (scene === 'wide' || scene === 'thumbnail' || scene === 'grounded') {
    return `${base}
      <g filter="url(#shadow)">
        ${card(width * 0.07, height * 0.16, width * 0.86, height * 0.68, 44)}
        <path d="M ${width * 0.09} ${height * 0.68} C ${width * 0.25} ${height * 0.52}, ${width * 0.42} ${height * 0.7}, ${width * 0.55} ${height * 0.52} S ${width * 0.78} ${height * 0.5}, ${width * 0.92} ${height * 0.66} L ${width * 0.92} ${height * 0.84} L ${width * 0.09} ${height * 0.84} Z" fill="${accent}24"/>
        <circle cx="${width * 0.74}" cy="${height * 0.33}" r="${Math.min(width, height) * 0.095}" fill="#fff" opacity=".9"/>
        ${text(label, width * 0.12, height * 0.32, Math.max(34, width * 0.045), 950)}
        ${text(title, width * 0.12, height * 0.42, 24, 750, '#475569')}
      </g>`;
  }

  return `${base}
    <g filter="url(#shadow)">
      ${card(width * 0.12, height * 0.14, width * 0.76, height * 0.72, 40)}
      <rect x="${width * 0.2}" y="${height * 0.25}" width="${width * 0.26}" height="${height * 0.35}" rx="34" fill="${accent}22" stroke="${accent}" stroke-width="4"/>
      <rect x="${width * 0.54}" y="${height * 0.29}" width="${width * 0.28}" height="${height * 0.28}" rx="34" fill="#f8fafc" stroke="#94a3b8" stroke-width="3"/>
      <path d="M ${width * 0.46} ${height * 0.42} C ${width * 0.52} ${height * 0.31}, ${width * 0.58} ${height * 0.6}, ${width * 0.66} ${height * 0.47}" fill="none" stroke="${accent}" stroke-width="8" stroke-linecap="round"/>
      ${pill(label, width * 0.2, height * 0.72)}
      ${text(title, width * 0.2, height * 0.82, 32, 900)}
    </g>`;
}

async function renderExample(slug, item) {
  const [width, height] = sizeFromRatio(item.ratio);
  const colors = palettes[slug];
  const body = sceneMarkup(item.scene, width, height, colors, item.title, item.label);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`;
  const outDir = path.join(OUT_ROOT, slug);
  await fs.mkdir(outDir, { recursive: true });
  await sharp(Buffer.from(svg)).webp({ quality: 86, effort: 5 }).toFile(path.join(outDir, `${item.tag}.webp`));
}

for (const group of examples) {
  for (const item of group.files) {
    await renderExample(group.slug, item);
  }
}

console.log(`Generated image model examples in ${path.relative(ROOT, OUT_ROOT)}`);
