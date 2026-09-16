import { mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '..');
const requireFromFrontend = createRequire(path.join(repositoryRoot, 'frontend', 'package.json'));
const sharp = requireFromFrontend('sharp');
const typographyFont = requireFromFrontend.resolve('next/dist/compiled/@vercel/og/noto-sans-v27-latin-regular.ttf');
const pluginVersion = readFileSync(path.join(repositoryRoot, 'plugins/maxvideoai/VERSION'), 'utf8').trim();
if (!/^\d+\.\d+\.\d+$/.test(pluginVersion)) throw new Error('MaxVideoAI VERSION must use semantic versioning');

const paths = {
  editorial: path.join(repositoryRoot, 'plugins/maxvideoai/assets/sources/maxvideoai-editorial-branch-converge-source.png'),
  logo: path.join(repositoryRoot, 'plugins/maxvideoai/assets/logo-mark.svg'),
  workspace: path.join(repositoryRoot, 'plugins/maxvideoai/assets/screenshots/maxvideoai-workspace-production.jpg'),
  library: path.join(repositoryRoot, 'plugins/maxvideoai/assets/screenshots/maxvideoai-library-continuity-production.jpg'),
  demos: path.join(repositoryRoot, 'plugins/maxvideoai/assets/demos'),
  social: path.join(repositoryRoot, 'plugins/maxvideoai/assets/social'),
};

const colors = {
  black: '#050B14',
  cobalt: '#2E63D8',
  ink: '#111827',
  muted: '#536179',
  paper: '#F6F8FC',
  white: '#FFFFFF',
};

const HEADLINE = 'AI production\nfor assistants & automations';
const SETUP_GUIDES = 'Claude · ChatGPT · Codex · OpenClaw · n8n';
const RHYTHM = 'Plan. Compare. Price. Approve. Create.';

function solid(width, height, color) {
  return sharp({ create: { width, height, channels: 4, background: color } }).png().toBuffer();
}

async function fittedImage(input, width, height) {
  const source = await sharp(input).metadata();
  if (!source.width || !source.height) throw new Error(`Unable to measure ${input}`);
  const buffer = await sharp(input)
    .resize({ width, height, fit: 'inside', withoutEnlargement: true })
    .png()
    .toBuffer();
  const measured = await sharp(buffer).metadata();
  return { buffer, width: measured.width, height: measured.height };
}

async function croppedImage(input, region) {
  const source = await sharp(input).metadata();
  if (!source.width || !source.height) throw new Error(`Unable to measure ${input}`);
  if (region.left + region.width > source.width || region.top + region.height > source.height) {
    throw new Error(`Crop exceeds source bounds for ${input}`);
  }
  return {
    buffer: await sharp(input).extract(region).png().toBuffer(),
    width: region.width,
    height: region.height,
  };
}

async function editorialLayer(width, height) {
  const fitted = await fittedImage(paths.editorial, width, height);
  return {
    input: fitted.buffer,
    left: Math.floor((width - fitted.width) / 2),
    top: Math.floor((height - fitted.height) / 2),
  };
}

async function shadow(width, height, opacity = 0.2) {
  const padding = 28;
  const input = await sharp({
    create: {
      width: width + padding * 2,
      height: height + padding * 2,
      channels: 4,
      background: { r: 5, g: 11, b: 20, alpha: 0 },
    },
  })
    .composite([{
      input: await solid(width, height, { r: 5, g: 11, b: 20, alpha: opacity }),
      left: padding,
      top: padding,
    }])
    .blur(18)
    .png()
    .toBuffer();
  return { input, padding };
}

async function addProof(layers, proof, left, top, { border = colors.white, shadowOpacity = 0.2 } = {}) {
  const drop = await shadow(proof.width, proof.height, shadowOpacity);
  layers.push({ input: drop.input, left: left - drop.padding, top: top - drop.padding + 10 });
  layers.push({ input: await solid(proof.width + 2, proof.height + 2, border), left: left - 1, top: top - 1 });
  layers.push({ input: proof.buffer, left, top });
}

