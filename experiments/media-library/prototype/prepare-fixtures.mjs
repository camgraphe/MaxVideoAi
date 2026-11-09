import {createHash} from 'node:crypto';
import {copyFile, mkdir, readFile, stat, writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// Local public repository media only. This script never downloads or edits a source.
const prototypeRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(prototypeRoot, '../../..');
const sourceRoot = path.join(repositoryRoot, 'frontend/public');
const outputRoot = path.join(prototypeRoot, 'public/fixtures');
const require = createRequire(
  process.env.PROTOTYPE_SHARP_PACKAGE || path.join(repositoryRoot, 'frontend/package.json'),
);
const sharp = require('sharp');
const ffmpeg = process.env.PROTOTYPE_FFMPEG || 'ffmpeg';
const ffprobe = process.env.PROTOTYPE_FFPROBE || 'ffprobe';
const imageSources = [
  ['afterparty', 'Après-fête', 'media/mcp/creations/daylight-afterparty.webp'],
  ['dixie', 'Dixie — portrait', 'assets/tools/character-studio/marketing/dixie-recast.webp'],
  ['disco-motel', 'Motel disco', 'assets/app-starters/disco-motel-0b809fbcec19.webp'],
  ['acid-portrait', 'Portrait acidulé', 'assets/app-starters/acid-portrait-f5440c7f5eb0.webp'],
  ['night-shift', 'Service de nuit', 'assets/app-starters/night-shift-9f91929fe7da.webp'],
  ['vesper', 'Vesper — portrait', 'assets/tools/character-studio/marketing/vesper-recast.webp'],
  ['nano-campaign', 'Campagne Nano', 'assets/model-examples/nano-banana/campaign.webp'],
  ['nano-reference', 'Référence Nano', 'assets/model-examples/nano-banana/reference.webp'],
  ['seedream-character', 'Personnage Seedream', 'assets/model-examples/seedream/character.webp'],
  ['seedream-edit', 'Variation Seedream', 'assets/model-examples/seedream/edit.webp'],
  ['gpt-product', 'Produit GPT', 'assets/model-examples/gpt-image-2/product.webp'],
  ['luma-research', 'Étude Luma', 'assets/model-examples/luma-uni-1/research.webp'],
  ['cartographer', 'Le cartographe', 'assets/model-examples/minimax-h3/reference/cartographer-one.png'],
  ['nano-wide', 'Panorama Nano', 'assets/model-examples/nano-banana-2/wide.webp'],
  ['pika-portrait', 'Portrait Pika', 'hero/pika-22.jpg'],
  ['wan-portrait', 'Portrait Wan', 'hero/wan-25.jpg'],
];
const videoSources = [
  ['main-character', 'Personnage — vidéo', 'media/mcp/creations/main-character-720p.mp4', false],
  ['hat-stays', 'Le chapeau — vidéo', 'media/mcp/creations/the-hat-stays-720p.mp4', false],
  ['portrait-fixture', 'Portrait — fixture vidéo', 'assets/tools/character-studio/marketing/dixie-recast.webp', true],
];
const sourceSnapshots = new Map();
const provenance = [];

function run(command, args) {
  const result = spawnSync(command, args, {encoding: 'utf8', maxBuffer: 4 * 1024 * 1024});
  if (result.error || result.status !== 0) {
    throw new Error(`${command} failed: ${result.error?.message || result.stderr}`);
  }
  return result.stdout;
}

function digest(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function sourceFile(relativePath) {
  const absolutePath = path.resolve(sourceRoot, relativePath);
  if (!absolutePath.startsWith(`${sourceRoot}${path.sep}`)) throw new Error('Invalid public source path');
  const bytes = await readFile(absolutePath);
  sourceSnapshots.set(absolutePath, digest(bytes));
  return absolutePath;
}

function url(relativePath) {
  return `/fixtures/${relativePath}`;
}

async function pictureVersions(sourcePath, slug) {
  const versions = {};
  for (const [role, edge, quality] of [['small', 120, 64], ['thumb', 320, 68], ['preview', 1280, 76]]) {
    const relativePath = role === 'preview' ? `previews/${slug}.webp` : `thumbs/${slug}-${edge}.webp`;
    const outputPath = path.join(outputRoot, relativePath);
    const info = await sharp(sourcePath)
      .rotate()
      .resize(edge, edge, {fit: 'inside', withoutEnlargement: true})
      .webp({quality})
      .toFile(outputPath);
    versions[role] = {url: url(relativePath), width: info.width, height: info.height, bytes: info.size};
  }
  return versions;
}

function probe(absolutePath) {
  return JSON.parse(run(ffprobe, [
    '-v', 'error', '-show_entries',
    'stream=codec_type,codec_name,width,height,duration,r_frame_rate,sample_rate,channels:format=duration,size',
    '-of', 'json', absolutePath,
  ]));
}

function mimeFor(extension) {
  return {'.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg'}[extension];
}

await Promise.all(['originals', 'previews', 'thumbs'].map(dir => mkdir(path.join(outputRoot, dir), {recursive: true})));

const images = [];
for (const [slug, name, relativeSource] of imageSources) {
  const sourcePath = await sourceFile(relativeSource);
  const extension = path.extname(sourcePath).toLowerCase();
  const original = `originals/${slug}${extension}`;
  await copyFile(sourcePath, path.join(outputRoot, original));
  const metadata = await sharp(sourcePath).metadata();
  const swap = [5, 6, 7, 8].includes(metadata.orientation);
  const width = swap ? metadata.height : metadata.width;
  const height = swap ? metadata.width : metadata.height;
  const versions = await pictureVersions(sourcePath, slug);
  const item = {
    name, kind: 'image', width, height, size: (await stat(sourcePath)).size,
    mime: mimeFor(extension), thumbUrl: versions.thumb.url,
    previewUrl: versions.preview.url, originalUrl: url(original),
  };
  images.push(item);
  provenance.push({slug, kind: 'image', repositorySource: relativeSource, sourceSha256: sourceSnapshots.get(sourcePath), originalIsExactSourceCopy: true, original: item.originalUrl, versions});
}

const videos = [];
for (const [slug, name, relativeSource, stillImage] of videoSources) {
  const sourcePath = await sourceFile(relativeSource);
  const original = `originals/${slug}.mp4`;
  const preview = `previews/${slug}.mp4`;
  const originalPath = path.join(outputRoot, original);
  const previewPath = path.join(outputRoot, preview);
  const codecArgs = ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26', '-pix_fmt', 'yuv420p', '-movflags', '+faststart'];
  const inputArgs = stillImage ? ['-loop', '1', '-i', sourcePath] : ['-i', sourcePath];
  run(ffmpeg, [
    '-nostdin', '-hide_banner', '-loglevel', 'error', '-y', ...inputArgs,
    '-t', '5', '-map', '0:v:0', ...(stillImage ? ['-an'] : ['-map', '0:a:0?']),
    '-vf', 'scale=960:960:force_original_aspect_ratio=decrease:force_divisible_by=2,fps=24,setsar=1',
    ...codecArgs, ...(stillImage ? [] : ['-c:a', 'aac', '-b:a', '64k']), originalPath,
  ]);
  run(ffmpeg, [
    '-nostdin', '-hide_banner', '-loglevel', 'error', '-y', '-i', originalPath,
    '-map', '0:v:0', '-map', '0:a:0?',
    '-vf', 'scale=640:640:force_original_aspect_ratio=decrease:force_divisible_by=2,fps=24,setsar=1',
    ...codecArgs, '-c:a', 'aac', '-b:a', '64k', previewPath,
  ]);
  const frameResult = spawnSync(ffmpeg, [
    '-nostdin', '-hide_banner', '-loglevel', 'error', '-ss', '0.25', '-i', originalPath,
    '-frames:v', '1', '-f', 'image2pipe', '-vcodec', 'png', '-',
  ], {maxBuffer: 8 * 1024 * 1024});
  if (frameResult.status !== 0) throw new Error(`Poster extraction failed for ${slug}`);
  const versions = await pictureVersions(frameResult.stdout, slug);
  const facts = probe(originalPath);
  const video = facts.streams.find(stream => stream.codec_type === 'video');
  const item = {
    name, kind: 'video', width: video.width, height: video.height,
    durationSec: Number(facts.format.duration), size: Number(facts.format.size), mime: 'video/mp4',
    thumbUrl: versions.thumb.url, previewUrl: url(preview), originalUrl: url(original),
  };
  videos.push(item);
  provenance.push({slug, kind: 'video', repositorySource: relativeSource, sourceSha256: sourceSnapshots.get(sourcePath), fixtureOriginalIsFiveSecondExcerpt: !stillImage, fixtureOriginalIsStaticPortraitVideo: stillImage, noCrop: true, original: item.originalUrl, originalFacts: facts, previewFacts: probe(previewPath), versions});
}

const ambientSource = await sourceFile('studio/demo-ambient.wav');
await copyFile(ambientSource, path.join(outputRoot, 'originals/ambient.wav'));
run(ffmpeg, [
  '-nostdin', '-hide_banner', '-loglevel', 'error', '-y', '-i', ambientSource,
  '-vn', '-c:a', 'aac', '-b:a', '64k', '-movflags', '+faststart', path.join(outputRoot, 'previews/ambient.m4a'),
]);
const audioFacts = probe(ambientSource);
const audio = {
  name: 'Ambiance — audio', kind: 'audio', width: 0, height: 0,
  durationSec: Number(audioFacts.format.duration), size: Number(audioFacts.format.size), mime: 'audio/wav',
  thumbUrl: url('audio-cover.svg'), previewUrl: url('previews/ambient.m4a'), originalUrl: url('originals/ambient.wav'),
};
await writeFile(path.join(outputRoot, 'audio-cover.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320"><rect width="320" height="320" rx="24" fill="#e9ede7"/><path d="M185 93v120m0-120 47-12v103m-47-66 47-12" fill="none" stroke="#49604c" stroke-width="12" stroke-linecap="round"/><ellipse cx="164" cy="217" rx="24" ry="18" fill="#49604c"/><ellipse cx="211" cy="188" rx="24" ry="18" fill="#49604c"/></svg>\n');
provenance.push({slug: 'ambient', kind: 'audio', repositorySource: 'studio/demo-ambient.wav', sourceSha256: sourceSnapshots.get(ambientSource), originalIsExactSourceCopy: true, original: audio.originalUrl, originalFacts: audioFacts, previewFacts: probe(path.join(outputRoot, 'previews/ambient.m4a')), cover: 'Generic local audio icon; no waveform is fabricated.'});

// First five deliberately exercise landscape, portrait, video, audio, square.
const templates = [images[0], images[1], videos[0], audio, images[2], videos[2], videos[1], ...images.slice(3)];
const fixturesSource = `import type {Collection, MediaItem} from './types';

/** Logical records are synthetic; dimensions, sizes and durations describe local public fixture bytes. */
export const COLLECTIONS: Collection[] = [
  {id: 'collection-campaign', name: 'Campagne'},
  {id: 'collection-portraits', name: 'Portraits'},
  {id: 'collection-references', name: 'Références'},
];

type Template = Omit<MediaItem, 'id' | 'ref' | 'source' | 'createdAt' | 'collectionIds' | 'favorite'>;
const MEDIA_TEMPLATES: Template[] = ${JSON.stringify(templates, null, 2)};

/** 20 physical assets repeat across unique deterministic logical records. */
export function createFixtures(count: number): MediaItem[] {
  const length = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  const start = Date.UTC(2026, 10, 8, 19, 30);
  return Array.from({length}, (_, index) => {
    const template = MEDIA_TEMPLATES[index % MEDIA_TEMPLATES.length];
    const id = 'ma_f17e' + (index + 1).toString(16).padStart(28, '0');
    const collectionIds: string[] = [];
    if (index % 4 === 0) collectionIds.push(COLLECTIONS[0].id);
    if ((template.kind === 'image' && template.height > template.width) || index % 7 === 0) collectionIds.push(COLLECTIONS[1].id);
    if (index % 5 === 0) collectionIds.push(COLLECTIONS[2].id);
    return {
      ...template,
      id,
      ref: {type: 'asset', assetId: id, kind: template.kind},
      name: template.name + ' ' + String(Math.floor(index / MEDIA_TEMPLATES.length) + 1).padStart(3, '0'),
      source: index % 3 === 0 ? 'upload' : 'generated',
      createdAt: new Date(start - index * 60_000).toISOString(),
      collectionIds,
      favorite: index % 11 === 0 || index % 17 === 0,
    };
  });
}
`;
await writeFile(path.join(prototypeRoot, 'src/fixtures.ts'), fixturesSource);

for (const [sourcePath, before] of sourceSnapshots) {
  if (digest(await readFile(sourcePath)) !== before) throw new Error(`Source changed: ${sourcePath}`);
}
await writeFile(path.join(prototypeRoot, 'fixtures-notes.json'), JSON.stringify({
  purpose: 'Disposable local prototype media; no private/customer/external data.',
  generatedAt: new Date().toISOString(),
  generationCommand: 'PROTOTYPE_SHARP_PACKAGE=/path/to/frontend/package.json node prepare-fixtures.mjs',
  sourceRoot: 'frontend/public',
  physicalAssetCount: templates.length,
  imageCount: images.length,
  videoCount: videos.length,
  audioCount: 1,
  firstCases: templates.slice(0, 7).map(item => ({name: item.name, kind: item.kind, width: item.width, height: item.height, durationSec: item.durationSec})),
  thumbnailPolicy: '120/320 pixel maximum edge, fit inside, no cropping, no upscaling; full-oriented frame retained.',
  imagePreviewPolicy: '1280 pixel maximum edge WebP. Original image copies retain their source bytes.',
  videoPolicy: '5-second local fixture clips, H264/yuv420p/24fps, no crop, AAC where source audio exists, faststart. Fixture original max-edge960; preview max-edge640.',
  portraitVideo: 'Portrait — fixture vidéo is a static 5s clip made from the existing Dixie public portrait. It tests 9:16 geometry, not portrait motion quality.',
  logicalMetadataPolicy: 'Deterministic synthetic IDs/ref/name/source/date/favorite/collection membership. Measured size/dimensions/duration are reused from each physical original fixture.',
  limitations: [
    '1000/10000 records reuse 20 physical originals; cached requests underrepresent a real library of 10000 unique files.',
    'All URLs are local/public fixtures. No private grants, expiry, backend ownership, server pagination or real tool mutation is exercised.',
    'Video originals in this fixture are newly encoded 5s demo fragments, not complete repository source videos. Full source provenance is recorded below.',
    'No existing local public video had portrait geometry; the portrait fixture is explicitly static.',
    'Audio has width=height=0 and a generic icon; the icon dimensions are not audio facts.',
  ],
  provenance,
}, null, 2) + '\n');
console.log(JSON.stringify({physicalAssets: templates.length, images: images.length, videos: videos.length, audio: 1, outputRoot}));