function escapeMarkup(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

async function textLayer(text, { width, height, size, color, weight = 400, align = 'left' }) {
  return sharp({
    text: {
      text: `<span foreground="${color}" font_size="${size}pt" font_weight="${weight}">${escapeMarkup(text)}</span>`,
      font: 'Noto Sans',
      fontfile: typographyFont,
      width,
      height,
      align,
      rgba: true,
    },
  }).png().toBuffer();
}

async function logoLayer(size) {
  return sharp(paths.logo).resize({ width: size, height: size, fit: 'contain' }).png().toBuffer();
}

async function base(width, height, theme, requestedOpacity) {
  const background = theme === 'dark' ? colors.black : colors.paper;
  const editorialOpacity = requestedOpacity ?? (theme === 'dark' ? 0.46 : 0.3);
  const wash = theme === 'dark'
    ? { r: 5, g: 11, b: 20, alpha: 1 - editorialOpacity }
    : { r: 246, g: 248, b: 252, alpha: 1 - editorialOpacity };
  const rendered = await sharp({ create: { width, height, channels: 4, background } })
    .composite([
      await editorialLayer(width, height),
      { input: await solid(width, height, wash), left: 0, top: 0 },
    ])
    .png()
    .toBuffer();
  return sharp(rendered);
}

async function writeOutput(canvas, outputPath, format) {
  mkdirSync(path.dirname(outputPath), { recursive: true });
  const pipeline = canvas.flatten({ background: colors.paper });
  if (format === 'webp') {
    await pipeline.webp({ quality: 90, effort: 6, smartSubsample: true }).toFile(outputPath);
    return;
  }
  await pipeline.png({ compressionLevel: 9, adaptiveFiltering: true, palette: true, quality: 92 }).toFile(outputPath);
}

async function readmeProofHero() {
  const width = 1600;
  const height = 900;
  const canvas = await base(width, height, 'light', 0.34);
  const layers = [
    { input: await solid(520, 8, colors.cobalt), left: 72, top: 92 },
    { input: await logoLayer(54), left: 72, top: 126 },
  ];
  const workspace = await fittedImage(paths.workspace, 1200, 435);
  const library = await fittedImage(paths.library, 700, 413);
  await addProof(layers, workspace, 120, 190, { border: '#DDE5F0', shadowOpacity: 0.22 });
  await addProof(layers, library, 820, 430, { border: '#DDE5F0', shadowOpacity: 0.28 });
  await writeOutput(canvas.composite(layers), path.join(paths.demos, 'readme-proof-hero.webp'), 'webp');
}

async function briefToVideoWorkflow() {
  const width = 1600;
  const height = 900;
  const canvas = await base(width, height, 'light', 0.34);
  const layers = [{ input: await solid(440, 8, colors.cobalt), left: 86, top: 84 }];
  const workspace = await fittedImage(paths.workspace, 1080, 391);
  const library = await fittedImage(paths.library, 700, 413);
  await addProof(layers, workspace, 70, 140, { border: '#DDE5F0', shadowOpacity: 0.24 });
  await addProof(layers, library, 820, 400, { border: '#DDE5F0', shadowOpacity: 0.3 });
  await writeOutput(canvas.composite(layers), path.join(paths.demos, 'brief-to-video-workflow.webp'), 'webp');
}

async function modelChoiceAndBudget() {
  const width = 480;
  const height = 640;
  const canvas = await base(width, height, 'light', 0.32);
  const layers = [{ input: await solid(380, 5, colors.cobalt), left: 50, top: 28 }];
  const workspace = await fittedImage(paths.workspace, 420, 152);
  const library = await fittedImage(paths.library, 420, 247);
  await addProof(layers, workspace, 30, 70, { border: '#DDE5F0', shadowOpacity: 0.2 });
  await addProof(layers, library, 30, 300, { border: '#DDE5F0', shadowOpacity: 0.24 });
  await writeOutput(canvas.composite(layers), path.join(paths.demos, 'model-choice-and-budget.webp'), 'webp');
}

async function libraryContinuity() {
  const width = 1600;
  const height = 900;
  const canvas = await base(width, height, 'light', 0.34);
  const layers = [{ input: await solid(620, 8, colors.cobalt), left: 900, top: 792 }];
  const library = await fittedImage(paths.library, 1010, 595);
  const workspace = await fittedImage(paths.workspace, 790, 286);
  await addProof(layers, library, 510, 120, { border: '#DDE5F0', shadowOpacity: 0.22 });
  await addProof(layers, workspace, 92, 474, { border: '#DDE5F0', shadowOpacity: 0.18 });
  await writeOutput(canvas.composite(layers), path.join(paths.demos, 'library-continuity.webp'), 'webp');
}

async function githubSocialPreview() {
  const width = 1280;
  const height = 640;
  const canvas = await base(width, height, 'light', 0.32);
  const layers = [
    { input: await solid(500, 552, { r: 246, g: 248, b: 252, alpha: 0.82 }), left: 48, top: 44 },
    { input: await solid(8, 512, colors.cobalt), left: 40, top: 64 },
    { input: await logoLayer(52), left: 72, top: 62 },
    { input: await textLayer(HEADLINE, { width: 450, height: 190, size: 39, color: colors.ink, weight: 700 }), left: 72, top: 152 },
    { input: await textLayer(SETUP_GUIDES, { width: 450, height: 50, size: 16, color: colors.muted, weight: 700 }), left: 72, top: 382 },
    { input: await textLayer(RHYTHM, { width: 450, height: 55, size: 16, color: colors.muted, weight: 400 }), left: 72, top: 480 },
  ];
  const workspace = await fittedImage(paths.workspace, 620, 225);
  const library = await fittedImage(paths.library, 520, 306);
  await addProof(layers, workspace, 610, 72, { border: '#DDE5F0', shadowOpacity: 0.2 });
  await addProof(layers, library, 710, 292, { border: '#DDE5F0', shadowOpacity: 0.24 });
  await writeOutput(canvas.composite(layers), path.join(paths.social, 'github-social-preview.png'), 'png');
}

async function releaseCard() {
  const width = 1200;
  const height = 630;
  const canvas = await base(width, height, 'light', 0.34);
  const layers = [
    { input: await solid(460, 530, { r: 246, g: 248, b: 252, alpha: 0.88 }), left: 34, top: 44 },
    { input: await solid(8, 500, colors.cobalt), left: 34, top: 58 },
    { input: await logoLayer(52), left: 58, top: 54 },
    { input: await textLayer(`RELEASE ${pluginVersion}`, { width: 330, height: 45, size: 18, color: colors.ink, weight: 700 }), left: 132, top: 64 },
    { input: await textLayer(HEADLINE, { width: 420, height: 190, size: 34, color: colors.ink, weight: 700 }), left: 58, top: 164 },
    { input: await textLayer(SETUP_GUIDES, { width: 420, height: 70, size: 15, color: colors.muted, weight: 700 }), left: 58, top: 386 },
    { input: await textLayer(RHYTHM, { width: 420, height: 55, size: 15, color: colors.muted, weight: 400 }), left: 58, top: 490 },
  ];
  const workspace = await fittedImage(paths.workspace, 610, 221);
  const library = await fittedImage(paths.library, 500, 295);
  await addProof(layers, workspace, 530, 74, { border: '#DDE5F0', shadowOpacity: 0.22 });
  await addProof(layers, library, 640, 286, { border: '#DDE5F0', shadowOpacity: 0.26 });
  await writeOutput(canvas.composite(layers), path.join(paths.social, `release-${pluginVersion}.png`), 'png');
}

async function directoryThumbnail() {
  const width = 1200;
  const height = 675;
  const canvas = await base(width, height, 'light', 0.32);
  const layers = [
    { input: await solid(430, 587, { r: 246, g: 248, b: 252, alpha: 0.82 }), left: 50, top: 44 },
    { input: await solid(8, 547, colors.cobalt), left: 42, top: 64 },
    { input: await logoLayer(52), left: 70, top: 63 },
    { input: await textLayer(HEADLINE, { width: 390, height: 195, size: 35, color: colors.ink, weight: 700 }), left: 70, top: 174 },
    { input: await textLayer(SETUP_GUIDES, { width: 390, height: 50, size: 15, color: colors.muted, weight: 700 }), left: 70, top: 408 },
    { input: await textLayer(RHYTHM, { width: 390, height: 55, size: 15, color: colors.muted, weight: 400 }), left: 70, top: 520 },
  ];
  const library = await fittedImage(paths.library, 650, 383);
  const workspace = await fittedImage(paths.workspace, 650, 235);
  await addProof(layers, library, 500, 76, { border: '#DDE5F0', shadowOpacity: 0.24 });
  await addProof(layers, workspace, 500, 398, { border: '#DDE5F0', shadowOpacity: 0.2 });
  await writeOutput(canvas.composite(layers), path.join(paths.social, 'directory-thumbnail.png'), 'png');
}

await Promise.all([
  readmeProofHero(),
  briefToVideoWorkflow(),
  modelChoiceAndBudget(),
  libraryContinuity(),
  githubSocialPreview(),
  releaseCard(),
  directoryThumbnail(),
]);

process.stdout.write('Composed 7 proof-led GitHub assets without upscaling source screenshots.\n');
